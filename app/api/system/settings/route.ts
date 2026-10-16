import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/serverAuth';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || supabaseUrl === 'https://placeholder-url.supabase.co') {
    return null;
  }

  if (serviceRoleKey && serviceRoleKey !== 'sua_supabase_service_role_key_aqui') {
    return createClient(supabaseUrl, serviceRoleKey);
  }

  if (anonKey && anonKey !== 'placeholder-key') {
    return createClient(supabaseUrl, anonKey);
  }

  return null;
}

export async function GET() {
  try {
    const client = getAdminClient();
    if (!client) {
      return NextResponse.json({
        app_name: 'AgenteX',
        app_short_name: 'AgenteX',
        app_subtitle: 'Gestão Inteligente',
      });
    }

    const { data } = await client
      .from('system_settings')
      .select('key, value')
      .in('key', ['app_name', 'app_short_name', 'app_subtitle', 'company_name']);

    const settingsMap: Record<string, any> = {
      app_name: 'AgenteX',
      app_short_name: 'AgenteX',
      app_subtitle: 'Gestão Inteligente',
    };

    if (data) {
      data.forEach(item => {
        settingsMap[item.key] = item.value;
      });
    }

    return NextResponse.json(settingsMap);
  } catch (err: any) {
    return NextResponse.json({
      app_name: 'AgenteX',
      app_short_name: 'AgenteX',
      app_subtitle: 'Gestão Inteligente',
    });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return auth.response;

    const client = getAdminClient();
    if (!client) {
      return NextResponse.json({ success: true, message: 'Mock mode active' });
    }

    // Persistir na base de dados
    const updates = [
      { key: 'app_name', value: 'AgenteX' },
      { key: 'app_short_name', value: 'AgenteX' },
      { key: 'app_subtitle', value: 'Gestão Inteligente' },
      { key: 'company_name', value: 'AgenteX' },
      { key: 'system_name', value: 'AgenteX' }
    ];

    for (const item of updates) {
      await client
        .from('system_settings')
        .upsert(item, { onConflict: 'key' });
    }

    return NextResponse.json({ success: true, updated: updates });
  } catch (err: any) {
    console.error('Erro ao atualizar configurações do app na base:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
