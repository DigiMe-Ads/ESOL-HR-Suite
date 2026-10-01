-- ============================================================
-- QA security & integrity fixes (QA report 2026-09-30)
--   DEF-01  employee directory / slip RPCs leaked every employee's bank details to staff
--   DEF-02  HR users could ban the administrator
--   DEF-03  reviewers could approve their own leave; managers could edit any leave column
--   DEF-05  HR could not list accounts to link to employees
--   DEF-12  HR users may maintain leave configuration
--   DEF-14  employees may withdraw their own pending leave
--   DEF-15  salary preparers need approved-leave days without full leave access
--   DEF-21  forced password change could be skipped by editing the profile flag
--   DEF-24  one login linked to several employees
--   DEF-30  anon could execute directory/slip RPCs; reset codes valid for 30 days
--   DEF-31  no server-side checks on leave dates/days or salary amounts
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Shared access helper: may the user see payroll for every employee?
-- Mirrors the salary_records SELECT policies.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_view_all_payroll(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(uid, 'salary_management')
      OR (public.get_user_role(uid) <> 'staff'::public.user_role AND public.has_permission(uid, 'salary_slips'));
$$;
REVOKE ALL ON FUNCTION public.can_view_all_payroll(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_all_payroll(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- DEF-01: employee directory — everyone else's rows only for roles that need them
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_employee_directory()
RETURNS TABLE (id uuid, employee_id text, full_name text, designation text, employment_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.employee_id, e.full_name, e.designation, e.employment_status::text
  FROM public.employees e
  WHERE e.profile_id = auth.uid()
     OR public.has_permission(auth.uid(), 'employees')
     OR public.can_view_all_payroll(auth.uid())
     OR (public.get_user_role(auth.uid()) IN ('admin', 'hr_admin', 'manager')
         AND public.has_permission(auth.uid(), 'leaves'))
  ORDER BY e.employee_id;
$$;

-- DEF-01: full employee record (bank details) — own record, or payroll/employee managers
CREATE OR REPLACE FUNCTION public.get_employee_for_slip(emp_id uuid)
RETURNS public.employees
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.*
  FROM public.employees e
  WHERE e.id = emp_id
    AND (
      e.profile_id = auth.uid()
      OR public.has_permission(auth.uid(), 'employees')
      OR public.can_view_all_payroll(auth.uid())
    );
$$;

-- DEF-30: never callable anonymously
REVOKE ALL ON FUNCTION public.get_employee_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_employee_for_slip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_for_slip(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- DEF-02: ban/unban — never an administrator, never yourself
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_ban(p_user_id uuid, p_banned boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target public.user_role;
BEGIN
  IF private.caller_role() IS NULL OR private.caller_role() NOT IN ('admin', 'hr_admin') THEN
    RAISE EXCEPTION 'Forbidden — Administrator only';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change the login status of your own account';
  END IF;
  SELECT role INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF v_target = 'admin' THEN
    RAISE EXCEPTION 'Administrator accounts cannot be disabled';
  END IF;
  UPDATE auth.users
     SET banned_until = CASE WHEN p_banned THEN now() + interval '87600 hours' ELSE NULL END,
         updated_at = now()
   WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- DEF-03: leave review goes through one audited RPC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_leave_request(p_leave_id uuid, p_status public.leave_status, p_comment text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.user_role := public.get_user_role(auth.uid());
  v_req public.leave_requests%ROWTYPE;
  v_owner uuid;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'hr_admin', 'manager') OR NOT public.has_permission(auth.uid(), 'leaves') THEN
    RAISE EXCEPTION 'You are not allowed to review leave requests';
  END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Status must be approved or rejected';
  END IF;

  SELECT * INTO v_req FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been reviewed'; END IF;

  SELECT profile_id INTO v_owner FROM public.employees WHERE id = v_req.employee_id;
  IF v_owner = auth.uid() THEN
    RAISE EXCEPTION 'You cannot review your own leave request';
  END IF;

  UPDATE public.leave_requests
     SET status = p_status,
         reviewed_by = auth.uid(),
         review_comment = NULLIF(trim(COALESCE(p_comment, '')), ''),
         reviewed_at = now()
   WHERE id = p_leave_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.review_leave_request(uuid, public.leave_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_leave_request(uuid, public.leave_status, text) TO authenticated;

-- Reviewers keep read access; direct writes are no longer allowed
DROP POLICY IF EXISTS "Managers with leaves permission can update requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Leave management full access" ON public.leave_requests;
CREATE POLICY "Admins and HR with leaves permission can view all requests"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin'::user_role, 'hr_admin'::user_role)
    AND public.has_permission(auth.uid(), 'leaves')
  );

-- DEF-14: employees may withdraw (delete) their own pending requests
DROP POLICY IF EXISTS "Users can withdraw own pending requests" ON public.leave_requests;
CREATE POLICY "Users can withdraw own pending requests"
  ON public.leave_requests FOR DELETE
  TO authenticated
  USING (
    status = 'pending'::leave_status
    AND employee_id IN (SELECT employees.id FROM public.employees WHERE employees.profile_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- DEF-05: accounts that can be linked to an employee record
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_linkable_profiles()
RETURNS TABLE (id uuid, full_name text, email text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email, p.role::text
  FROM public.profiles p
  WHERE p.role <> 'admin'
    AND public.get_user_role(auth.uid()) IN ('admin', 'hr_admin')
    AND public.has_permission(auth.uid(), 'employees')
  ORDER BY p.full_name NULLS LAST, p.email;
$$;
REVOKE ALL ON FUNCTION public.get_linkable_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linkable_profiles() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- DEF-15: approved leave overlapping a payroll period, for salary preparers
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_approved_leaves_for_payroll(p_employee_id uuid, p_start date, p_end date)
RETURNS TABLE (start_date date, end_date date, leave_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.start_date, l.end_date, l.leave_type::text
  FROM public.leave_requests l
  WHERE l.employee_id = p_employee_id
    AND l.status = 'approved'
    AND l.start_date <= p_end
    AND l.end_date >= p_start
    AND public.has_permission(auth.uid(), 'salary_management');
$$;
REVOKE ALL ON FUNCTION public.get_approved_leaves_for_payroll(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_approved_leaves_for_payroll(uuid, date, date) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- DEF-21: users may only edit their own name/phone/avatar; the forced
-- password change is completed server-side
-- ─────────────────────────────────────────────────────────────
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (first_name, last_name, full_name, phone, avatar_url) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_forced_password_change(p_new_password text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM private.assert_password_strength(p_new_password);
  SELECT encrypted_password INTO v_hash FROM auth.users WHERE id = auth.uid();
  IF v_hash IS NOT NULL AND v_hash = extensions.crypt(p_new_password, v_hash) THEN
    RAISE EXCEPTION 'Choose a password different from your temporary password';
  END IF;
  PERFORM private.set_auth_password(auth.uid(), p_new_password);
  UPDATE public.profiles SET must_change_password = false WHERE id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_forced_password_change(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_forced_password_change(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- DEF-12: HR users may maintain leave configuration
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "HR users can update leave type config" ON public.leave_type_config;
CREATE POLICY "HR users can update leave type config"
  ON public.leave_type_config FOR UPDATE
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'hr_admin'::user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'hr_admin'::user_role);

-- ─────────────────────────────────────────────────────────────
-- DEF-24: one login ↔ one employee (only when existing data allows it)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT profile_id FROM public.employees WHERE profile_id IS NOT NULL GROUP BY profile_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'employees.profile_id has duplicates — resolve them, then create employees_profile_id_unique';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS employees_profile_id_unique ON public.employees (profile_id) WHERE profile_id IS NOT NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- DEF-31: server-side sanity checks (NOT VALID = enforced for new/updated rows only)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_dates_chk CHECK (end_date >= start_date) NOT VALID,
  ADD CONSTRAINT leave_requests_days_chk CHECK (total_days > 0 AND total_days <= (end_date - start_date + 1)) NOT VALID;

ALTER TABLE public.salary_records
  ADD CONSTRAINT salary_records_amounts_chk CHECK (
    basic_salary >= 0 AND transportation_allowance >= 0 AND education_allowance >= 0
    AND attendance_allowance >= 0 AND actual_working_days >= 0 AND leave_entitlement_days >= 0
    AND actual_working_days + leave_entitlement_days <= 31
  ) NOT VALID;

-- ─────────────────────────────────────────────────────────────
-- DEF-30: reset codes default to 72 hours instead of 30 days
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.issue_reset_code(p_email text, p_valid_for interval DEFAULT interval '72 hours')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)) THEN
    RAISE EXCEPTION 'No user with email %', p_email;
  END IF;
  FOR i IN 1..10 LOOP
    v_code := v_code || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
  END LOOP;
  INSERT INTO private.password_reset_codes (email, code_hash, expires_at)
  VALUES (lower(p_email), extensions.crypt(v_code, extensions.gen_salt('bf')), now() + p_valid_for)
  ON CONFLICT (email) DO UPDATE
    SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
        failed_attempts = 0, used_at = NULL, created_at = now();
  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION private.issue_reset_code(text, interval) FROM PUBLIC, anon, authenticated;
