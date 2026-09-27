import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { sendOperationEmail } from '../_shared/email.ts';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Give a recorded customer a password, or reset the one they already have.
 *
 * This has to run here rather than in the browser. Setting someone else's password
 * needs the service-role key, and that key must never reach a client — shipping it
 * would hand every signed-in user the ability to create or take over any account.
 * supabase.auth.updateUser only ever changes the caller's own password.
 *
 * Authorization is the customers.update permission rather than the manager role, so
 * whoever is already allowed to edit a customer record can also get them into the
 * portal. The check is done with the admin client against the caller's own profile,
 * exactly as create-managed-user does, because a client-supplied permission list
 * would be worth nothing.
 */

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'Setting a password is temporarily unavailable.' });
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: 'Sign in to set a customer password.' });

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
    .select('role, status, permissions')
    .eq('id', caller.id)
    .maybeSingle();
  if (profileError) return json(500, { error: 'Could not verify your account permissions.' });
  if (callerProfile?.status !== 'ACTIVE') {
    return json(403, { error: 'Your account is not active.' });
  }
  if (callerProfile.role === 'manager' || (callerProfile.permissions ?? []).includes('customers.update')) {
    // allowed
  } else {
    return json(403, { error: 'You need the customers.update permission to set a customer password.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'Enter valid details.' });
  }

  const customerId = typeof payload.customerId === 'string' ? payload.customerId : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!customerId) return json(400, { error: 'No customer was selected.' });
  if (password.length < 6 || password.length > 128) {
    return json(400, { error: 'Password must be between 6 and 128 characters.' });
  }

  const { data: customer, error: customerError } = await admin
    .from('customers')
    .select('id, name, email, user_id, status')
    .eq('id', customerId)
    .maybeSingle();
  if (customerError) return json(500, { error: 'Could not load this customer.' });
  if (!customer) return json(404, { error: 'That customer no longer exists.' });

  const email = (customer.email ?? '').trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    // A login is an email and a password. Without a usable address there is nothing
    // to sign in with, so say that rather than failing deeper in with a Supabase
    // error about a malformed email.
    return json(400, { error: 'Add an email address to this customer before setting a password.' });
  }

  let userId = customer.user_id ?? null;
  let created = false;

  // The customer record may predate their login, or the login may exist without
  // ever having been linked back to the record — a customer created through the
  // Users page gets an account but no customers.user_id. So the auth user is looked
  // up by email as well, and linked if one is found there.
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = (list?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email);
    if (match) userId = match.id;
  }

  if (userId) {
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      return json(400, { error: updateError.message ?? 'Could not set this password.' });
    }
  } else {
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: customer.name },
    });
    if (createError || !newUser?.user) {
      return json(400, { error: createError?.message ?? 'Could not create this login.' });
    }
    userId = newUser.user.id;
    created = true;
  }

  // The profile is the source of truth for whether the account may sign in, and it
  // is created by a trigger on signup. Set it here rather than assuming: a customer
  // left PENDING is refused at sign-in with "a manager must confirm your account",
  // so setting a password on them without confirming would look like it worked.
  const { error: profileUpdateError } = await admin
    .from('profiles')
    .update({ full_name: customer.name, email, role: 'customer', status: 'ACTIVE' })
    .eq('id', userId);
  if (profileUpdateError) {
    return json(500, { error: 'The account could not be confirmed, so the customer still cannot sign in.' });
  }

  // Link the login back to the record, so the portal can find the customer by their
  // own account instead of by matching on name.
  if (customer.user_id !== userId) {
    const { error: linkError } = await admin
      .from('customers')
      .update({ user_id: userId })
      .eq('id', customer.id);
    if (linkError) {
      return json(500, { error: 'The password was set, but the login could not be linked to the customer record.' });
    }
  }

  try {
    await sendOperationEmail(admin, {
      eventKey: `customer_password:${userId}:${Date.now()}`,
      to: email,
      subject: 'Your VFA Warehouse password has been set',
      heading: `Hello, ${customer.name}`,
      message: `A password has been set for your VFA Warehouse account by an administrator. You can sign in with ${email} and the password you were given. If you did not expect this, contact your administrator.`,
    });
  } catch (emailError) {
    // The password is set either way; a failed notice is not a reason to report
    // the whole thing as failed and have the manager set it again.
    console.error('Customer password email notification failed:', emailError);
  }

  return json(200, { userId, created });
});
