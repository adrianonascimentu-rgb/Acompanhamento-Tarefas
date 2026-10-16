import { NextResponse } from 'next/server';
import { POST as pushPost } from '../route';
import { verifyAuth } from '@/lib/serverAuth';

export async function POST(req: Request) {
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

  return pushPost(req);
}
