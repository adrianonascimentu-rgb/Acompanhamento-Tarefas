import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/serverAuth';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BFSliuUU8CqnIGXPeN2maNCM5G4L4PNRiewtKpby95GgmoM4OKZJ9Jm3R4S4fkY5fdgJp_8H3wZbqN_gU7fzoaQ';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'Lqr-KAV0J97bfkALV0t0rlFqyOaCd7VhEWpgLqZt71A';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:adrianonascimentu@gmail.com';

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails(
      vapidSubject,
      publicVapidKey,
      privateVapidKey
    );
  } catch (err) {
    console.error('Falha ao inicializar chaves VAPID:', err);
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { profileId, userId, title, body: messageBody, url, icon, badge } = body;
    const targetUserId = profileId || userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'profileId ou userId é obrigatório' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Buscar subscrições do usuário tanto por profile_id quanto por user_id
    let subscriptions: any[] = [];

    const { data: subsByProfile, error: errProfile } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, profile_id, subscription')
      .eq('profile_id', targetUserId);

    if (subsByProfile && subsByProfile.length > 0) {
      subscriptions = [...subsByProfile];
    } else {
      try {
        const { data: subsByUser } = await supabaseAdmin
          .from('push_subscriptions')
          .select('id, subscription')
          .eq('user_id', targetUserId);
        if (subsByUser && subsByUser.length > 0) {
          subscriptions = [...subsByUser];
        }
      } catch (e) {}
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({ message: 'Nenhum dispositivo encontrado para este usuário', sentCount: 0 });
    }

    const payload = JSON.stringify({
      title: title || 'AgenteX - Notificação',
      body: messageBody || 'Você possui uma nova atualização.',
      url: url || '/tasks',
      icon: icon || '/icons/icon-192.png',
      badge: badge || '/icons/icon-192.png',
      timestamp: Date.now()
    });

    let sentCount = 0;
    const results = await Promise.allSettled(
      subscriptions.map(async (subRecord) => {
        let subObj = subRecord.subscription;
        if (typeof subObj === 'string') {
          try {
            subObj = JSON.parse(subObj);
          } catch (e) {}
        }

        if (!subObj || !subObj.endpoint) return;

        try {
          await webpush.sendNotification(subObj, payload);
          sentCount++;
        } catch (err: any) {
          // Se a inscrição expirou ou foi cancelada no aparelho
          if (err.statusCode === 410 || err.statusCode === 404) {
            if (subRecord.id) {
              await supabaseAdmin.from('push_subscriptions').delete().eq('id', subRecord.id);
            } else {
              await supabaseAdmin.from('push_subscriptions').delete().eq('subscription', subRecord.subscription);
            }
          }
        }
      })
    );

    return NextResponse.json({ 
      success: true, 
      sentCount,
      totalDevices: subscriptions.length,
      results 
    });
  } catch (err: any) {
    console.error('Push error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
