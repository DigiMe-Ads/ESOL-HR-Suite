-- Migration A: schema changes for portal update requirements

-- 1. New leave types: maternity (84 days), paternity (3 days company policy)
ALTER TYPE public.leave_type ADD VALUE 'maternity';
ALTER TYPE public.leave_type ADD VALUE 'paternity';

-- 2. Employment status enum
CREATE TYPE public.employment_status AS ENUM ('active', 'resigned');

-- 3. Profiles: names, phone, forced password change flag
ALTER TABLE public.profiles
  ADD COLUMN first_name text,
  ADD COLUMN last_name text,
  ADD COLUMN phone text,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

-- Backfill admin profile names
UPDATE public.profiles
SET first_name = 'HR', last_name = 'Administrator', must_change_password = false
WHERE email = 'admin@miaoda.com' AND first_name IS NULL;

-- 4. Employees: email, phone, employment status
ALTER TABLE public.employees
  ADD COLUMN email text,
  ADD COLUMN phone text,
  ADD COLUMN employment_status public.employment_status NOT NULL DEFAULT 'active',
  ADD COLUMN resigned_at timestamptz;

-- 5. Updated user-creation trigger: sync names, phone, must_change_password
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, full_name, phone, must_change_password, role)
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
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'staff')
  );
  RETURN NEW;
END;
$function$;
