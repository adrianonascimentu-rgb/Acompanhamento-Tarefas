import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function verifyAuth(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Não autenticado. Token não fornecido.' };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return { user: null, error: 'Não autenticado. Token em branco.' };
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return { user: null, error: 'Servidor não configurado com SUPABASE_SERVICE_ROLE_KEY.' };
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return { user: null, error: 'Sessão inválida ou expirada.' };
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const ownerEmail = (process.env.OWNER_EMAIL || process.env.NEXT_PUBLIC_OWNER_EMAIL || '').trim().toLowerCase();
    const isAdmin = 
      profile?.type === 'admin' || 
      profile?.role === 'admin' || 
      (!!ownerEmail && user.email && user.email.toLowerCase() === ownerEmail);

    return {
      user: {
        ...user,
        ...(profile || {}),
        id: user.id,
        isAdmin: !!isAdmin
      },
      error: null
    };
  } catch (err: any) {
    return { user: null, error: err?.message || 'Erro ao verificar autenticação.' };
  }
}

export async function requireAuth(req: Request) {
  const { user, error } = await verifyAuth(req);
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: error || 'Não autorizado' }, { status: 401 })
    };
  }
  return { authorized: true, user };
}

export async function requireAdmin(req: Request) {
  const { user, error } = await verifyAuth(req);
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: error || 'Não autorizado' }, { status: 401 })
    };
  }
  if (!user.isAdmin) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 })
    };
  }
  return { authorized: true, user };
}
