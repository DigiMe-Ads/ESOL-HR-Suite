-- ============================================================
-- Granular module-level access control
-- Modules: dashboard, employees, leaves, salary_management,
--          salary_slips, user_management
-- ============================================================

-- 1. Permissions column on profiles
ALTER TABLE public.profiles
  ADD COLUMN permissions text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_permissions_valid CHECK (
    permissions <@ ARRAY['dashboard','employees','leaves','salary_management','salary_slips','user_management']::text[]
  );

-- 2. Helpers (SECURITY DEFINER to avoid RLS self-loops)
CREATE OR REPLACE FUNCTION public.get_user_permissions(uid uuid)
RETURNS text[]
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $function$
  SELECT permissions FROM public.profiles WHERE id = uid;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(uid uuid, module text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND (role = 'admin' OR module = ANY (permissions))
  );
$function$;

-- 3. Signup trigger: derive permissions from metadata or role defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  perms text[];
  valid_modules text[] := ARRAY['dashboard','employees','leaves','salary_management','salary_slips','user_management'];
  new_role public.user_role;
BEGIN
  new_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'staff');

  SELECT ARRAY(
    SELECT DISTINCT m
    FROM jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data->'permissions', '[]'::jsonb)) AS m
    WHERE m = ANY (valid_modules)
  ) INTO perms;

  IF array_length(perms, 1) IS NULL THEN
    perms := CASE new_role
      WHEN 'admin' THEN valid_modules
      WHEN 'hr_admin' THEN ARRAY['dashboard','employees','leaves','salary_management','salary_slips']
      WHEN 'manager' THEN ARRAY['dashboard','leaves']
      WHEN 'finance' THEN ARRAY['salary_management','salary_slips']
      ELSE ARRAY['dashboard','leaves','salary_slips']
    END;
  END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, full_name, phone, must_change_password, role, permissions)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NULLIF(trim(concat_ws(' ', NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')), '')
    ),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false),
    new_role,
    perms
  );
  RETURN NEW;
END;
$function$;

-- 4. Backfill existing users with role-default presets
UPDATE public.profiles SET permissions = CASE role
  WHEN 'admin' THEN ARRAY['dashboard','employees','leaves','salary_management','salary_slips','user_management']
  WHEN 'hr_admin' THEN ARRAY['dashboard','employees','leaves','salary_management','salary_slips']
  WHEN 'manager' THEN ARRAY['dashboard','leaves']
  WHEN 'finance' THEN ARRAY['salary_management','salary_slips']
  ELSE ARRAY['dashboard','leaves','salary_slips']
END;

-- 5. RLS: profiles
DROP POLICY "HR users can view profiles" ON public.profiles;
CREATE POLICY "Users with user management permission can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'user_management'));

DROP POLICY "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    (NOT (role IS DISTINCT FROM public.get_user_role(auth.uid())))
    AND (NOT (permissions IS DISTINCT FROM public.get_user_permissions(auth.uid())))
  );

-- 6. RLS: employees
DROP POLICY "Admins and HR users have full access to employees" ON public.employees;
DROP POLICY "Managers can view employees" ON public.employees;

CREATE POLICY "Users with employees permission can view employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'employees'));

CREATE POLICY "Admins and HR users with employees permission have full access"
  ON public.employees FOR ALL
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin'::user_role, 'hr_admin'::user_role)
    AND public.has_permission(auth.uid(), 'employees')
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin'::user_role, 'hr_admin'::user_role)
    AND public.has_permission(auth.uid(), 'employees')
  );

-- 7. RLS: salary_records
DROP POLICY "Admins and HR users have full access to salary records" ON public.salary_records;
DROP POLICY "Managers can view salary records" ON public.salary_records;
DROP POLICY "Staff can view own salary records" ON public.salary_records;

CREATE POLICY "Salary management full access"
  ON public.salary_records FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'salary_management'))
  WITH CHECK (public.has_permission(auth.uid(), 'salary_management'));

CREATE POLICY "Salary slips read access for any employee"
  ON public.salary_records FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) <> 'staff'::user_role
    AND public.has_permission(auth.uid(), 'salary_slips')
  );

CREATE POLICY "Users can view own salary records"
  ON public.salary_records FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT employees.id FROM public.employees WHERE employees.profile_id = auth.uid())
  );

-- 8. RLS: leave_requests
DROP POLICY "Admins and HR users have full access to leave requests" ON public.leave_requests;
DROP POLICY "Managers can view and update leave requests" ON public.leave_requests;
DROP POLICY "Managers can update leave requests" ON public.leave_requests;
DROP POLICY "Staff can insert own leave requests" ON public.leave_requests;
DROP POLICY "Staff can update own pending leave requests" ON public.leave_requests;
DROP POLICY "Staff can view own leave requests" ON public.leave_requests;

CREATE POLICY "Leave management full access"
  ON public.leave_requests FOR ALL
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin'::user_role, 'hr_admin'::user_role)
    AND public.has_permission(auth.uid(), 'leaves')
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin'::user_role, 'hr_admin'::user_role)
    AND public.has_permission(auth.uid(), 'leaves')
  );

CREATE POLICY "Managers with leaves permission can review requests"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'manager'::user_role
    AND public.has_permission(auth.uid(), 'leaves')
  );

CREATE POLICY "Managers with leaves permission can update requests"
  ON public.leave_requests FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'manager'::user_role
    AND public.has_permission(auth.uid(), 'leaves')
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) = 'manager'::user_role
    AND public.has_permission(auth.uid(), 'leaves')
  );

CREATE POLICY "Users with leaves permission can view own requests"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'leaves')
    AND employee_id IN (SELECT employees.id FROM public.employees WHERE employees.profile_id = auth.uid())
  );

CREATE POLICY "Users with leaves permission can insert own requests"
  ON public.leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'leaves')
    AND employee_id IN (SELECT employees.id FROM public.employees WHERE employees.profile_id = auth.uid())
  );

CREATE POLICY "Users with leaves permission can update own pending requests"
  ON public.leave_requests FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'::leave_status
    AND public.has_permission(auth.uid(), 'leaves')
    AND employee_id IN (SELECT employees.id FROM public.employees WHERE employees.profile_id = auth.uid())
  )
  WITH CHECK (
    status = 'pending'::leave_status
    AND public.has_permission(auth.uid(), 'leaves')
    AND employee_id IN (SELECT employees.id FROM public.employees WHERE employees.profile_id = auth.uid())
  );