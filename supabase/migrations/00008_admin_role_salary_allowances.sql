-- Attendance allowance column
ALTER TABLE public.salary_records
  ADD COLUMN IF NOT EXISTS attendance_allowance numeric NOT NULL DEFAULT 0;

-- Fix generated column: total_pay includes attendance and is never client-writable (values derived, no data loss)
ALTER TABLE public.salary_records DROP COLUMN IF EXISTS total_pay;
ALTER TABLE public.salary_records
  ADD COLUMN total_pay numeric GENERATED ALWAYS AS (basic_salary + transportation_allowance + education_allowance + attendance_allowance) STORED;

-- Promote the platform owner account to the new admin role
UPDATE public.profiles SET role = 'admin', updated_at = now()
WHERE email = 'admin@miaoda.com';

-- Role separation: admin = platform owner, hr_admin = HR user (operational access)
DROP POLICY IF EXISTS "HR Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "HR users can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'hr_admin');

DROP POLICY IF EXISTS "HR Admins have full access to leave type config" ON public.leave_type_config;
CREATE POLICY "Admins have full access to leave type config" ON public.leave_type_config
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "HR Admins have full access to employees" ON public.employees;
CREATE POLICY "Admins and HR users have full access to employees" ON public.employees
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'hr_admin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'hr_admin'));

DROP POLICY IF EXISTS "HR Admins have full access to salary records" ON public.salary_records;
CREATE POLICY "Admins and HR users have full access to salary records" ON public.salary_records
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'hr_admin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'hr_admin'));

DROP POLICY IF EXISTS "HR Admins have full access to leave requests" ON public.leave_requests;
CREATE POLICY "Admins and HR users have full access to leave requests" ON public.leave_requests
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'hr_admin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'hr_admin'));