-- ============================================================
-- SECTION: SCHEMA
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: employment_status; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'employment_status'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."employment_status" AS ENUM (
    'active',
    'resigned'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_status; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'leave_status'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."leave_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_type; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'leave_type'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."leave_type" AS ENUM (
    'annual',
    'sick',
    'casual',
    'other',
    'maternity',
    'paternity'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."user_role" AS ENUM (
    'hr_admin',
    'manager',
    'staff',
    'admin',
    'finance'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: get_employee_directory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_employee_directory"() RETURNS TABLE("id" "uuid", "employee_id" "text", "full_name" "text", "designation" "text", "employment_status" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT e.id, e.employee_id, e.full_name, e.designation, e.employment_status::text
  FROM public.employees e
  WHERE public.has_permission(auth.uid(), 'employees')
     OR public.has_permission(auth.uid(), 'leaves')
     OR public.has_permission(auth.uid(), 'salary_management')
     OR public.has_permission(auth.uid(), 'salary_slips')
  ORDER BY e.employee_id;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "employment_commencement" "date" NOT NULL,
    "designation" "text" NOT NULL,
    "bank" "text" NOT NULL,
    "bank_branch" "text" NOT NULL,
    "bank_account_number" "text" NOT NULL,
    "profile_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "phone" "text",
    "employment_status" "public"."employment_status" DEFAULT 'active'::"public"."employment_status" NOT NULL,
    "resigned_at" timestamp with time zone,
    "first_name" "text",
    "last_name" "text"
);


--
-- Name: get_employee_for_slip("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_employee_for_slip"("emp_id" "uuid") RETURNS "public"."employees"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT e.*
  FROM public.employees e
  WHERE e.id = emp_id
    AND public.has_permission(auth.uid(), 'salary_slips');
$$;


--
-- Name: get_user_permissions("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_user_permissions"("uid" "uuid") RETURNS "text"[]
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT permissions FROM public.profiles WHERE id = uid;
$$;


--
-- Name: get_user_role("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_user_role"("uid" "uuid") RETURNS "public"."user_role"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


--
-- Name: has_permission("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."has_permission"("uid" "uuid", "module" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND (role = 'admin' OR module = ANY (permissions))
  );
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."leave_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "leave_type" "public"."leave_type" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "total_days" numeric(5,2) NOT NULL,
    "reason" "text",
    "status" "public"."leave_status" DEFAULT 'pending'::"public"."leave_status" NOT NULL,
    "reviewed_by" "uuid",
    "review_comment" "text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: leave_type_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."leave_type_config" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "leave_type" "public"."leave_type" NOT NULL,
    "label" "text" NOT NULL,
    "annual_entitlement_days" integer DEFAULT 14 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "public"."user_role" DEFAULT 'staff'::"public"."user_role" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "must_change_password" boolean DEFAULT false NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "profiles_permissions_valid" CHECK (("permissions" <@ ARRAY['dashboard'::"text", 'employees'::"text", 'leaves'::"text", 'salary_management'::"text", 'salary_slips'::"text", 'user_management'::"text"]))
);


--
-- Name: salary_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."salary_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "payroll_month" "text" NOT NULL,
    "payroll_period" "text" NOT NULL,
    "payroll_year" integer NOT NULL,
    "payroll_month_number" integer NOT NULL,
    "basic_salary" numeric(12,2) NOT NULL,
    "transportation_allowance" numeric(12,2) DEFAULT 0 NOT NULL,
    "education_allowance" numeric(12,2) DEFAULT 0 NOT NULL,
    "working_days_constant" integer DEFAULT 30 NOT NULL,
    "actual_working_days" numeric(5,2) NOT NULL,
    "leave_entitlement_days" numeric(5,2) DEFAULT 0 NOT NULL,
    "total_days_entitled" numeric(5,2) GENERATED ALWAYS AS (("actual_working_days" + "leave_entitlement_days")) STORED,
    "gross_earning" numeric(12,2) NOT NULL,
    "basic_salary_earned" numeric(12,2) NOT NULL,
    "total_allowance_earned" numeric(12,2) NOT NULL,
    "total_gross_earning" numeric(12,2) NOT NULL,
    "epf_employer" numeric(12,2) NOT NULL,
    "etf_payment" numeric(12,2) NOT NULL,
    "epf_employee" numeric(12,2) NOT NULL,
    "stamp_duty" numeric(12,2) DEFAULT 25 NOT NULL,
    "total_deductions" numeric(12,2) NOT NULL,
    "net_pay" numeric(12,2) NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attendance_allowance" numeric DEFAULT 0 NOT NULL,
    "total_pay" numeric GENERATED ALWAYS AS (((("basic_salary" + "transportation_allowance") + "education_allowance") + "attendance_allowance")) STORED
);


--
-- Name: employees employees_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employees_employee_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_employee_id_key" UNIQUE ("employee_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employees_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leave_requests_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'leave_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_type_config leave_type_config_leave_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leave_type_config_leave_type_key'
      AND n.nspname = 'public'
      AND c.relname = 'leave_type_config'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leave_type_config"
    ADD CONSTRAINT "leave_type_config_leave_type_key" UNIQUE ("leave_type");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_type_config leave_type_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leave_type_config_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'leave_type_config'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leave_type_config"
    ADD CONSTRAINT "leave_type_config_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_email_key'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: salary_records salary_records_employee_id_payroll_year_payroll_month_numbe_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'salary_records_employee_id_payroll_year_payroll_month_numbe_key'
      AND n.nspname = 'public'
      AND c.relname = 'salary_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."salary_records"
    ADD CONSTRAINT "salary_records_employee_id_payroll_year_payroll_month_numbe_key" UNIQUE ("employee_id", "payroll_year", "payroll_month_number");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: salary_records salary_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'salary_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'salary_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."salary_records"
    ADD CONSTRAINT "salary_records_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees set_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "set_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: leave_requests set_leave_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "set_leave_requests_updated_at" BEFORE UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: salary_records set_salary_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "set_salary_records_updated_at" BEFORE UPDATE ON "public"."salary_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: employees employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employees_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees employees_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'employees_profile_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leave_requests_employee_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'leave_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'leave_requests_reviewed_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'leave_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: salary_records salary_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'salary_records_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'salary_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."salary_records"
    ADD CONSTRAINT "salary_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: salary_records salary_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'salary_records_employee_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'salary_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."salary_records"
    ADD CONSTRAINT "salary_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees Admins and HR users with employees permission have full access; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins and HR users with employees permission have full access'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins and HR users with employees permission have full access" ON "public"."employees" TO "authenticated" USING ((("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'hr_admin'::"public"."user_role"])) AND "public"."has_permission"("auth"."uid"(), 'employees'::"text"))) WITH CHECK ((("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'hr_admin'::"public"."user_role"])) AND "public"."has_permission"("auth"."uid"(), 'employees'::"text")));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_type_config Admins have full access to leave type config; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins have full access to leave type config'
      AND n.nspname = 'public'
      AND c.relname = 'leave_type_config'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins have full access to leave type config" ON "public"."leave_type_config" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Admins have full access to profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins have full access to profiles'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins have full access to profiles" ON "public"."profiles" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_type_config All authenticated users can view leave type config; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'All authenticated users can view leave type config'
      AND n.nspname = 'public'
      AND c.relname = 'leave_type_config'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "All authenticated users can view leave type config" ON "public"."leave_type_config" FOR SELECT TO "authenticated" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_requests Leave management full access; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Leave management full access'
      AND n.nspname = 'public'
      AND c.relname = 'leave_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Leave management full access" ON "public"."leave_requests" TO "authenticated" USING ((("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'hr_admin'::"public"."user_role"])) AND "public"."has_permission"("auth"."uid"(), 'leaves'::"text"))) WITH CHECK ((("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['admin'::"public"."user_role", 'hr_admin'::"public"."user_role"])) AND "public"."has_permission"("auth"."uid"(), 'leaves'::"text")));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_requests Managers with leaves permission can review requests; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Managers with leaves permission can review requests'
      AND n.nspname = 'public'
      AND c.relname = 'leave_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Managers with leaves permission can review requests" ON "public"."leave_requests" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"("auth"."uid"()) = 'manager'::"public"."user_role") AND "public"."has_permission"("auth"."uid"(), 'leaves'::"text")));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_requests Managers with leaves permission can update requests; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Managers with leaves permission can update requests'
      AND n.nspname = 'public'
      AND c.relname = 'leave_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Managers with leaves permission can update requests" ON "public"."leave_requests" FOR UPDATE TO "authenticated" USING ((("public"."get_user_role"("auth"."uid"()) = 'manager'::"public"."user_role") AND "public"."has_permission"("auth"."uid"(), 'leaves'::"text"))) WITH CHECK ((("public"."get_user_role"("auth"."uid"()) = 'manager'::"public"."user_role") AND "public"."has_permission"("auth"."uid"(), 'leaves'::"text")));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: salary_records Salary management full access; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Salary management full access'
      AND n.nspname = 'public'
      AND c.relname = 'salary_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Salary management full access" ON "public"."salary_records" TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'salary_management'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'salary_management'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: salary_records Salary slips read access for any employee; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Salary slips read access for any employee'
      AND n.nspname = 'public'
      AND c.relname = 'salary_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Salary slips read access for any employee" ON "public"."salary_records" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"("auth"."uid"()) <> 'staff'::"public"."user_role") AND "public"."has_permission"("auth"."uid"(), 'salary_slips'::"text")));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees Staff can view their linked employee record; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Staff can view their linked employee record'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Staff can view their linked employee record" ON "public"."employees" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update their own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (((NOT ("role" IS DISTINCT FROM "public"."get_user_role"("auth"."uid"()))) AND (NOT ("permissions" IS DISTINCT FROM "public"."get_user_permissions"("auth"."uid"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: salary_records Users can view own salary records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view own salary records'
      AND n.nspname = 'public'
      AND c.relname = 'salary_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view own salary records" ON "public"."salary_records" FOR SELECT TO "authenticated" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."profile_id" = "auth"."uid"()))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view their own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees Users with employees permission can view employees; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users with employees permission can view employees'
      AND n.nspname = 'public'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users with employees permission can view employees" ON "public"."employees" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'employees'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_requests Users with leaves permission can insert own requests; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users with leaves permission can insert own requests'
      AND n.nspname = 'public'
      AND c.relname = 'leave_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users with leaves permission can insert own requests" ON "public"."leave_requests" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_permission"("auth"."uid"(), 'leaves'::"text") AND ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."profile_id" = "auth"."uid"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_requests Users with leaves permission can update own pending requests; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users with leaves permission can update own pending requests'
      AND n.nspname = 'public'
      AND c.relname = 'leave_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users with leaves permission can update own pending requests" ON "public"."leave_requests" FOR UPDATE TO "authenticated" USING ((("status" = 'pending'::"public"."leave_status") AND "public"."has_permission"("auth"."uid"(), 'leaves'::"text") AND ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."profile_id" = "auth"."uid"()))))) WITH CHECK ((("status" = 'pending'::"public"."leave_status") AND "public"."has_permission"("auth"."uid"(), 'leaves'::"text") AND ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."profile_id" = "auth"."uid"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: leave_requests Users with leaves permission can view own requests; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users with leaves permission can view own requests'
      AND n.nspname = 'public'
      AND c.relname = 'leave_requests'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users with leaves permission can view own requests" ON "public"."leave_requests" FOR SELECT TO "authenticated" USING (("public"."has_permission"("auth"."uid"(), 'leaves'::"text") AND ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."profile_id" = "auth"."uid"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users with user management permission can view profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users with user management permission can view profiles'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users with user management permission can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'user_management'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."leave_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_type_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."leave_type_config" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: salary_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."salary_records" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




-- ============================================================
-- SECTION: DIFF FILTER OBJECTS
-- ============================================================
-- Objects that match diff-filter.json but cannot be represented
-- precisely by pg_dump --filter.

-- auth.users trigger: on_auth_user_created
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
  END IF;
END
$pg_schema_restore$;

-- ============================================================
-- SECTION: STORAGE BUCKETS DATA
-- ============================================================


-- ============================================================
-- SECTION: CRON JOBS
-- ============================================================
-- 用户自定义 pg_cron 任务。

