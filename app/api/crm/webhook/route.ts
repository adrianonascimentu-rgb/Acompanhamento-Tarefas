import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase with Service Role Key for server-side bypass of RLS if needed
// This ensures the webhook can always insert data regardless of client-side RLS policies
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    // 1. Validate Secret (Source Validation)
    const authHeader = req.headers.get('authorization');
    const webhookSecret = process.env.CRM_WEBHOOK_SECRET;

    if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid CRM_WEBHOOK_SECRET is required' },
        { status: 401 }
      );
    }

    // 2. Parse Payload
    const body = await req.json();
    
    // Support both single lead and array of leads
    const rawLeads = Array.isArray(body) ? body : [body];

    if (rawLeads.length === 0) {
      return NextResponse.json(
        { error: 'Empty payload' },
        { status: 400 }
      );
    }

    // 3. Map and Validate Leads
    const leadsToInsert = rawLeads.map(lead => ({
      name: lead.name || 'Desconhecido',
      company: lead.company || lead.source || 'Lead Externo',
      email: lead.email,
      phone: lead.phone,
      segment: lead.segment || 'Geral',
      status: lead.status || 'Novo',
      company_id: lead.company_id || null, // Optional multi-tenant support
      assigned_to: lead.assigned_to || null,
      lat: lead.lat || null,
      lng: lead.lng || null,
      address: lead.address || null,
      notes: lead.notes || `Recebido via Webhook em ${new Date().toLocaleString('pt-BR')}`
    }));

    // Basic validation: name and company are required by schema (not strictly in DB but for logic)
    const validLeads = leadsToInsert.filter(l => l.name && l.company);

    if (validLeads.length === 0) {
      return NextResponse.json(
        { error: 'No valid leads found in payload. "name" and "company" are required.' },
        { status: 400 }
      );
    }

    // 4. Insert into Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert(validLeads)
      .select();

    if (error) {
      console.error('Supabase Error in CRM Webhook:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    // 5. Success Response
    return NextResponse.json({
      message: 'Leads processed successfully',
      inserted_count: data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('CRM Webhook Handler Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

// Support GET for simple health check or debugging (optional)
export async function GET() {
  return NextResponse.json({ 
    status: 'CRM Webhook endpoint is active',
    expected_method: 'POST',
    documentation: 'Send a POST request with JSON payload and Authorization Bearer token.'
  });
}
