'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell, BellOff } from 'lucide-react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BFSliuUU8CqnIGXPeN2maNCM5G4L4PNRiewtKpby95GgmoM4OKZJ9Jm3R4S4fkY5fdgJp_8H3wZbqN_gU7fzoaQ';

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

export default function PushNotificationManager({ userId, isDarkMode }: { userId: string | undefined, isDarkMode: boolean }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && userId) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        setRegistration(reg);
        if ('pushManager' in reg) {
          reg.pushManager.getSubscription().then((sub) => {
            if (sub) {
              setSubscription(sub);
              setIsSubscribed(true);
            }
          }).catch((err) => {
            console.warn('Aviso: Não foi possível verificar subscrição push existente:', err?.message || err);
          });
        }
      }).catch((err) => {
        console.warn('Aviso: Falha ao registrar Service Worker:', err?.message || err);
      });
    }
  }, [userId]);

  const subscribe = async () => {
    if (!registration || !userId) return;

    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'denied') {
          console.warn('Permissão de notificação negada no navegador.');
          return;
        }

        if (Notification.permission === 'default') {
          let perm: NotificationPermission = 'default';
          try {
            perm = await Notification.requestPermission();
          } catch (pErr) {
            console.warn('Solicitação de permissão de notificação recusada pelo contexto:', pErr);
          }
          if (perm !== 'granted') {
            console.warn('Permissão de notificação não concedida.');
            return;
          }
        }
      }

      if (!('pushManager' in registration)) {
        console.warn('PushManager não suportado pelo ServiceWorker.');
        return;
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Store in Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ 
          profile_id: userId, 
          subscription: JSON.parse(JSON.stringify(sub)) 
        }, { onConflict: 'subscription' });

      if (error) {
        console.warn('Aviso ao guardar subscrição no Supabase:', error.message);
      }

      setSubscription(sub);
      setIsSubscribed(true);
      console.log('Subscrição de notificações push realizada com sucesso.');
    } catch (err: any) {
      console.warn('Não foi possível ativar notificações push:', err?.message || err);
    }
  };

  const unsubscribe = async () => {
    if (!subscription || !userId) return;

    try {
      await subscription.unsubscribe();
      
      // Remove from Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('subscription', JSON.parse(JSON.stringify(subscription)));

      if (error) throw error;

      setSubscription(null);
      setIsSubscribed(false);
      console.log('Push unsubscription successful');
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
    }
  };

  if (!userId) return null;

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
        isSubscribed 
          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      }`}
      title={isSubscribed ? 'Desativar Notificações' : 'Ativar Notificações'}
    >
      {isSubscribed ? <Bell size={14} /> : <BellOff size={14} />}
      {isSubscribed ? 'Notificações Ativas' : 'Ativar Notificações'}
    </button>
  );
}
