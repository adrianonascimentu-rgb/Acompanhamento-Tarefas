'use client';

import React, { useEffect } from 'react';
import { useRole } from '@/hooks/useRole';
import { useDataPrefetch } from '@/hooks/useDataPrefetch';

export function DataPrefetchProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useRole();
  const { prefetchAll } = useDataPrefetch();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Prefetch de dados em segundo plano quando a aplicação inicializar
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          prefetchAll();
        });
      } else {
        prefetchAll();
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user, prefetchAll]);

  return <>{children}</>;
}
