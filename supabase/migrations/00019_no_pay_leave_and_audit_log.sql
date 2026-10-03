-- ============================================================
-- 1. "No Pay Leave" leave type (used only when paid leave is exhausted)
-- 2. Activity log: every change to key tables, who made it and what changed (admin-only, read-only)
-- ============================================================

ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'no_pay';

-- ─────────────────────────────────────────────────────────────
-- Activity log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,                 -- auth user who made the change (NULL = system / database console)
  actor_name text,
  actor_role text,
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,                -- UPDATE: previous values of the changed columns only; DELETE: full row
  new_data jsonb                 -- UPDATE: new values of the changed columns only; INSERT: full row
);
CREATE INDEX IF NOT EXISTS audit_log_time_idx ON public.audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_idx ON public.audit_log (table_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log (actor_id, occurred_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only administrators can read it; nobody can change or delete entries through the API
DROP POLICY IF EXISTS "Admins read the activity log" ON public.audit_log;
CREATE POLICY "Admins read the activity log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated, anon;

CREATE OR REPLACE FUNCTION private.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) END;
  v_changed_old jsonb;
  v_changed_new jsonb;
  v_actor uuid := auth.uid();
  v_name text;
  v_role text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, v_old -> n.key), jsonb_object_agg(n.key, n.value)
      INTO v_changed_old, v_changed_new
      FROM jsonb_each(v_new) n
     WHERE n.key NOT IN ('updated_at') AND (v_old -> n.key) IS DISTINCT FROM n.value;
    IF v_changed_new IS NULL THEN RETURN NEW; END IF;  -- nothing meaningful changed
    v_old := v_changed_old;
    v_new := v_changed_new;
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT COALESCE(full_name, email), role::text INTO v_name, v_role FROM public.profiles WHERE id = v_actor;
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_name, actor_role, table_name, record_id, action, old_data, new_data)
  VALUES (
    v_actor, COALESCE(v_name, CASE WHEN v_actor IS NULL THEN 'System' END), v_role, TG_TABLE_NAME,
    COALESCE(v_new ->> 'id', v_old ->> 'id', v_new ->> 'employee_id', v_old ->> 'employee_id'),
    TG_OP, v_old, v_new
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.audit_row_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'employees', 'salary_records', 'leave_requests', 'profiles', 'leave_type_config',
    'employee_documents', 'employee_leave_grants', 'salary_slip_requests'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION private.audit_row_change()', t);
  END LOOP;
END $$;
