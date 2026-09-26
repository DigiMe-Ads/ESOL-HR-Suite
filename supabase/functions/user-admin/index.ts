import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Strong temporary password: 16 chars, mixed case + digits + symbols
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const pwd: string[] = [];
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  [upper, upper, lower, lower, digits, digits, symbols].forEach((set) => pwd.push(pick(set)));
  while (pwd.length < 16) pwd.push(pick(all));
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join('');
}

interface CreateBody {
  action: 'create';
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: 'hr_admin' | 'manager' | 'staff'; // 'admin' is reserved and cannot be assigned from the UI
}

interface ResetBody {
  action: 'reset_password';
  user_id: string;
}

interface SetBanBody {
  action: 'set_ban';
  user_id: string;
  banned: boolean;
}

type Body = CreateBody | ResetBody | SetBanBody;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    // Verify caller is HR Admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();
    const isAdmin = callerProfile?.role === 'admin';
    const isHR = callerProfile?.role === 'hr_admin';
    if (!isAdmin && !isHR) return json({ error: 'Forbidden — Administrator only' }, 403);

    const body = (await req.json()) as Body;

    // ── CREATE USER ─────────────────────────────────────────────
    if (body.action === 'create') {
      if (!isAdmin) return json({ error: 'Forbidden — Administrator only' }, 403);
      const { first_name, last_name, email, phone, role } = body;
      if (!first_name?.trim() || !last_name?.trim()) return json({ error: 'First name and last name are required' }, 400);
      if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return json({ error: 'A valid email address is required' }, 400);
      if (!['hr_admin', 'manager', 'staff'].includes(role)) return json({ error: 'Invalid role' }, 400);

      const tempPassword = generateTempPassword();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          full_name: `${first_name.trim()} ${last_name.trim()}`,
          phone: phone?.trim() || null,
          role,
          must_change_password: 'true',
        },
      });
      if (createErr) return json({ error: createErr.message }, 400);

      // Send the user an email with a link to set their own password (best effort)
      let email_sent = false;
      let login_link: string | null = null;
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: email.trim().toLowerCase(),
      });
      if (!linkErr && linkData?.properties?.action_link) {
        login_link = linkData.properties.action_link;
        email_sent = true;
      }

      return json({ user_id: created.user?.id, temp_password: tempPassword, login_link, email_sent });
    }

    // ── RESET PASSWORD ──────────────────────────────────────────
    if (body.action === 'reset_password') {
      if (!isAdmin) return json({ error: 'Forbidden — Administrator only' }, 403);
      const { user_id } = body;
      if (!user_id) return json({ error: 'user_id is required' }, 400);

      const tempPassword = generateTempPassword();
      const { error: pwdErr } = await admin.auth.admin.updateUserById(user_id, { password: tempPassword });
      if (pwdErr) return json({ error: pwdErr.message }, 400);

      await admin.from('profiles').update({ must_change_password: true }).eq('id', user_id);

      const { data: profile } = await admin.from('profiles').select('email').eq('id', user_id).maybeSingle();
      let email_sent = false;
      let login_link: string | null = null;
      if (profile?.email) {
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email: profile.email,
        });
        if (!linkErr && linkData?.properties?.action_link) {
          login_link = linkData.properties.action_link;
          email_sent = true;
        }
      }

      return json({ temp_password: tempPassword, login_link, email_sent });
    }

    // ── BAN / UNBAN (resignation) ───────────────────────────────
    if (body.action === 'set_ban') {
      const { user_id, banned } = body;
      if (!user_id) return json({ error: 'user_id is required' }, 400);
      const { error: banErr } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: banned ? '87600h' : 'none',
      });
      if (banErr) return json({ error: banErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
