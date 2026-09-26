-- New 'admin' role (platform administrator, distinct from HR users)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';