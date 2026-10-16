import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Webhook for Social Media Platforms (Meta: Instagram/Facebook, TikTok, LinkedIn, Twitter/X, etc.)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.SOCIAL_MEDIA_WEBHOOK_SECRET || process.env.SOCIAL_MEDIA_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    return new Response('Forbidden: Webhook verify token not configured', { status: 403 });
  }

  // Standard Meta Webhook Handshake (Instagram / Facebook Graph API)
  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Social Media Webhook verified successfully!');
      return new Response(challenge || 'OK', { status: 200 });
    } else {
      console.warn('Social Media Webhook verification failed: Invalid verify token');
      return new Response('Forbidden: Invalid verify token', { status: 403 });
    }
  }

  return NextResponse.json({
    status: 'online',
    message: 'Social Media Webhook Endpoint is active and ready to receive events.',
    timestamp: new Date().toISOString()
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const headersList = Object.fromEntries(req.headers.entries());

    console.log('Incoming Social Media Webhook event received:', {
      event_type: rawBody.object || rawBody.type || 'generic_event',
      timestamp: new Date().toISOString()
    });

    // Handle Meta (Instagram / Facebook Lead Ads & Feed Interactions)
    if (rawBody.object === 'page' || rawBody.object === 'instagram') {
      const entries = rawBody.entry || [];
      for (const entry of entries) {
        // Process leads or mentions if present
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'leadgen') {
              const leadgenId = change.value?.leadgen_id;
              console.log(`Novo Lead Social Media gerado: ${leadgenId}`);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Event received' }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing social media webhook:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
