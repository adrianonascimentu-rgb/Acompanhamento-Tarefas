'use client';

import { useCallback } from 'react';
import { prefetchCache } from '@/lib/prefetchCache';

export function useDataPrefetch() {
  const prefetchCollaborators = useCallback((force = false) => {
    return prefetchCache.prefetchCollaborators(force);
  }, []);

  const prefetchTasks = useCallback((force = false) => {
    return prefetchCache.prefetchTasks(force);
  }, []);

  const prefetchAll = useCallback(() => {
    return prefetchCache.prefetchAll();
  }, []);

  const getCachedCollaborators = useCallback(() => {
    return prefetchCache.getCached<any[]>('collaborators');
  }, []);

  const getCachedTasks = useCallback(() => {
    return prefetchCache.getCached<any[]>('tasks');
  }, []);

  const invalidatePrefetchCache = useCallback((key?: string) => {
    prefetchCache.invalidateCache(key);
  }, []);

  /**
   * Aciona prefetch inteligente de acordo com a rota para a qual o usuário navegou ou passou o mouse
   */
  const prefetchRoute = useCallback((href: string) => {
    if (href.startsWith('/collaborators') || href.startsWith('/admin/dashboard') || href.startsWith('/reports')) {
      prefetchCache.prefetchCollaborators();
    }
    if (href.startsWith('/tasks') || href.startsWith('/demands') || href.startsWith('/admin/dashboard') || href.startsWith('/reports')) {
      prefetchCache.prefetchTasks();
    }
  }, []);

  return {
    prefetchCollaborators,
    prefetchTasks,
    prefetchAll,
    getCachedCollaborators,
    getCachedTasks,
    invalidatePrefetchCache,
    prefetchRoute
  };
}
