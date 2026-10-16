import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) return auth.response;

    const { segment } = await req.json();
    if (!segment) {
      return NextResponse.json({ error: 'Segmento não informado' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave da API do Gemini não configurada no servidor.' }, { status: 500 });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Encontre 10 empresas reais para o segmento: ${segment} em João Pessoa, PB. Retorne os dados no formato JSON. Inclua nome da pessoa de contato, nome da empresa, e-mail, telefone, endereço e segmento.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              company: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              address: { type: Type.STRING },
              segment: { type: Type.STRING },
            },
            required: ['name', 'company', 'segment', 'email', 'phone'],
          },
        },
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || '[]';
    const cleanedJson = text.replace(/```json\n?|```/g, '').trim();
    const leads = JSON.parse(cleanedJson);

    return NextResponse.json({ leads });
  } catch (error: any) {
    console.error('Gemini leads search error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao buscar leads com IA' }, { status: 500 });
  }
}
