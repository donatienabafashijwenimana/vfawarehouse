import { getSupabase, supabaseConfigured } from './supabase';

const DEMO_USERS_KEY = 'vfa_demo_users';

function readDemoUsers() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_USERS_KEY) || 'null') || null;
  } catch {
    return null;
  }
}

function writeDemoUsers(users) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

/** Seed demo accounts (idempotent) used only when Supabase is not configured. */
export function ensureDemoUsers(seedUsers) {
  if (!readDemoUsers()) writeDemoUsers(seedUsers);
  return readDemoUsers();
}

export async function signIn(email, password) {
  if (supabaseConfigured) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: data.user, session: data.session };
  }
  // Demo auth
  const users = readDemoUsers() || [];
  const match = users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase() && u.password === password
  );
  if (!match) throw new Error('Invalid email or password');
  const session = { user: { id: match.id, email: match.email }, demo: true };
  localStorage.setItem('vfa_demo_session', JSON.stringify(session));
  return { user: match, session };
}

export async function signOut() {
  if (supabaseConfigured) {
    const supabase = await getSupabase();
    return supabase.auth.signOut();
  }
  localStorage.removeItem('vfa_demo_session');
}

export async function getSession() {
  if (supabaseConfigured) {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session;
  }
  try {
    return JSON.parse(localStorage.getItem('vfa_demo_session') || 'null');
  } catch {
    return null;
  }
}

export async function registerUser({ email, password, fullName }) {
  if (supabaseConfigured) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  }
  const users = readDemoUsers() || [];
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists');
  }
  const user = {
    id: `u_${Date.now()}`,
    email,
    password,
    fullName,
    role: 'customer',
    status: 'ACTIVE',
    demo: true,
  };
  users.push(user);
  writeDemoUsers(users);
  const session = { user: { id: user.id, email }, demo: true };
  localStorage.setItem('vfa_demo_session', JSON.stringify(session));
  return { user };
}

export async function requestPasswordReset(email) {
  if (supabaseConfigured) {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return;
  }
  const users = readDemoUsers() || [];
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error('No account found with this email');
}

export async function updatePassword(newPassword) {
  if (supabaseConfigured) {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return;
  }
  const session = JSON.parse(localStorage.getItem('vfa_demo_session') || 'null');
  if (!session) throw new Error('Not signed in');
  const users = readDemoUsers() || [];
  const user = users.find((u) => u.id === session.user.id);
  if (user) {
    user.password = newPassword;
    writeDemoUsers(users);
  }
}

export async function updateOwnProfile(fields) {
  if (supabaseConfigured) {
    const supabase = await getSupabase();
    const session = await getSession();
    const { error } = await supabase
      .from('profiles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
    if (error) throw error;
    return;
  }
  const session = JSON.parse(localStorage.getItem('vfa_demo_session') || 'null');
  if (!session) throw new Error('Not signed in');
  const users = readDemoUsers() || [];
  const user = users.find((u) => u.id === session.user.id);
  if (user) Object.assign(user, fields);
  writeDemoUsers(users);
}
