// Edge Function: admin-users
// The ONLY place the service-role key is used. It checks that the caller is an active admin
// before doing anything, and only ever touches users in the caller's own school.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, service);

    // 1. Who is calling? The signed-in user's token is verified by Supabase Auth itself.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'You are not signed in.' }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'You are not signed in.' }, 401);

    // 2. Are they an active admin? (looked up with the service client, not taken from the request)
    const { data: me } = await admin.from('profiles').select('school_id, role, is_active').eq('id', user.id).maybeSingle();
    if (!me || me.role !== 'admin' || !me.is_active) return json({ error: 'Only administrators can do this.' }, 403);

    const body = await req.json().catch(() => null);
    if (!body || typeof body.action !== 'string') return json({ error: 'Bad request.' }, 400);

    const sameSchool = async (id: string): Promise<boolean> => {
      const { data } = await admin.from('profiles').select('school_id').eq('id', id).maybeSingle();
      return !!data && data.school_id === me.school_id;
    };

    // ---- create_user ----
    if (body.action === 'create_user') {
      const role = body.role;
      if (role !== 'teacher' && role !== 'student') return json({ error: 'Role must be teacher or student.' }, 400);
      const fullName = String(body.full_name ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (fullName.length < 2 || fullName.length > 150) return json({ error: 'Enter the full name.' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'The email address is not valid.' }, 400);
      if (password.length < 8) return json({ error: 'The password must be at least 8 characters.' }, 400);

      let regno: string | null = null;
      if (role === 'student') {
        regno = String(body.registration_number ?? '').trim().toLowerCase();
        if (!/^[a-z0-9._-]{3,30}$/.test(regno)) return json({ error: 'Registration number: 3 to 30 letters, numbers, dots, dashes or underscores.' }, 400);
        if (email.split('@')[0] !== regno) return json({ error: 'Registration number and login do not match.' }, 400);
      }

      const classId: string | null = body.class_id ? String(body.class_id) : null;
      const sessionId: string | null = body.session_id ? String(body.session_id) : null;
      if (role === 'student' && classId && sessionId) {
        const [c, s] = await Promise.all([
          admin.from('classes').select('id').eq('id', classId).eq('school_id', me.school_id).maybeSingle(),
          admin.from('academic_sessions').select('id').eq('id', sessionId).eq('school_id', me.school_id).maybeSingle(),
        ]);
        if (!c.data || !s.data) return json({ error: 'Choose a valid class.' }, 400);
      }

      const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (cErr || !created?.user) {
        const exists = cErr?.message?.toLowerCase().includes('already');
        return json({ error: exists ? 'An account with that email or registration number already exists.' : 'Could not create the account.' }, 400);
      }
      const id = created.user.id;

      const { error: pErr } = await admin.from('profiles').insert({
        id, school_id: me.school_id, role, full_name: fullName,
        email: role === 'teacher' ? email : null, registration_number: regno,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(id);
        return json({ error: pErr.code === '23505' ? 'That registration number is already in use.' : 'Could not save the profile.' }, 400);
      }
      if (role === 'student' && classId && sessionId) {
        const { error: eErr } = await admin.from('enrollments').insert({ school_id: me.school_id, student_id: id, class_id: classId, session_id: sessionId });
        if (eErr) {
          await admin.auth.admin.deleteUser(id);   // cascades to the profile
          return json({ error: 'Could not place the student in that class.' }, 400);
        }
      }
      return json({ id });
    }

    // ---- reset_password ----
    if (body.action === 'reset_password') {
      const id = String(body.user_id ?? '');
      const password = String(body.password ?? '');
      if (password.length < 8) return json({ error: 'The password must be at least 8 characters.' }, 400);
      if (!(await sameSchool(id))) return json({ error: 'User not found.' }, 404);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: 'Could not change the password.' }, 400);
      return json({ ok: true });
    }

    // ---- set_active ----
    if (body.action === 'set_active') {
      const id = String(body.user_id ?? '');
      const active = body.is_active === true;
      if (id === user.id) return json({ error: 'You cannot deactivate your own account.' }, 400);
      if (!(await sameSchool(id))) return json({ error: 'User not found.' }, 404);
      const { error: pErr } = await admin.from('profiles').update({ is_active: active }).eq('id', id);
      if (pErr) return json({ error: 'Could not update the account.' }, 400);
      // Also block sign-in at the auth layer so existing sessions cannot refresh.
      await admin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' });
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch {
    return json({ error: 'Unexpected server error.' }, 500);
  }
});
