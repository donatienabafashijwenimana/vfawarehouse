const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

let clientPromise = null;

/**
 * Lazily created Supabase client. The SDK is only downloaded (via dynamic
 * import) the first time it is actually used, so demo mode — the default —
 * never ships @supabase/supabase-js in the main bundle. Resolves null when
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
 */
export function getSupabase() {
  if (!supabaseConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    );
  }
  return clientPromise;
}