import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.authorized) return auth.response;
  const config = {
    hasAccessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
    hasPhoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    hasBusinessAccountId: !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    hasVerifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
  };

  const isConfigured = config.hasAccessToken && config.hasPhoneNumberId;

  return NextResponse.json({
    status: isConfigured ? 'configured' : 'not_configured',
    config,
    instructions: {
      step1: "Acesse developers.facebook.com e crie um App Business.",
      step2: "Adicione o produto WhatsApp ao App.",
      step3: "Obtenha o 'Phone Number ID' e o 'Access Token' (Token de Acesso Temporário ou Permanente).",
      step4: "Configure as variáveis de ambiente no sistema.",
      step5: "Configure o Webhook usando a URL do seu App + /api/whatsapp/webhook."
    }
  });
}
