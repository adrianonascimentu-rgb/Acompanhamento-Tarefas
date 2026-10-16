import { supabase } from '@/lib/supabase';
import { applyStatusToProfiles } from '@/lib/collaboratorStatus';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutos

class DataPrefetchCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    // Restaurar cache prévio do sessionStorage se disponível
    if (typeof window !== 'undefined') {
      try {
        const storedCollaborators = sessionStorage.getItem('prefetch_collaborators');
        if (storedCollaborators) {
          const parsed = JSON.parse(storedCollaborators);
          if (parsed && typeof parsed.timestamp === 'number' && parsed.data && Date.now() - parsed.timestamp < DEFAULT_TTL_MS) {
            this.cache.set('collaborators', parsed);
          }
        }
        const storedTasks = sessionStorage.getItem('prefetch_tasks');
        if (storedTasks) {
          const parsed = JSON.parse(storedTasks);
          if (parsed && typeof parsed.timestamp === 'number' && parsed.data && Date.now() - parsed.timestamp < DEFAULT_TTL_MS) {
            this.cache.set('tasks', parsed);
          }
        }
      } catch (err) {
        console.warn('Erro ao restaurar cache do sessionStorage:', err);
      }
    }
  }

  /**
   * Obtém os dados do cache se válidos (menores que o TTL)
   */
  getCached<T>(key: string, customTtl = DEFAULT_TTL_MS): T | null {
    const entry = this.cache.get(key);
    if (!entry || !entry.data || typeof entry.timestamp !== 'number') return null;

    const isExpired = Date.now() - entry.timestamp > customTtl;
    if (isExpired) {
      return null;
    }
    return entry.data as T;
  }

  /**
   * Salva dados no cache e persiste em sessionStorage
   */
  setCache<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now()
    };
    this.cache.set(key, entry);

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`prefetch_${key}`, JSON.stringify(entry));
      } catch (e) {
        // Ignora estouro de cota do sessionStorage
      }
    }
  }

  /**
   * Invalida uma entrada específica do cache
   */
  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(`prefetch_${key}`);
        } catch (e) {}
      }
    } else {
      this.cache.clear();
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('prefetch_collaborators');
          sessionStorage.removeItem('prefetch_tasks');
        } catch (e) {}
      }
    }
  }

  /**
   * Executa o Prefetch de Colaboradores (Profiles)
   */
  async prefetchCollaborators(force = false): Promise<any[]> {
    const cacheKey = 'collaborators';
    if (!force) {
      const cached = this.getCached<any[]>(cacheKey);
      if (cached) return cached;
    }

    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        let resultData: any[] = [];
        
        // 1. Tentar via Supabase
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .not('role', 'ilike', '%entrega%')
          .not('type', 'eq', 'entregador')
          .order('name');

        if (!error && data) {
          resultData = applyStatusToProfiles(data);
        } else {
          // 2. Contingência via API interna
          const res = await fetch('/api/collaborators');
          if (res.ok) {
            const json = await res.json();
            if (json?.collaborators?.length) {
              const filtered = json.collaborators.filter((c: any) => 
                c.type !== 'entregador' && !c.role?.toLowerCase()?.includes('entrega')
              );
              resultData = applyStatusToProfiles(filtered);
            }
          }
        }

        if (resultData.length > 0) {
          this.setCache(cacheKey, resultData);
        }
        return resultData;
      } catch (err) {
        console.warn('Erro durante prefetch de colaboradores:', err);
        return [];
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Executa o Prefetch de Tarefas
   */
  async prefetchTasks(force = false): Promise<any[]> {
    const cacheKey = 'tasks';
    if (!force) {
      const cached = this.getCached<any[]>(cacheKey);
      if (cached) return cached;
    }

    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error || !tasks) {
          return [];
        }

        // Buscar atribuições em paralelo para complementar
        let assigneesByTaskId: Record<string, any[]> = {};
        try {
          const { data: assignees } = await supabase
            .from('task_assignees')
            .select('*, profiles(id, name, type, image_url)');
          
          if (assignees) {
            assignees.forEach((a: any) => {
              if (!assigneesByTaskId[a.task_id]) {
                assigneesByTaskId[a.task_id] = [];
              }
              if (a.profiles) {
                assigneesByTaskId[a.task_id].push(a.profiles);
              }
            });
          }
        } catch (e) {}

        const enrichedTasks = tasks.map(t => ({
          ...t,
          task_assignees: assigneesByTaskId[t.id] || []
        }));

        this.setCache(cacheKey, enrichedTasks);
        return enrichedTasks;
      } catch (err) {
        console.warn('Erro durante prefetch de tarefas:', err);
        return [];
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Prefetch simultâneo de dados chave das páginas de gestão
   */
  async prefetchAll(): Promise<void> {
    await Promise.allSettled([
      this.prefetchCollaborators(),
      this.prefetchTasks()
    ]);
  }
}

export const prefetchCache = new DataPrefetchCache();
