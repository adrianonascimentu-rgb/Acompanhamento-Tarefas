// lib/push.ts
import { supabase } from '@/lib/supabaseClient';

const DEFAULT_VAPID_PUBLIC_KEY = 'BFSliuUU8CqnIGXPeN2maNCM5G4L4PNRiewtKpby95GgmoM4OKZJ9Jm3R4S4fkY5fdgJp_8H3wZbqN_gU7fzoaQ';

// Converter a chave VAPID pública de Base64 para Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotification(userIdParam?: string): Promise<{ success: boolean; message?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Janela do navegador indisponível.' };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Notificações Push não são suportadas neste navegador.');
    return { success: false, message: 'Notificações Push não são suportadas neste navegador.' };
  }

  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;

  try {
    // 1. Registar Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    if (Notification.permission === 'denied') {
      console.warn('Permissão de notificação negada no navegador.');
      return { success: false, message: 'Permissão de notificação bloqueada pelo navegador.' };
    }

    // 2. Solicitar Permissão ao Utilizador
    let permission: NotificationPermission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch (pErr) {
        console.warn('Falha ao solicitar permissão de notificação:', pErr);
      }
    }

    if (permission !== 'granted') {
      console.warn('Permissão de notificação não concedida.');
      return { success: false, message: 'Permissão de notificação não concedida.' };
    }

    if (!('pushManager' in registration)) {
      return { success: false, message: 'PushManager não suportado pelo navegador.' };
    }

    // 3. Obter ou Criar Subscrição no PushManager usando a chave pública VAPID
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });
    }

    // 4. Identificar o ID do usuário conectado
    let targetUserId = userIdParam;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }

    if (!targetUserId) {
      const savedUser = localStorage.getItem('user-data');
      if (savedUser) {
        try {
          targetUserId = JSON.parse(savedUser).id;
        } catch (e) {}
      }
    }

    if (!targetUserId) {
      return { success: false, message: 'Usuário não autenticado.' };
    }

    const subJson = subscription.toJSON();

    // 5. Salvar subscrição no Supabase vinculada ao profile_id
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        profile_id: targetUserId,
        subscription: subJson,
      },
      { onConflict: 'subscription' }
    );

    if (error) {
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: targetUserId,
          profile_id: targetUserId,
          subscription: subJson,
        },
        { onConflict: 'subscription' }
      );
    }

    localStorage.setItem('push_enabled', 'true');
    console.log('Dispositivo registrado com sucesso para receber notificações push!');
    return { success: true, message: 'Notificações push ativadas com sucesso!' };
  } catch (error: any) {
    console.error('Erro ao registrar notificações push:', error);
    return { success: false, message: error?.message || 'Erro ao registrar notificações push.' };
  }
}

// Verifica status atual da permissão
export function getPushNotificationStatus(): 'unsupported' | 'default' | 'granted' | 'denied' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

// Disparar notificação push através da rota da API
export async function sendPushNotification(params: {
  userId?: string;
  profileId?: string;
  title: string;
  body: string;
  url?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    return { success: res.ok && !data.error, message: data.message || data.error };
  } catch (err: any) {
    console.error('Falha na chamada fetch para /api/push:', err);
    return { success: false, message: err?.message || 'Falha na conexão.' };
  }
}
