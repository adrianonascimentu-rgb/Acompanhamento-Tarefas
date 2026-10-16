import { useState, useEffect } from 'react';
import { supabase, handleSupabaseAuthError } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';

export interface Notification {
  id: string;
  profile_id: string;
  task_id?: string;
  event_key?: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  push?: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user, isAuthenticated } = useRole();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user?.id || user.id === 'admin-bootstrap') return;
    
    // Check if Supabase is configured
    const isConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
      
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        const isJwtExpired = error.code === 'PGRST303' || error.message?.includes('JWT expired');
        if (isJwtExpired) {
          const recovered = await handleSupabaseAuthError(error);
          if (recovered) {
            return fetchNotifications();
          }
          setNotifications([]);
          return;
        }

        const isMissingTable = 
          error.code === '42P01' || 
          error.code === 'PGRST116' || 
          error.code === 'PGRST205' || 
          (error.message && error.message.includes('relation "notifications" does not exist')) ||
          (error.message && error.message.includes('not found'));

        if (isMissingTable) {
          console.warn('Aviso: A tabela "notifications" não foi encontrada no Supabase.');
          setNotifications([]);
          return;
        }
        
        if (error.message === 'Failed to fetch' || error.message?.includes('Failed to fetch') || error.message?.includes('TypeError')) {
          setNotifications([]);
          return;
        }
        
        console.warn('Aviso ao buscar notificações:', error.message);
        setNotifications([]);
        return;
      }
      setNotifications(data || []);
    } catch (err: any) {
      if (err?.message === 'Failed to fetch' || err?.message?.includes('Failed to fetch') || err instanceof TypeError) {
        return;
      }
      console.error('Unexpected error fetching notifications:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    const isConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
      
    if (!isConfigured) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') return;
        throw error;
      }
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error: any) {
      if (error?.message === 'Failed to fetch' || error?.message?.includes('Failed to fetch') || error instanceof TypeError) {
        return;
      }
      console.error('Error marking notification as read:', error);
    }
  };
  
  const clearAll = async () => {
    if (!user?.id || user.id === 'admin-bootstrap') return;
    
    const isConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
      
    if (!isConfigured) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('profile_id', user.id)
        .eq('read', false);
      
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') return;
        throw error;
      }
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error: any) {
      if (error?.message === 'Failed to fetch' || error?.message?.includes('Failed to fetch') || error instanceof TypeError) {
        return;
      }
      console.error('Error clearing notifications:', error);
    }
  };

  const createNotification = async (
    profileId: string, 
    title: string, 
    message: string, 
    type: string = 'info', 
    taskId?: string, 
    eventKey?: string, 
    push: boolean = true
  ) => {
    if (!profileId) {
      console.warn('createNotification chamado sem profileId');
      return;
    }
    
    const isConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
      
    if (!isConfigured) return;

    try {
      let existing = null;
      
      // Checar se já existe notificação para evitar duplicações de disparo
      if (taskId && eventKey) {
        const { data, error: checkError } = await supabase
          .from('notifications')
          .select('id')
          .eq('profile_id', profileId)
          .eq('task_id', taskId)
          .eq('event_key', eventKey)
          .limit(1)
          .single();
        
        if (checkError) {
          if (checkError.code === 'PGRST205' || checkError.message?.includes('column')) {
            const { data: fallbackData } = await supabase
              .from('notifications')
              .select('id')
              .eq('profile_id', profileId)
              .eq('message', message)
              .limit(1)
              .single();
            existing = fallbackData;
          }
        } else {
          existing = data;
        }
      } else {
        const { data: fallbackData } = await supabase
          .from('notifications')
          .select('id')
          .eq('profile_id', profileId)
          .eq('message', message)
          .limit(1)
          .single();
        existing = fallbackData;
      }

      if (existing) return; // Notificação já existente

      // Verificar se as notificações estão ativadas no perfil do destinatário
      const { data: profile } = await supabase
        .from('profiles')
        .select('notifications_enabled')
        .eq('id', profileId)
        .single();
      
      if (profile && profile.notifications_enabled === false) {
        return;
      }

      const payload: any = {
        profile_id: profileId,
        title,
        message,
        type,
        read: false,
        created_at: new Date().toISOString()
      };

      if (taskId && eventKey) {
        payload.task_id = taskId;
        payload.event_key = eventKey;
      }

      const { error } = await supabase.from('notifications').insert(payload);
      
      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('column')) {
          delete payload.task_id;
          delete payload.event_key;
          const { error: retryError } = await supabase.from('notifications').insert(payload);
          if (retryError && retryError.code !== '42P01' && retryError.code !== 'PGRST205') {
            throw retryError;
          }
        } else if (error.code !== '42P01' && error.code !== 'PGRST205') {
          throw error;
        }
      }

      // Disparar notificação Push via Servidor Web Push (para PC e Celular)
      if (push) {
        try {
          fetch('/api/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              profileId, 
              title, 
              body: message, 
              url: taskId ? `/tasks?id=${taskId}` : '/tasks',
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png'
            })
          }).catch((fetchErr) => {
            console.warn('Erro ao requisitar /api/push:', fetchErr);
          });
        } catch (e) {}
      }
    } catch (error: any) {
      if (error?.message === 'Failed to fetch' || error?.message?.includes('Failed to fetch') || error instanceof TypeError) {
        return;
      }
      console.error('Error creating notification:', error?.message || JSON.stringify(error) || error);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.id && user.id !== 'admin-bootstrap') {
      fetchNotifications();

      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
        
      if (!isConfigured) return;

      // Escutar novas notificações em tempo real no Supabase
      const channel = supabase
        .channel(`public:notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${user.id}`
          },
          (payload) => {
            const newNotif = payload.new as Notification;
            setNotifications(prev => [newNotif, ...prev]);
            
            // Exibir notificação nativa do navegador (Desktop ou Mobile)
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(newNotif.title || 'AgenteX', {
                      body: newNotif.message,
                      icon: '/icons/icon-192.png',
                      badge: '/icons/icon-192.png',
                      tag: newNotif.id || 'notif'
                    });
                  }).catch(() => {
                    new Notification(newNotif.title || 'AgenteX', {
                      body: newNotif.message,
                      icon: '/icons/icon-192.png',
                      tag: newNotif.id || 'notif'
                    });
                  });
                } else {
                  new Notification(newNotif.title || 'AgenteX', {
                    body: newNotif.message,
                    icon: '/icons/icon-192.png',
                    tag: newNotif.id || 'notif'
                  });
                }
              } catch (err) {
                console.warn('Erro ao exibir notificação em tempo real:', err);
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    loading,
    markAsRead,
    clearAll,
    createNotification,
    refresh: fetchNotifications
  };
}
