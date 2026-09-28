-- Self-hosted Supabase: user administration + code-based password reset
-- implemented as database RPCs (replaces the `user-admin` edge function so the
-- project works with nothing but a database connection).

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Helpers (private — not exposed through the API)
-- ─────────────────────────────────────────────────────────────

-- Strong temporary password: 16 chars, mixed case + digits + symbols
CREATE OR REPLACE FUNCTION private.generate_temp_password()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  upper_set text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  lower_set text := 'abcdefghijkmnopqrstuvwxyz';
  digit_set text := '23456789';
  symbol_set text := '!@#$%&*';
  all_set text := upper_set || lower_set || digit_set || symbol_set;
  chars text[] := ARRAY[]::text[];
  sets text[] := ARRAY[upper_set, upper_set, lower_set, lower_set, digit_set, digit_set, symbol_set];
  s text;
BEGIN
  FOREACH s IN ARRAY sets LOOP
    chars := chars || substr(s, 1 + floor(random() * length(s))::int, 1);
  END LOOP;
  WHILE array_length(chars, 1) < 16 LOOP
    chars := chars || substr(all_set, 1 + floor(random() * length(all_set))::int, 1);
  END LOOP;
  RETURN (SELECT string_agg(c, '' ORDER BY random()) FROM unnest(chars) AS c);
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_password_strength(p_password text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;
  IF p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'Password must contain at least one letter and one number';
  END IF;
END;
$$;

-- Creates a confirmed email/password user directly in auth (GoTrue compatible).
-- The on_auth_user_created trigger creates the matching profile row.
CREATE OR REPLACE FUNCTION private.create_auth_user(
  p_id uuid, p_email text, p_password text, p_meta jsonb, p_created_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')), p_created_at,
    '{"provider":"email","providers":["email"]}'::jsonb, COALESCE(p_meta, '{}'::jsonb),
    p_created_at, now(), '', '', '', '', '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', lower(p_email), 'email_verified', true, 'phone_verified', false),
    'email', NULL, p_created_at, now()
  );
  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.set_auth_password(p_user_id uuid, p_password text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions, auth AS $$
  UPDATE auth.users
     SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION private.caller_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────
-- Admin RPCs (callable by signed-in users; role checked inside)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_first_name text, p_last_name text, p_email text, p_phone text, p_role public.user_role, p_permissions text[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  valid_modules text[] := ARRAY['dashboard','employees','leaves','salary_management','salary_slips','user_management'];
  v_email text := lower(trim(p_email));
  v_id uuid := gen_random_uuid();
  v_pwd text := private.generate_temp_password();
  v_meta jsonb;
BEGIN
  IF private.caller_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Forbidden — Administrator only'; END IF;
  IF COALESCE(trim(p_first_name), '') = '' OR COALESCE(trim(p_last_name), '') = '' THEN
    RAISE EXCEPTION 'First name and last name are required';
  END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'A valid email address is required'; END IF;
  IF p_role = 'admin' THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_permissions IS NOT NULL AND NOT (p_permissions <@ valid_modules) THEN RAISE EXCEPTION 'Invalid module permissions'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'A user with this email address has already been registered';
  END IF;

  v_meta := jsonb_build_object(
    'first_name', trim(p_first_name), 'last_name', trim(p_last_name),
    'full_name', trim(p_first_name) || ' ' || trim(p_last_name),
    'phone', NULLIF(trim(COALESCE(p_phone, '')), ''),
    'role', p_role, 'must_change_password', 'true'
  );
  IF p_permissions IS NOT NULL THEN v_meta := v_meta || jsonb_build_object('permissions', to_jsonb(p_permissions)); END IF;

  PERFORM private.create_auth_user(v_id, v_email, v_pwd, v_meta);
  RETURN jsonb_build_object('user_id', v_id, 'temp_password', v_pwd, 'email_sent', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_permissions(
  p_user_id uuid, p_permissions text[], p_role public.user_role DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  valid_modules text[] := ARRAY['dashboard','employees','leaves','salary_management','salary_slips','user_management'];
  v_target public.user_role;
  v_perms text[];
BEGIN
  IF private.caller_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Forbidden — Administrator only'; END IF;
  IF p_permissions IS NULL OR NOT (p_permissions <@ valid_modules) THEN RAISE EXCEPTION 'Invalid module permissions'; END IF;
  IF p_role = 'admin' THEN RAISE EXCEPTION 'Invalid role'; END IF;
  SELECT role INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF v_target = 'admin' THEN RAISE EXCEPTION 'Administrator access is locked and cannot be modified'; END IF;

  v_perms := ARRAY(SELECT DISTINCT unnest(p_permissions));
  UPDATE public.profiles
     SET permissions = v_perms, role = COALESCE(p_role, role)
   WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', true, 'permissions', to_jsonb(v_perms));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_password(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pwd text := private.generate_temp_password();
BEGIN
  IF private.caller_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Forbidden — Administrator only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
  PERFORM private.set_auth_password(p_user_id, v_pwd);
  UPDATE public.profiles SET must_change_password = true WHERE id = p_user_id;
  RETURN jsonb_build_object('temp_password', v_pwd, 'email_sent', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_ban(p_user_id uuid, p_banned boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF private.caller_role() NOT IN ('admin', 'hr_admin') OR private.caller_role() IS NULL THEN
    RAISE EXCEPTION 'Forbidden — Administrator only';
  END IF;
  UPDATE auth.users
     SET banned_until = CASE WHEN p_banned THEN now() + interval '87600 hours' ELSE NULL END,
         updated_at = now()
   WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Code-based password reset (no confirmation email needed)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS private.password_reset_codes (
  email text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Issue (or re-issue) a one-time reset code. Run from the SQL editor/psql only.
CREATE OR REPLACE FUNCTION private.issue_reset_code(p_email text, p_valid_for interval DEFAULT interval '30 days')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)) THEN
    RAISE EXCEPTION 'No user with email %', p_email;
  END IF;
  FOR i IN 1..10 LOOP
    v_code := v_code || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
  END LOOP;
  INSERT INTO private.password_reset_codes (email, code_hash, expires_at)
  VALUES (lower(p_email), extensions.crypt(v_code, extensions.gen_salt('bf')), now() + p_valid_for)
  ON CONFLICT (email) DO UPDATE
    SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
        failed_attempts = 0, used_at = NULL, created_at = now();
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_password_with_code(p_email text, p_code text, p_new_password text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_row private.password_reset_codes%ROWTYPE;
  v_user_id uuid;
  generic_error constant text := 'Invalid or expired reset code';
BEGIN
  PERFORM private.assert_password_strength(p_new_password);

  SELECT * INTO v_row FROM private.password_reset_codes WHERE email = v_email FOR UPDATE;
  IF NOT FOUND OR v_row.used_at IS NOT NULL OR v_row.expires_at < now() OR v_row.failed_attempts >= 5 THEN
    RAISE EXCEPTION '%', generic_error;
  END IF;

  IF v_row.code_hash <> extensions.crypt(upper(regexp_replace(COALESCE(p_code, ''), '[\s-]', '', 'g')), v_row.code_hash) THEN
    UPDATE private.password_reset_codes SET failed_attempts = failed_attempts + 1 WHERE email = v_email;
    RETURN jsonb_build_object('ok', false, 'error', generic_error);
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email;
  IF v_user_id IS NULL THEN RAISE EXCEPTION '%', generic_error; END IF;

  PERFORM private.set_auth_password(v_user_id, p_new_password);
  UPDATE public.profiles SET must_change_password = false WHERE id = v_user_id;
  UPDATE private.password_reset_codes SET used_at = now() WHERE email = v_email;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Privileges
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, public.user_role, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_permissions(uuid, text[], public.user_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_password(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_ban(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, public.user_role, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_permissions(uuid, text[], public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ban(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.reset_password_with_code(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_password_with_code(text, text, text) TO anon, authenticated;
