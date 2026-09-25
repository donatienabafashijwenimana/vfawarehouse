import { getSupabase, supabaseConfigured } from './supabase';

async function requireSupabase() {
  if (!supabaseConfigured) throw new Error('Sign-in is currently unavailable. Please contact an administrator.');
  return getSupabase();
}

export async function signIn(email, password) {
  const supabase = await requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: data.user, session: data.session };
}

export async function signOut() {
  const supabase = await requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  if (!supabaseConfigured) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function registerUser({ email, password, fullName }) {
  const supabase = await requireSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) throw error;
  return data;
}

export async function createManagedUser({ fullName, email, password, role, status, permissions }) {
  const supabase = await requireSupabase();
  const { data, error } = await supabase.functions.invoke('create-managed-user', {
    body: { fullName, email, password, role, status, permissions },
  });
  if (error) {
    const response = error.context;
    if (response instanceof Response) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? error.message);
    }
    throw error;
  }
  return data.user;
}

export async function requestPasswordReset(email) {
  const supabase = await requireSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const supabase = await requireSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function updateOwnProfile(fields) {
  const supabase = await requireSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const { error } = await supabase.from('profiles').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', user.id);
  if (error) throw error;
}
