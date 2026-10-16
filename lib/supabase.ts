import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const authOptions = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Custom storage wrapper bypassing navigator.locks to prevent "AbortError: Lock broken by another request with the 'steal' option"
    storage: typeof window !== 'undefined' ? {
      getItem: (key: string) => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
        } catch {}
      },
      removeItem: (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    } : undefined
  };

  const urlIsValid = !!supabaseUrl && /^https?:\/\//.test(supabaseUrl);

  if (!supabaseUrl || !supabaseAnonKey || !urlIsValid) {
    console.warn(
      'Variáveis do Supabase ausentes ou inválidas (NEXT_PUBLIC_SUPABASE_URL deve começar com https://). Usando valores provisórios para que a tela de login abra.'
    );
    supabaseInstance = createClient(
      'https://placeholder-url.supabase.co',
      'placeholder-key',
      { auth: authOptions }
    );
  } else {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, { auth: authOptions });
  }

  return supabaseInstance;
};

export const supabase = getSupabase();

/**
 * Utility to detect and auto-recover from expired Supabase JWT tokens (PGRST303)
 */
export async function handleSupabaseAuthError(error: any): Promise<boolean> {
  if (!error) return false;

  const isJwtExpired = 
    error.code === 'PGRST303' || 
    error.message?.includes('JWT expired') || 
    error.message?.includes('jwt expired') ||
    error.message?.includes('invalid JWT') ||
    error.message?.includes('token is expired');

  if (isJwtExpired) {
    console.warn('[Supabase Auth] Sessão expirada (PGRST303 / JWT expired). Tentando auto-recuperação...');
    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && data?.session) {
        console.log('[Supabase Auth] Token renovado com sucesso!');
        return true;
      }
      
      console.warn('[Supabase Auth] Não foi possível renovar o token. Limpando token expirado...');
      await supabase.auth.signOut().catch(() => {});
      if (typeof window !== 'undefined') {
        localStorage.removeItem('app_user_session');
      }
    } catch (err) {
      console.warn('[Supabase Auth] Erro ao tratar expiração de JWT:', err);
    }
  }

  return false;
}
