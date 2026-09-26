DROP VIEW IF EXISTS public.employee_directory; CREATE OR REPLACE FUNCTION public.get_employee_directory() RETURNS TABLE (
  id uuid,
  employee_id text,
  full_name text,
  designation text,
  employment_status text
) LANGUAGE sql SECURITY DEFINER SET search_path TO public AS $$
  SELECT e.id, e.employee_id, e.full_name, e.designation, e.employment_status::text
  FROM public.employees e
  WHERE public.has_permission(auth.uid(), 'employees')
     OR public.has_permission(auth.uid(), 'leaves')
     OR public.has_permission(auth.uid(), 'salary_management')
     OR public.has_permission(auth.uid(), 'salary_slips')
  ORDER BY e.employee_id;
$$; REVOKE ALL ON FUNCTION public.get_employee_directory() FROM PUBLIC RESTRICT; GRANT EXECUTE ON FUNCTION public.get_employee_directory() TO authenticated;