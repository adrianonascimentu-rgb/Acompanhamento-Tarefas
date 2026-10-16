import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

interface GeocodeQuery {
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

// In-memory geocode cache to reduce latency and respect provider limits
const geocodeCache = new Map<string, { lat: number; lng: number; formattedAddress: string }>();

function cleanAddressPart(str?: string): string {
  if (!str) return '';
  return str
    .replace(/^Avenida:\s*/i, 'Avenida ')
    .replace(/^Rua:\s*/i, 'Rua ')
    .replace(/n[º°o]\s*/gi, '')
    .replace(/-\s*(Hotel|Sem complento|Sem complemento|apto|casa|bloco|loja|galp[aã]o|fundos).*$/gi, '')
    .replace(/[.,;]+$/, '')
    .trim();
}

async function fetchFromNominatim(query: string): Promise<{ lat: number; lng: number; display_name: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout for geocoding

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AIStudio-Logistics-Platform/1.0 (delivery-routing-app)',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      },
      next: { revalidate: 86400 } // Cache for 24h in Next.js fetch cache
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    }
    return null;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('Geocoding request timed out for query:', query);
    } else {
      console.error('Geocoding fetch error:', err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) return auth.response;

    const body: GeocodeQuery = await req.json();
    const { address, neighborhood, city, state = 'Paraíba' } = body;

    const cleanedAddress = cleanAddressPart(address);
    const cleanedNeighborhood = (neighborhood || '').trim();
    const cleanedCity = (city || '').trim();

    if (!cleanedAddress && !cleanedNeighborhood && !cleanedCity) {
      return NextResponse.json({ error: 'Nenhum parâmetro de endereço fornecido' }, { status: 400 });
    }

    const cacheKey = `${cleanedAddress}|${cleanedNeighborhood}|${cleanedCity}|${state}`.toLowerCase();
    if (geocodeCache.has(cacheKey)) {
      return NextResponse.json({ success: true, ...geocodeCache.get(cacheKey), cached: true });
    }

    // Tiered search queries from most specific to broader
    const searchQueries: string[] = [];

    // Level 1: Full Address + Neighborhood + City + State + Brasil
    if (cleanedAddress && cleanedCity) {
      searchQueries.push(
        [cleanedAddress, cleanedNeighborhood, cleanedCity, state, 'Brasil'].filter(Boolean).join(', ')
      );
      // Level 1b: Address + City + State (sometimes neighborhood confuses Nominatim if spelled differently)
      searchQueries.push(
        [cleanedAddress, cleanedCity, state, 'Brasil'].filter(Boolean).join(', ')
      );
    }

    // Level 2: Neighborhood + City + State + Brasil
    if (cleanedNeighborhood && cleanedCity) {
      searchQueries.push(
        [cleanedNeighborhood, cleanedCity, state, 'Brasil'].filter(Boolean).join(', ')
      );
    }

    // Level 3: City + State + Brasil
    if (cleanedCity) {
      searchQueries.push(
        [cleanedCity, state, 'Brasil'].filter(Boolean).join(', ')
      );
    }

    let foundCoords: { lat: number; lng: number; display_name: string } | null = null;
    let queryUsed = '';

    for (const q of searchQueries) {
      try {
        const result = await fetchFromNominatim(q);
        if (result && !isNaN(result.lat) && !isNaN(result.lng)) {
          foundCoords = result;
          queryUsed = q;
          break;
        }
      } catch (err) {
        console.error(`Geocoding error for query "${q}":`, err);
      }
    }

    if (foundCoords) {
      const payload = {
        lat: foundCoords.lat,
        lng: foundCoords.lng,
        formattedAddress: foundCoords.display_name,
        queryUsed
      };
      geocodeCache.set(cacheKey, payload);
      return NextResponse.json({ success: true, ...payload });
    }

    // If city is João Pessoa region or not found, fallback to João Pessoa Center coordinates
    return NextResponse.json({
      success: false,
      fallback: true,
      lat: -7.1150,
      lng: -34.8631,
      formattedAddress: 'João Pessoa, PB, Brasil'
    });
  } catch (error: any) {
    console.error('API Geocode error:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no geocoding' }, { status: 500 });
  }
}
