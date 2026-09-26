-- Migration C: structured names on employees
ALTER TABLE public.employees
  ADD COLUMN first_name text,
  ADD COLUMN last_name text;

UPDATE public.employees
SET first_name = COALESCE(first_name, full_name),
    last_name = COALESCE(last_name, '')
WHERE first_name IS NULL;
