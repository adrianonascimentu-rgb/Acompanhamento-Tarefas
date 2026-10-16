import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/serverAuth';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) return null;

  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  if (anonKey) {
    return createClient(supabaseUrl, anonKey);
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return auth.response;

    const url = new URL(req.url);
    const filter = url.searchParams.get('filter') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const client = getAdminClient();
    if (!client) {
      return NextResponse.json({ 
        success: false, 
        error: 'Supabase não está configurado.', 
        logs: [] 
      }, { status: 500 });
    }

    let rawLogs: any[] = [];
    let fetchError: string | null = null;

    // 1. Tenta consultar o schema 'auth' tabela 'audit_log_entries'
    try {
      const authClient = client.schema('auth');
      const { data, error } = await authClient
        .from('audit_log_entries')
        .select('id, payload, created_at, ip_address')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        rawLogs = data;
      } else if (error) {
        fetchError = error.message;
      }
    } catch (e: any) {
      fetchError = e?.message || 'Erro ao acessar schema auth';
    }

    // 2. Se falhar, tenta via RPC caso exista uma função personalizada ou fallback
    if (rawLogs.length === 0) {
      try {
        const { data: rpcData, error: rpcError } = await client.rpc('get_email_audit_logs', { max_rows: limit });
        if (!rpcError && rpcData) {
          rawLogs = rpcData;
          fetchError = null;
        }
      } catch (_) {}
    }

    // Processamento e sanitização dos logs para o frontend
    const parsedLogs = (rawLogs || []).map((entry: any) => {
      const payload = entry.payload || {};
      const action = payload.action || payload.event_name || payload.type || 'Evento Desconhecido';
      
      let recipientEmail = payload.actor_email || payload.email || payload.target_email || payload.recipient || '';
      
      // Procura e-mail em campos aninhados comuns de logs do Supabase
      if (!recipientEmail && payload.traits?.email) {
        recipientEmail = payload.traits.email;
      }
      if (!recipientEmail && payload.actor_username) {
        recipientEmail = payload.actor_username;
      }

      const isRecovery = 
        action.toLowerCase().includes('recovery') || 
        action.toLowerCase().includes('password') || 
        action.toLowerCase().includes('reset') ||
        JSON.stringify(payload).toLowerCase().includes('recovery');

      const isEmailEvent = 
        isRecovery || 
        action.toLowerCase().includes('mail') || 
        action.toLowerCase().includes('invite') || 
        action.toLowerCase().includes('signup') ||
        action.toLowerCase().includes('confirmation');

      let status: 'delivered' | 'pending' | 'failed' | 'info' = 'info';
      if (isRecovery) {
        status = 'delivered';
      }
      if (payload.error || payload.error_code || payload.status_code >= 400) {
        status = 'failed';
      }

      return {
        id: entry.id,
        action: action,
        isRecovery,
        isEmailEvent,
        email: recipientEmail || 'Sistema / Não informado',
        ip_address: entry.ip_address || payload.ip || '–',
        created_at: entry.created_at || new Date().toISOString(),
        payload: payload,
        status: status,
        errorMessage: payload.error || payload.error_message || null
      };
    });

    // Filtra se for solicitado apenas eventos de e-mail / recuperação
    let filteredLogs = parsedLogs;
    if (filter === 'recovery') {
      filteredLogs = parsedLogs.filter(l => l.isRecovery);
    } else if (filter === 'email') {
      filteredLogs = parsedLogs.filter(l => l.isEmailEvent);
    }

    return NextResponse.json({
      success: true,
      count: filteredLogs.length,
      totalRaw: rawLogs.length,
      logs: filteredLogs,
      fetchError: rawLogs.length === 0 ? fetchError : null,
      serviceRoleConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
  } catch (err: any) {
    console.error('Erro na API de logs de auditoria:', err);
    return NextResponse.json({
      success: false,
      error: err?.message || 'Erro interno ao consultar logs de auditoria',
      logs: []
    }, { status: 500 });
  }
}
