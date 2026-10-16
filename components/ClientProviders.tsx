'use client';

import React from 'react';
import { UIProvider } from '@/hooks/useUI';
import { ThemeProvider } from '@/hooks/useTheme';
import { RoleProvider } from '@/hooks/useRole';
import { DataPrefetchProvider } from '@/components/DataPrefetchProvider';
import { installAuthFetch } from '@/lib/authFetch';

if (typeof window !== 'undefined') {
  installAuthFetch();
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const pathname = window.location.pathname;

      if ((hash.includes('type=recovery') || hash.includes('access_token=')) && pathname !== '/reset-password') {
        window.location.href = `/reset-password${hash}`;
      }

      // Auto-recuperação de ChunkLoadError (chunks desatualizados ou timeout em conexões lentas)
      const handleChunkError = (event: ErrorEvent) => {
        const errorMsg = event?.message || event?.error?.message || '';
        if (/Loading chunk .* failed/i.test(errorMsg) || errorMsg.includes('ChunkLoadError')) {
          console.warn('[ChunkLoadError detected] Tentando recarregar para obter os novos chunks...');
          const lastReload = sessionStorage.getItem('chunk_reload_ts');
          const now = Date.now();
          if (!lastReload || now - Number(lastReload) > 8000) {
            sessionStorage.setItem('chunk_reload_ts', String(now));
            window.location.reload();
          }
        }
      };

      window.addEventListener('error', handleChunkError);

      // Sincronizar nome da aplicação na base de dados (system_settings)
      fetch('/api/system/settings', { method: 'POST' }).catch(() => {});

      return () => window.removeEventListener('error', handleChunkError);
    }
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <ThemeProvider>
      <RoleProvider>
        <UIProvider>
          <DataPrefetchProvider>
            {children}
          </DataPrefetchProvider>
        </UIProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}
