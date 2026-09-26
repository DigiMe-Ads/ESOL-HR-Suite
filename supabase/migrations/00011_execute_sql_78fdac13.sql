DROP VIEW IF EXISTS public.employee_directory; CREATE VIEW public.employee_directory WITH (security_invoker = 'true') AS SELECT
  id,
  employee_id,
  full_name,
  designation,
  employment_status
FROM public.employees; ALTER TABLE public.employee_directory 
  ENABLE ROW LEVEL SECURITY; CREATE POLICY "Salary and leave viewers can read the employee directory"
  ON public.employee_directory
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'employees')
      OR public.has_permission(auth.uid(), 'leaves')
      OR public.has_permission(auth.uid(), 'salary_management')
      OR public.has_permission(auth.uid(), 'salary_slips')
  );