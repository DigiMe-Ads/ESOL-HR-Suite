-- ============================================================
-- 1. Per-employee maternity / paternity eligibility
-- 2. In-app notifications
-- 3. Salary slip requests (employee asks → payroll staff mark "ready for pickup" → employee notified)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Leave grants: maternity / paternity only for selected employees
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_leave_grants (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL CHECK (leave_type IN ('maternity', 'paternity')),
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, leave_type)
);
ALTER TABLE public.employee_leave_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View leave grants" ON public.employee_leave_grants;
CREATE POLICY "View leave grants" ON public.employee_leave_grants FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid())
    OR public.get_user_role(auth.uid()) IN ('admin', 'hr_admin', 'manager')
  );
DROP POLICY IF EXISTS "Admin and HR grant leave" ON public.employee_leave_grants;
CREATE POLICY "Admin and HR grant leave" ON public.employee_leave_grants FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'hr_admin'));
DROP POLICY IF EXISTS "Admin and HR revoke leave" ON public.employee_leave_grants;
CREATE POLICY "Admin and HR revoke leave" ON public.employee_leave_grants FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'hr_admin'));

-- Maternity / paternity requests require a grant (enforced on insert)
DROP POLICY IF EXISTS "Users with leaves permission can insert own requests" ON public.leave_requests;
CREATE POLICY "Users with leaves permission can insert own requests" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'leaves')
    AND employee_id IN (SELECT employees.id FROM public.employees WHERE employees.profile_id = auth.uid())
    AND (
      leave_type NOT IN ('maternity', 'paternity')
      OR EXISTS (SELECT 1 FROM public.employee_leave_grants g WHERE g.employee_id = leave_requests.employee_id AND g.leave_type = leave_requests.leave_type)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Notifications (created only by server functions; users read / mark read / dismiss their own)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_profile_idx ON public.notifications (profile_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own notifications" ON public.notifications;
CREATE POLICY "Own notifications" ON public.notifications FOR SELECT TO authenticated USING (profile_id = auth.uid());
DROP POLICY IF EXISTS "Mark own notifications read" ON public.notifications;
CREATE POLICY "Mark own notifications read" ON public.notifications FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS "Dismiss own notifications" ON public.notifications;
CREATE POLICY "Dismiss own notifications" ON public.notifications FOR DELETE TO authenticated USING (profile_id = auth.uid());
REVOKE INSERT, UPDATE ON public.notifications FROM authenticated, anon;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION private.notify(p_profile_id uuid, p_title text, p_body text, p_link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (profile_id, title, body, link)
  SELECT p_profile_id, p_title, p_body, p_link WHERE p_profile_id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION private.notify(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Salary slip requests
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salary_slip_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_record_id uuid NOT NULL REFERENCES public.salary_records(id) ON DELETE CASCADE,
  payroll_month text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'collected', 'declined')),
  admin_note text,
  handled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One open request per payslip
CREATE UNIQUE INDEX IF NOT EXISTS salary_slip_requests_open_uniq ON public.salary_slip_requests (salary_record_id) WHERE status IN ('pending', 'ready');
CREATE INDEX IF NOT EXISTS salary_slip_requests_status_idx ON public.salary_slip_requests (status, created_at DESC);
ALTER TABLE public.salary_slip_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View slip requests" ON public.salary_slip_requests;
CREATE POLICY "View slip requests" ON public.salary_slip_requests FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid())
    OR public.can_view_all_payroll(auth.uid())
  );
DROP POLICY IF EXISTS "Cancel own pending slip request" ON public.salary_slip_requests;
CREATE POLICY "Cancel own pending slip request" ON public.salary_slip_requests FOR DELETE TO authenticated
  USING (status = 'pending' AND employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()));

-- Employee requests a printed slip for one of their own payslips; payroll staff are notified
CREATE OR REPLACE FUNCTION public.request_salary_slip(p_salary_record_id uuid, p_note text DEFAULT NULL)
RETURNS public.salary_slip_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec public.salary_records%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_req public.salary_slip_requests%ROWTYPE;
  v_staff uuid;
BEGIN
  SELECT * INTO v_rec FROM public.salary_records WHERE id = p_salary_record_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Salary record not found'; END IF;
  SELECT * INTO v_emp FROM public.employees WHERE id = v_rec.employee_id;
  IF v_emp.profile_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'You can only request your own salary slips'; END IF;
  IF EXISTS (SELECT 1 FROM public.salary_slip_requests WHERE salary_record_id = p_salary_record_id AND status IN ('pending', 'ready')) THEN
    RAISE EXCEPTION 'You already have an open request for this salary slip';
  END IF;

  INSERT INTO public.salary_slip_requests (employee_id, salary_record_id, payroll_month, note)
  VALUES (v_emp.id, v_rec.id, v_rec.payroll_month, NULLIF(trim(COALESCE(p_note, '')), ''))
  RETURNING * INTO v_req;

  FOR v_staff IN SELECT p.id FROM public.profiles p WHERE public.can_view_all_payroll(p.id) AND p.id <> auth.uid() LOOP
    PERFORM private.notify(v_staff, 'Salary slip requested',
      v_emp.full_name || ' (' || v_emp.employee_id || ') requested their ' || v_rec.payroll_month || ' salary slip.', '/slip-requests');
  END LOOP;
  RETURN v_req;
END;
$$;
REVOKE ALL ON FUNCTION public.request_salary_slip(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_salary_slip(uuid, text) TO authenticated;

-- Payroll staff move a request along: pending → ready / declined, ready → collected. The employee is notified.
CREATE OR REPLACE FUNCTION public.update_salary_slip_request(p_request_id uuid, p_status text, p_admin_note text DEFAULT NULL)
RETURNS public.salary_slip_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.salary_slip_requests%ROWTYPE;
  v_profile uuid;
  v_note text := NULLIF(trim(COALESCE(p_admin_note, '')), '');
BEGIN
  IF NOT public.can_view_all_payroll(auth.uid()) THEN RAISE EXCEPTION 'You are not allowed to handle salary slip requests'; END IF;
  SELECT * INTO v_req FROM public.salary_slip_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT ((v_req.status = 'pending' AND p_status IN ('ready', 'declined')) OR (v_req.status = 'ready' AND p_status = 'collected')) THEN
    RAISE EXCEPTION 'A % request cannot be marked %', v_req.status, p_status;
  END IF;

  UPDATE public.salary_slip_requests
     SET status = p_status, admin_note = COALESCE(v_note, admin_note), handled_by = auth.uid(), handled_at = now(), updated_at = now()
   WHERE id = p_request_id
   RETURNING * INTO v_req;

  SELECT profile_id INTO v_profile FROM public.employees WHERE id = v_req.employee_id;
  IF p_status = 'ready' THEN
    PERFORM private.notify(v_profile, 'Your salary slip is ready',
      'Your salary slip for ' || v_req.payroll_month || ' is ready to be picked up from HR.' || COALESCE(' Note: ' || v_note, ''), '/salary-slips');
  ELSIF p_status = 'declined' THEN
    PERFORM private.notify(v_profile, 'Salary slip request declined',
      'Your request for the ' || v_req.payroll_month || ' salary slip was declined.' || COALESCE(' Reason: ' || v_note, ''), '/salary-slips');
  END IF;
  RETURN v_req;
END;
$$;
REVOKE ALL ON FUNCTION public.update_salary_slip_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_salary_slip_request(uuid, text, text) TO authenticated;
