import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/serverAuth';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
  
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authorized) return auth.response;

    const supabase = getSupabaseClient();
    const body = await request.json();
    const { product_code, product_name, full_price, cash_price, store_name, company_id, created_by } = body;

    let targetCompanyId = company_id || null;

    // If company_id is not provided but created_by is, lookup user's company_id from profiles
    if (!targetCompanyId && created_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', created_by)
        .single();
      if (profile?.company_id) {
        targetCompanyId = profile.company_id;
      }
    }

    const { data, error } = await supabase
      .from('competitor_prices')
      .insert([
        {
          product_code: product_code?.trim() || null,
          product_name: product_name?.trim() || null,
          full_price: full_price !== '' && full_price !== null && full_price !== undefined ? parseFloat(full_price) : null,
          cash_price: cash_price !== '' && cash_price !== null && cash_price !== undefined ? parseFloat(cash_price) : null,
          store_name: store_name?.trim() || null,
          company_id: targetCompanyId,
          created_by: created_by || null,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('competitor_prices') || error.code === 'PGRST301' || error.code === '42P01') {
        return NextResponse.json({ 
          error: "A tabela 'competitor_prices' não existe no banco de dados Supabase.",
          missing_table: true 
        }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao salvar pesquisa.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authorized) return auth.response;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('competitor_prices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('competitor_prices') || error.code === 'PGRST301' || error.code === '42P01') {
        return NextResponse.json({ 
          error: "A tabela 'competitor_prices' não foi encontrada no Supabase.",
          missing_table: true,
          data: []
        }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar pesquisas.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authorized) return auth.response;

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch (e) {}
    }

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });
    }

    // Tenta deletar diretamente usando a service role key (que ignora RLS)
    const { error, count } = await supabase
      .from('competitor_prices')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      console.error('Erro Supabase DELETE:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (count === 0) {
      // Se não deletou nada, pode ser que o ID não exista ou a chave usada não tenha permissão (caso service role falhe)
      return NextResponse.json({ 
        success: false, 
        error: 'Registro não encontrado ou você não tem permissão para excluí-lo.' 
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: count });
  } catch (err: any) {
    console.error('Erro na rota DELETE:', err);
    return NextResponse.json({ error: err.message || 'Erro ao excluir pesquisa.' }, { status: 500 });
  }
}
