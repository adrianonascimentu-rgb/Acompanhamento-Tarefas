import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) return auth.response;
    const { apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ 
        valid: false, 
        message: 'A chave da API é obrigatória.' 
      }, { status: 400 });
    }

    // Tenta uma chamada simples para a Geocoding API para validar a chave
    // Usamos o parâmetro 'address=test' para minimizar o uso de cota
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=Sao+Paulo&key=${apiKey}`;
    
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return NextResponse.json({ 
        valid: true, 
        message: 'Chave válida e ativa!',
        details: data.status 
      });
    }

    if (data.status === 'REQUEST_DENIED') {
      let detail = 'Acesso negado.';
      if (data.error_message?.includes('API keys with referer restrictions')) {
        detail = 'Erro de permissão: Esta chave possui restrições de referenciador HTTP que impedem o uso neste domínio.';
      } else if (data.error_message?.includes('The provided API key is invalid')) {
        detail = 'Chave inválida: O Google não reconhece esta chave.';
      } else if (data.error_message?.includes('Billing has not been enabled')) {
        detail = 'Faturamento: O faturamento (Billing) não está ativado no projeto do Google Cloud.';
      } else if (data.error_message?.includes('Geocoding API has not been activated')) {
        detail = 'API Desativada: A Geocoding API não foi habilitada no Console do Google Cloud.';
      }
      
      return NextResponse.json({ 
        valid: false, 
        message: detail,
        error_code: data.status,
        raw_error: data.error_message
      });
    }

    if (data.status === 'OVER_QUERY_LIMIT') {
      return NextResponse.json({ 
        valid: false, 
        message: 'Cota excedida: Você atingiu o limite de consultas do Google Maps.',
        error_code: data.status
      });
    }

    return NextResponse.json({ 
      valid: false, 
      message: `Erro desconhecido do Google: ${data.status}`,
      error_code: data.status
    });

  } catch (error: any) {
    console.error('Maps verification error:', error);
    return NextResponse.json({ 
      valid: false, 
      message: 'Erro de conexão com os servidores do Google.',
      details: error.message
    }, { status: 500 });
  }
}
