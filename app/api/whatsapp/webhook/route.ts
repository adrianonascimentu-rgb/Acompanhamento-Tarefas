import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Webhook for WhatsApp Business Cloud API
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  let verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // Fallback to Supabase system_settings if not set in process.env
  if (!verifyToken) {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'WHATSAPP_VERIFY_TOKEN')
        .maybeSingle();

      if (data?.value) {
        if (typeof data.value === 'string') {
          verifyToken = data.value;
        } else if (typeof data.value === 'object' && (data.value.token || data.value.key)) {
          verifyToken = data.value.token || data.value.key;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch WHATSAPP_VERIFY_TOKEN from system_settings:', err);
    }
  }

  // Require configured verify token
  if (!verifyToken) {
    console.warn('WhatsApp Webhook verification failed: WHATSAPP_VERIFY_TOKEN is not configured');
    return new Response('Forbidden: Verify token not configured', { status: 403 });
  }

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('WhatsApp Webhook verified!');
      return new Response(challenge, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      console.warn('WhatsApp Webhook verification failed: Invalid verify token');
      return new Response('Forbidden', { status: 403 });
    }
  }
  return new Response('Not Found', { status: 404 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json({ 
        error: 'Servidor indisponível: WHATSAPP_APP_SECRET não está configurado' 
      }, { status: 503 });
    }

    const signature = req.headers.get('x-hub-signature-256');
    if (!signature) {
      return NextResponse.json({ error: 'Assinatura x-hub-signature-256 ausente' }, { status: 401 });
    }

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return NextResponse.json({ error: 'Assinatura x-hub-signature-256 inválida' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Assinatura x-hub-signature-256 inválida' }, { status: 401 });
    }

    const body = JSON.parse(rawBody || '{}');
    
    // Log the incoming object for debugging
    // console.log('WhatsApp Webhook received:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;
          
          if (value.messages) {
            for (const msg of value.messages) {
              const from = msg.from; // Phone number
              const contactName = value.contacts?.[0]?.profile?.name || from;
              const text = msg.text?.body || '';
              const messageId = msg.id;
              
              console.log(`Nova mensagem de ${contactName}: ${text}`);

              // We could store this in Supabase for real-time history
              try {
                await supabase.from('whatsapp_messages').insert([{
                  whatsapp_id: messageId,
                  phone: from,
                  contact_name: contactName,
                  message: text,
                  direction: 'inbound',
                  timestamp: new Date().toISOString()
                }]);
              } catch (e) {
                // Silently skip if table doesn't exist
                console.warn('Supabase insert failed (possibly table missing):', e);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
