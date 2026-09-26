CREATE OR REPLACE FUNCTION public.get_employee_for_slip(
  emp_id uuid
) RETURNS public.employees LANGUAGE sql SECURITY DEFINER SET search_path TO public AS $$
  SELECT e.*
  FROM public.employees e
  WHERE e.id = emp_id
    AND public.has_permission(auth.uid(), 'salary_slips');
$$; REVOKE ALL ON FUNCTION public.get_employee_for_slip(uuid) FROM PUBLIC RESTRICT; GRANT EXECUTE ON FUNCTION public.get_employee_for_slip(uuid) TO authenticated;