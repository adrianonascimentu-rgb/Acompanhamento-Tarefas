// lib/navigation.ts

// 1. Abre a rota diretamente no aplicativo de GPS instalado no celular (Google Maps ou Waze)
export function openInNativeGPS(
  lat?: number | null, 
  lng?: number | null, 
  app: 'google' | 'waze' = 'google',
  fallbackAddress?: string | null
) {
  if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
    if (app === 'waze') {
      window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }
    return;
  }

  if (fallbackAddress) {
    const encoded = encodeURIComponent(fallbackAddress);
    if (app === 'waze') {
      window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
    }
  }
}

// 2. Captura a geolocalização atual do celular do colaborador com maior resiliência
export async function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocalização não é suportada por este dispositivo/navegador.');
  }

  const getPos = (options: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  };

  try {
    // Tentativa 1: Alta precisão (Preferencial para entregas)
    const position = await getPos({ 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 30000 // Aceita posição de até 30 segundos atrás se já disponível
    });
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (error: any) {
    // Se o erro for de permissão negada, não adianta tentar novamente
    // 1 = PERMISSION_DENIED
    if (error.code === 1) {
      throw new Error('Permissão de GPS negada. Por favor, clique no ícone de cadeado na barra de endereços do seu navegador e permita a "Localização". Se estiver no celular, verifique as configurações de privacidade do sistema (Android/iOS) e do navegador.');
    }

    // Tentativa 2: Baixa precisão (Fallback caso o hardware de GPS demore a responder)
    try {
      const position = await getPos({ 
        enableHighAccuracy: false, 
        timeout: 15000, 
        maximumAge: 60000 
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (fallbackError: any) {
      let msg = 'Erro ao obter localização.';
      // 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      if (fallbackError.code === 2) {
        msg = 'Sinal de GPS indisponível no momento. Certifique-se de que o GPS está ligado e você tem uma visão clara do céu.';
      } else if (fallbackError.code === 3) {
        msg = 'Tempo esgotado ao buscar sinal do GPS. Tente novamente em um local mais aberto ou com melhor conexão.';
      }
      throw new Error(msg);
    }
  }
}
