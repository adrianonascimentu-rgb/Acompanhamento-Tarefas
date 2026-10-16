import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { verifyAuth } from '@/lib/serverAuth';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BFSliuUU8CqnIGXPeN2maNCM5G4L4PNRiewtKpby95GgmoM4OKZJ9Jm3R4S4fkY5fdgJp_8H3wZbqN_gU7fzoaQ';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'Lqr-KAV0J97bfkALV0t0rlFqyOaCd7VhEWpgLqZt71A';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:adrianonascimentu@gmail.com';

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails(vapidSubject, publicVapidKey, privateVapidKey);
  } catch (err) {
    console.error('VAPID setup error:', err);
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(req: Request) {
  try {
    // 1. Check Cron Secret or User Auth
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    
    let isAuthorized = false;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      const { user } = await verifyAuth(req);
      if (user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Não autorizado. Faça login ou forneça o CRON_SECRET.' }, { status: 401 });
    }
    const { taskId, routineTitle, routineDescription, assigneeIds, senderName } = await req.json();

    if (!assigneeIds || !Array.isArray(assigneeIds) || assigneeIds.length === 0) {
      return NextResponse.json({ error: 'Nenhum responsável informado para a rotina.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const title = '📋 Nova Rotina Atribuída!';
    const message = `${senderName || 'A coordenação'} adicionou uma nova rotina: "${routineTitle || 'Rotina de Trabalho'}".`;
    const targetUrl = taskId ? `/tasks?id=${taskId}` : '/tasks';

    // 1. Insert in-app notifications in Supabase for all assignees
    const notificationsToInsert = assigneeIds.map((profileId: string) => ({
      profile_id: profileId,
      title,
      message,
      type: 'routine',
      task_id: taskId || null,
      event_key: taskId ? `routine_new_${taskId}` : `routine_${Date.now()}`,
      read: false,
      created_at: new Date().toISOString()
    }));

    try {
      await supabaseAdmin.from('notifications').insert(notificationsToInsert);
    } catch (insertErr) {
      console.warn('Erro ao inserir notificações no banco:', insertErr);
    }

    // 2. Fetch push subscriptions for all assignees
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, profile_id, subscription')
      .in('profile_id', assigneeIds);

    let sentCount = 0;
    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title,
        body: message,
        url: targetUrl,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        timestamp: Date.now()
      });

      const pushPromises = subscriptions.map(async (subRecord) => {
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
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', subRecord.id);
          }
        }
      });

      await Promise.allSettled(pushPromises);
    }

    return NextResponse.json({
      success: true,
      notifiedProfiles: assigneeIds.length,
      devicesPushed: sentCount
    });
  } catch (err: any) {
    console.error('Erro na rota /api/routines/notify:', err);
    return NextResponse.json({ error: err.message || 'Erro ao notificar rotina' }, { status: 500 });
  }
}
