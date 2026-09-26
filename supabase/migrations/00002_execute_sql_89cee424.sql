DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'admin@miaoda.com';
  IF v_uid IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, recovery_token,
      email_change_token_new, email_change
    )
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@miaoda.com',
      crypt('Admin@1234', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"HR Administrator","role":"hr_admin"}',
      false, '', '', '', ''
    )
    RETURNING id INTO v_uid;
  END IF;

  -- Upsert into profiles
  INSERT INTO profiles (id, username, full_name, role)
  VALUES (v_uid, 'admin', 'HR Administrator', 'hr_admin')
  ON CONFLICT (id) DO UPDATE SET role = 'hr_admin', full_name = 'HR Administrator';

  RAISE NOTICE 'Admin user id: %', v_uid;
END $$;