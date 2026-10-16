import { supabase } from '@/lib/supabase';

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const options = init ? { ...init } : {};
  const headers = new Headers(options.headers || {});

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
  } catch (err) {
    console.warn('[authFetch] Erro ao obter token de sessão do Supabase:', err);
  }

  options.headers = headers;
  return fetch(input, options);
}

export function installAuthFetch() {
  if (typeof window === 'undefined' || (window as any).__authFetchInstalled) return;
  (window as any).__authFetchInstalled = true;

  const originalFetch = window.fetch ? window.fetch.bind(window) : fetch.bind(window);

  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url && typeof url === 'string' && url.startsWith('/api/') && !/^\/api\/[^/]+\/webhook/.test(url)) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          const headers = new Headers(init?.headers);
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${data.session.access_token}`);
          }
          return originalFetch(input, { ...init, headers });
        }
      } catch (err) {
        console.warn('Error attaching token in installAuthFetch:', err);
      }
    }

    return originalFetch(input, init);
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      configurable: true,
      writable: true,
    });
  } catch (err) {
    try {
      (window as any).fetch = customFetch;
    } catch (e) {
      console.warn('Could not intercept window.fetch:', e);
    }
  }
}
