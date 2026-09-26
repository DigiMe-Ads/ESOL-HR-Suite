
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles enum
CREATE TYPE public.user_role AS ENUM ('hr_admin', 'manager', 'staff');

-- Leave status enum
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected');

-- Leave type enum
CREATE TYPE public.leave_type AS ENUM ('annual', 'sick', 'casual', 'other');

-- =====================
-- PROFILES TABLE
-- =====================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text,
  role public.user_role NOT NULL DEFAULT 'staff',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-sync new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'staff')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to get user role (avoids RLS self-loop)
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;

-- Profiles RLS policies
CREATE POLICY "HR Admins have full access to profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'hr_admin');

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM public.get_user_role(auth.uid()));

-- =====================
-- EMPLOYEES TABLE
-- =====================
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id text UNIQUE NOT NULL,
  full_name text NOT NULL,
  employment_commencement date NOT NULL,
  designation text NOT NULL,
  bank text NOT NULL,
  bank_branch text NOT NULL,
  bank_account_number text NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR Admins have full access to employees"
  ON public.employees FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'hr_admin');

CREATE POLICY "Managers can view employees"
  ON public.employees FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'manager');

CREATE POLICY "Staff can view their linked employee record"
  ON public.employees FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- =====================
-- SALARY RECORDS TABLE
-- =====================
CREATE TABLE public.salary_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  payroll_month text NOT NULL,           -- e.g. "July 2025"
  payroll_period text NOT NULL,          -- e.g. "25th June to 24th July"
  payroll_year integer NOT NULL,
  payroll_month_number integer NOT NULL, -- 1-12
  -- Salary Allocation
  basic_salary numeric(12,2) NOT NULL,
  transportation_allowance numeric(12,2) NOT NULL DEFAULT 0,
  education_allowance numeric(12,2) NOT NULL DEFAULT 0,
  total_pay numeric(12,2) GENERATED ALWAYS AS (basic_salary + transportation_allowance + education_allowance) STORED,
  -- Working Days
  working_days_constant integer NOT NULL DEFAULT 30,
  actual_working_days numeric(5,2) NOT NULL,
  leave_entitlement_days numeric(5,2) NOT NULL DEFAULT 0,
  total_days_entitled numeric(5,2) GENERATED ALWAYS AS (actual_working_days + leave_entitlement_days) STORED,
  -- Gross Earnings (computed values stored for audit)
  gross_earning numeric(12,2) NOT NULL,
  basic_salary_earned numeric(12,2) NOT NULL,
  total_allowance_earned numeric(12,2) NOT NULL,
  total_gross_earning numeric(12,2) NOT NULL,
  -- Statutory (Employer)
  epf_employer numeric(12,2) NOT NULL,
  etf_payment numeric(12,2) NOT NULL,
  -- Deductions (Employee)
  epf_employee numeric(12,2) NOT NULL,
  stamp_duty numeric(12,2) NOT NULL DEFAULT 25,
  total_deductions numeric(12,2) NOT NULL,
  net_pay numeric(12,2) NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, payroll_year, payroll_month_number)
);

ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR Admins have full access to salary records"
  ON public.salary_records FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'hr_admin');

CREATE POLICY "Managers can view salary records"
  ON public.salary_records FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'manager');

CREATE POLICY "Staff can view own salary records"
  ON public.salary_records FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE profile_id = auth.uid()
    )
  );

-- =====================
-- LEAVE TYPES CONFIG TABLE
-- =====================
CREATE TABLE public.leave_type_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  leave_type public.leave_type NOT NULL UNIQUE,
  label text NOT NULL,
  annual_entitlement_days integer NOT NULL DEFAULT 14,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_type_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR Admins have full access to leave type config"
  ON public.leave_type_config FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'hr_admin');

CREATE POLICY "All authenticated users can view leave type config"
  ON public.leave_type_config FOR SELECT TO authenticated
  USING (true);

-- Seed default leave types
INSERT INTO public.leave_type_config (leave_type, label, annual_entitlement_days) VALUES
  ('annual', 'Annual Leave', 14),
  ('sick', 'Sick Leave', 7),
  ('casual', 'Casual Leave', 7),
  ('other', 'Other Leave', 3);

-- =====================
-- LEAVE REQUESTS TABLE
-- =====================
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days numeric(5,2) NOT NULL,
  reason text,
  status public.leave_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id),
  review_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR Admins have full access to leave requests"
  ON public.leave_requests FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'hr_admin');

CREATE POLICY "Managers can view and update leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'manager');

CREATE POLICY "Managers can update leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'manager');

CREATE POLICY "Staff can view own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update own pending leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    status = 'pending' AND
    employee_id IN (
      SELECT id FROM public.employees WHERE profile_id = auth.uid()
    )
  );

-- =====================
-- UPDATED_AT TRIGGERS
-- =====================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_salary_records_updated_at BEFORE UPDATE ON public.salary_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
