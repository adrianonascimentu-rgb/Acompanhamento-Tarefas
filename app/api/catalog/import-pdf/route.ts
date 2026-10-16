import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { parseIdealSoftPdfText } from "@/lib/idealSoftPdfParser";
import { requireAuth } from "@/lib/serverAuth";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Helper for delay in retry
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for timeout on promises
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) return auth.response;

    let pdfBuffer: Buffer | null = null;
    let pdfBase64 = '';
    let mimeType = 'application/pdf';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { error: 'Nenhum arquivo PDF fornecido.' },
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
      pdfBase64 = pdfBuffer.toString('base64');
      mimeType = file.type || 'application/pdf';
    } else {
      const body = await req.json();
      if (!body.pdfBase64) {
        return NextResponse.json(
          { error: 'Nenhum base64 de PDF fornecido.' },
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      pdfBase64 = body.pdfBase64;
      pdfBuffer = Buffer.from(pdfBase64, 'base64');
      mimeType = body.mimeType || 'application/pdf';
    }

    // =========================================================================
    // STEP 1: Ultra-fast native PDF stream text parser (handles 100+ pages / 5000+ rows)
    // =========================================================================
    if (pdfBuffer && pdfBuffer.length > 0) {
      try {
        const { extractTextFromPdfBuffer } = await import('@/lib/pdfTextExtractor');
        const textResult = await extractTextFromPdfBuffer(pdfBuffer);
        const extractedText = textResult?.text || '';

        if (extractedText && extractedText.trim().length > 50) {
          const parsedProducts = parseIdealSoftPdfText(extractedText);

          if (parsedProducts.length > 0) {
            console.log(`[PDF Import] Parsed ${parsedProducts.length} items from ${textResult?.totalPages || 1} pages via PDF text engine.`);
            return NextResponse.json({
              success: true,
              count: parsedProducts.length,
              totalPages: textResult?.totalPages || 1,
              products: parsedProducts,
              engine: 'native-pdf-stream',
              timestamp: new Date().toISOString(),
            }, {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (pdfErr) {
        console.warn('[PDF Import] Native PDF text parsing error, falling back to Gemini AI:', pdfErr);
      }
    }

    // =========================================================================
    // STEP 2: Fallback to Gemini Multimodal Vision if native text layer wasn't found
    // =========================================================================
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave do Gemini API não configurada no servidor.' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é um extrator especialista de dados de relatórios e tabelas de catálogo/peças (ERP, Shop Control, relatórios de estoque, tabelas de preços, etc.).

Analise o documento PDF em anexo e extraia a lista completa de produtos/peças da tabela.

Para cada item/produto encontrado na tabela, retorne um objeto JSON com as seguintes propriedades:
- "code": Código do produto como string (OBRIGATÓRIO: remova qualquer caractere "#", sem espaços no início/fim). Ex: "353", "616", "956", "1147", "11802", "160601".
- "name": Nome ou descrição completa do produto em maiúsculas (ex: "CONCHA HOTEL N.09 ABC", "TUBO DE COBRE FLEXIVEL 5/16").
- "additionalCode": Código Adicional 1 / Referência / Código de Fábrica / Ref. Se não houver, utilize "-".
- "stock": Quantidade de estoque atual / Saldo (número float ou inteiro). Se vírgula for usada como separador decimal, converta para número com ponto.
- "manufacturer": Fabricante / Marca / Fornecedor (ex: "ABC", "DISTRIBUID", "FRIVEN", "ELGIN", "WHIRLPOOL", "FRICON", "BERMAR", "GASTROMAQ", "PROGAS", "VISA", etc.). Se não informado, "GERAL".
- "price": Preço de venda ou preço da tabela (número float, ex: 18.70, 152.90, 8369.00). Converta vírgula decimal para número.

Regras Estritas:
1. Extraia TODOS os produtos listados no documento sem omitir nenhum.
2. NUNCA inclua o caractere "#" nos códigos.
3. Retorne EXCLUSIVAMENTE um array JSON válido contendo os objetos de produtos.`;

    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.1-pro-preview',
      'gemini-flash-latest',
    ];

    let lastError: any = null;
    let responseText = '';

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const contents = [
            {
              role: 'user' as const,
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: pdfBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ];

          const config: any = {
            responseMimeType: 'application/json',
          };

          if (attempt === 1) {
            config.responseSchema = {
              type: Type.ARRAY,
              description: 'Lista de produtos extraídos do PDF',
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  name: { type: Type.STRING },
                  additionalCode: { type: Type.STRING },
                  stock: { type: Type.NUMBER },
                  manufacturer: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                },
                required: ['code', 'name', 'manufacturer', 'price', 'stock'],
              },
            };
          }

          const generatePromise = ai.models.generateContent({
            model,
            contents,
            config,
          });

          const response = await withTimeout(
            generatePromise,
            25000,
            `Tempo limite esgotado ao aguardar resposta do modelo ${model}`
          );

          if (response && response.text) {
            responseText = response.text;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Tentativa ${attempt} com modelo ${model} falhou:`, err?.message || err);
          await delay(300 * attempt);
        }
      }

      if (responseText) {
        break;
      }
    }

    if (!responseText) {
      throw lastError || new Error('Não foi possível obter resposta dos modelos de IA após tentativas.');
    }

    let parsedProducts: any[] = [];
    try {
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      parsedProducts = JSON.parse(cleaned);
      if (!Array.isArray(parsedProducts) && typeof parsedProducts === 'object') {
        const values = Object.values(parsedProducts);
        const foundArray = values.find((v) => Array.isArray(v));
        if (foundArray && Array.isArray(foundArray)) {
          parsedProducts = foundArray;
        } else {
          parsedProducts = [parsedProducts];
        }
      }
    } catch (e) {
      console.error('Erro ao fazer JSON.parse da resposta:', responseText, e);
      return NextResponse.json(
        { error: 'Formato de resposta inesperado da IA. Tente novamente.', rawText: responseText },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sanitized = parsedProducts
      .map((p: any) => ({
        code: String(p.code || '').replace(/#/g, '').trim(),
        name: String(p.name || '').trim().toUpperCase(),
        additionalCode: String(p.additionalCode || '-').trim(),
        stock: typeof p.stock === 'number' ? p.stock : (parseFloat(String(p.stock || '0').replace(',', '.')) || 0),
        manufacturer: String(p.manufacturer || 'GERAL').trim().toUpperCase(),
        price: typeof p.price === 'number' ? p.price : (parseFloat(String(p.price || '0').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0),
      }))
      .filter((p: any) => p.code && p.name);

    if (sanitized.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum produto válido foi identificado na tabela do arquivo fornecido.' },
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return NextResponse.json({
      success: true,
      count: sanitized.length,
      products: sanitized,
      engine: 'gemini-ai',
      timestamp: new Date().toISOString(),
    }, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro no processamento do PDF:', error);
    const errorMessage = error?.message || 'Erro interno no servidor ao processar o arquivo PDF.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
