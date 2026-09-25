import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { sendOperationEmail } from '../_shared/email.ts';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'User creation is temporarily unavailable.' });
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: 'Sign in as a manager to create users.' });

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !caller) return json(401, { error: 'Your session has expired. Sign in again.' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', caller.id)
    .maybeSingle();
  if (profileError) return json(500, { error: 'Could not verify your account permissions.' });
  if (callerProfile?.role !== 'manager' || callerProfile.status !== 'ACTIVE') {
    return json(403, { error: 'Only active managers can create users.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'Enter valid user details.' });
  }

  const fullName = typeof payload.fullName === 'string' ? payload.fullName.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const role = typeof payload.role === 'string' ? payload.role : '';
  const status = typeof payload.status === 'string' ? payload.status : '';
  const requestedPermissions = payload.permissions;

  if (!fullName || fullName.length > 150) return json(400, { error: 'Enter a name up to 150 characters.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: 'Enter a valid email address.' });
  if (password.length < 6 || password.length > 128) return json(400, { error: 'Password must be between 6 and 128 characters.' });
  if (!['manager', 'staff', 'customer'].includes(role)) return json(400, { error: 'Choose a valid role.' });
  if (!['ACTIVE', 'INACTIVE'].includes(status)) return json(400, { error: 'Choose a valid status.' });
  if (!Array.isArray(requestedPermissions) || requestedPermissions.some((code) => typeof code !== 'string')) {
    return json(400, { error: 'Choose valid permissions.' });
  }

  let permissions: string[] = [];
  if (role === 'staff' && requestedPermissions.length) {
    const { data: permissionRows, error: permissionsError } = await admin.from('permissions').select('code');
    if (permissionsError) return json(500, { error: 'Could not load available permissions.' });
    const allowed = new Set((permissionRows ?? []).map((row) => row.code));
    if (requestedPermissions.some((code) => !allowed.has(code))) {
      return json(400, { error: 'One or more selected permissions are unavailable.' });
    }
    permissions = [...new Set(requestedPermissions)];
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    return json(400, { error: createError?.message ?? 'Could not create this user.' });
  }

  const { error: updateError } = await admin.from('profiles').update({
    full_name: fullName,
    email,
    role,
    status,
    permissions,
  }).eq('id', created.user.id);

  if (updateError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json(500, { error: 'The account could not be assigned its role and permissions.' });
  }

  if (role !== 'customer') {
    const { error: customerCleanupError } = await admin.from('customers').delete().eq('user_id', created.user.id);
    if (customerCleanupError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json(500, { error: 'The account could not be finalized.' });
    }
  }

  try {
    await sendOperationEmail(admin, {
      eventKey: `user_created:${created.user.id}`,
      to: email,
      subject: 'Your VFA Greenhouse Seeds Hub Ltd account is ready',
      heading: `Welcome, ${fullName}`,
      message: `Your VFA Warehouse account has been created with the ${role} role. You can now sign in using your email address and the password provided by your administrator.`,
    });
  } catch (emailError) {
    console.error('New user email notification failed:', emailError);
  }

  return json(201, {
    user: {
      id: created.user.id,
      email,
      fullName,
      role,
      status,
      permissions,
    },
  });
});
