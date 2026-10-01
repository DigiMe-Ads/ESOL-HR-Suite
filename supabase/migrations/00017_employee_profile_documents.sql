-- ============================================================
-- Employee photo + NIC, self-service profile, employee documents,
-- and admin "remove employee".
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. New employee fields
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS nic_number text,
  ADD COLUMN IF NOT EXISTS photo_path text;

-- Bank details may now be left for the employee to complete (columns stay NOT NULL, '' = missing)
ALTER TABLE public.employees
  ALTER COLUMN bank SET DEFAULT '',
  ALTER COLUMN bank_branch SET DEFAULT '',
  ALTER COLUMN bank_account_number SET DEFAULT '';

-- ─────────────────────────────────────────────────────────────
-- 2. Who may read/write an employee's files and documents:
--    the employee themselves, or Admin/HR with the Employees module
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_manage_employee_files(p_employee_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = p_employee_id AND e.profile_id = auth.uid())
      OR (public.get_user_role(auth.uid()) IN ('admin', 'hr_admin') AND public.has_permission(auth.uid(), 'employees'));
$$;
REVOKE ALL ON FUNCTION public.can_manage_employee_files(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_employee_files(uuid) TO authenticated;

-- Storage paths start with the employee id; malformed paths are simply denied
CREATE OR REPLACE FUNCTION public.can_manage_employee_folder(p_folder text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.can_manage_employee_files(p_folder::uuid);
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.can_manage_employee_folder(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_employee_folder(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Documents (education certificates, service letters, …)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('education', 'service_letter', 'other')),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  file_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_documents_employee_idx ON public.employee_documents (employee_id, created_at DESC);
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee and HR can view documents" ON public.employee_documents;
CREATE POLICY "Employee and HR can view documents" ON public.employee_documents
  FOR SELECT TO authenticated USING (public.can_manage_employee_files(employee_id));
DROP POLICY IF EXISTS "Employee and HR can add documents" ON public.employee_documents;
CREATE POLICY "Employee and HR can add documents" ON public.employee_documents
  FOR INSERT TO authenticated WITH CHECK (
    public.can_manage_employee_files(employee_id)
    AND file_path LIKE employee_id::text || '/docs/%'
  );
DROP POLICY IF EXISTS "Employee and HR can delete documents" ON public.employee_documents;
CREATE POLICY "Employee and HR can delete documents" ON public.employee_documents
  FOR DELETE TO authenticated USING (public.can_manage_employee_files(employee_id));

-- ─────────────────────────────────────────────────────────────
-- 4. Private storage bucket: <employee_id>/photo/… and <employee_id>/docs/…
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-files', 'employee-files', false, 10485760, ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "employee-files read" ON storage.objects;
CREATE POLICY "employee-files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-files' AND public.can_manage_employee_folder((storage.foldername(name))[1]));
DROP POLICY IF EXISTS "employee-files upload" ON storage.objects;
CREATE POLICY "employee-files upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-files' AND public.can_manage_employee_folder((storage.foldername(name))[1]));
DROP POLICY IF EXISTS "employee-files update" ON storage.objects;
CREATE POLICY "employee-files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'employee-files' AND public.can_manage_employee_folder((storage.foldername(name))[1]))
  WITH CHECK (bucket_id = 'employee-files' AND public.can_manage_employee_folder((storage.foldername(name))[1]));
DROP POLICY IF EXISTS "employee-files delete" ON storage.objects;
CREATE POLICY "employee-files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-files' AND public.can_manage_employee_folder((storage.foldername(name))[1]));

-- ─────────────────────────────────────────────────────────────
-- 5. Self-service profile update.
--    Phone and photo can always be changed; NIC and bank details can only be
--    filled in while missing (changing them afterwards goes through HR).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_my_employee_profile(
  p_phone text DEFAULT NULL,
  p_nic_number text DEFAULT NULL,
  p_bank text DEFAULT NULL,
  p_bank_branch text DEFAULT NULL,
  p_bank_account_number text DEFAULT NULL,
  p_photo_path text DEFAULT NULL
) RETURNS public.employees
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_nic text := NULLIF(upper(regexp_replace(COALESCE(p_nic_number, ''), '\s', '', 'g')), '');
BEGIN
  SELECT * INTO v_emp FROM public.employees WHERE profile_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No employee record is linked to your account. Contact HR.'; END IF;

  IF v_nic IS NOT NULL AND v_nic !~ '^([0-9]{9}[VX]|[0-9]{12})$' THEN
    RAISE EXCEPTION 'NIC number must be 9 digits followed by V or X, or 12 digits';
  END IF;
  IF v_nic IS NOT NULL AND COALESCE(v_emp.nic_number, '') <> '' AND v_nic <> v_emp.nic_number THEN
    RAISE EXCEPTION 'Your NIC number is already on file. Ask HR to correct it.';
  END IF;
  IF (NULLIF(trim(COALESCE(p_bank, '')), '') IS NOT NULL AND v_emp.bank <> '' AND trim(p_bank) <> v_emp.bank)
     OR (NULLIF(trim(COALESCE(p_bank_branch, '')), '') IS NOT NULL AND v_emp.bank_branch <> '' AND trim(p_bank_branch) <> v_emp.bank_branch)
     OR (NULLIF(trim(COALESCE(p_bank_account_number, '')), '') IS NOT NULL AND v_emp.bank_account_number <> '' AND trim(p_bank_account_number) <> v_emp.bank_account_number) THEN
    RAISE EXCEPTION 'Your bank details are already on file. Ask HR to change them.';
  END IF;
  IF p_photo_path IS NOT NULL AND p_photo_path NOT LIKE v_emp.id::text || '/photo/%' THEN
    RAISE EXCEPTION 'Invalid photo location';
  END IF;

  UPDATE public.employees SET
    phone = COALESCE(NULLIF(trim(COALESCE(p_phone, '')), ''), phone),
    nic_number = COALESCE(NULLIF(nic_number, ''), v_nic),
    bank = CASE WHEN bank = '' THEN COALESCE(NULLIF(trim(COALESCE(p_bank, '')), ''), '') ELSE bank END,
    bank_branch = CASE WHEN bank_branch = '' THEN COALESCE(NULLIF(trim(COALESCE(p_bank_branch, '')), ''), '') ELSE bank_branch END,
    bank_account_number = CASE WHEN bank_account_number = '' THEN COALESCE(NULLIF(trim(COALESCE(p_bank_account_number, '')), ''), '') ELSE bank_account_number END,
    photo_path = COALESCE(p_photo_path, photo_path)
  WHERE id = v_emp.id
  RETURNING * INTO v_emp;
  RETURN v_emp;
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_employee_profile(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_employee_profile(text, text, text, text, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. Admin: remove an employee (and optionally their login).
--    Salary, leave and document records are removed with them (ON DELETE CASCADE).
--    Returns the storage folder so the app can delete the files.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_employee(p_employee_id uuid, p_delete_login boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_login text := 'none';
BEGIN
  IF private.caller_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Forbidden — Administrator only'; END IF;
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;
  IF v_emp.profile_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove your own employee record'; END IF;
  IF v_emp.profile_id IS NOT NULL AND (SELECT role FROM public.profiles WHERE id = v_emp.profile_id) = 'admin' THEN
    RAISE EXCEPTION 'This employee is linked to an Administrator account and cannot be removed here';
  END IF;

  DELETE FROM public.employees WHERE id = p_employee_id;

  IF v_emp.profile_id IS NOT NULL AND p_delete_login THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_emp.profile_id;  -- cascades to profiles
      v_login := 'deleted';
    EXCEPTION WHEN foreign_key_violation THEN
      -- The account authored other records (e.g. payroll entries): keep it but block sign-in
      UPDATE auth.users SET banned_until = now() + interval '87600 hours', updated_at = now() WHERE id = v_emp.profile_id;
      v_login := 'disabled';
    END;
  ELSIF v_emp.profile_id IS NOT NULL THEN
    v_login := 'kept';
  END IF;

  RETURN jsonb_build_object('ok', true, 'folder', v_emp.id::text, 'login', v_login);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_employee(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_employee(uuid, boolean) TO authenticated;

-- Direct deletes of employees are reserved for the RPC above (HR keeps insert/update)
DROP POLICY IF EXISTS "Admins and HR users with employees permission have full access" ON public.employees;
CREATE POLICY "Admins and HR with employees permission can add employees" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin'::user_role, 'hr_admin'::user_role) AND public.has_permission(auth.uid(), 'employees'));
CREATE POLICY "Admins and HR with employees permission can edit employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin'::user_role, 'hr_admin'::user_role) AND public.has_permission(auth.uid(), 'employees'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin'::user_role, 'hr_admin'::user_role) AND public.has_permission(auth.uid(), 'employees'));
