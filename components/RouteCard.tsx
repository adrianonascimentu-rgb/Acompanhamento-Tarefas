'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, CheckCircle2, ChevronDown, WifiOff, Cloud } from 'lucide-react';
import { openInNativeGPS, getCurrentPosition } from '@/lib/navigation';
import { supabase } from '@/lib/supabaseClient';

interface RouteCardProps {
  task: {
    id: string;
    title: string;
    destination_address?: string | null;
    destination_lat?: number | null;
    destination_lng?: number | null;
    status: string;
    checkin_at?: string | null;
  };
  onStatusUpdate?: () => void;
}

// Utilitário para salvar check-in com suporte a offline (localStorage) e detecção de proximidade < 50m
export const saveCheckIn = async (
  id: string, 
  coords: { lat: number; lng: number },
  destinationCoords?: { lat?: number | null; lng?: number | null }
): Promise<{ isOffline: boolean; isFinalized?: boolean }> => {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const now = new Date().toISOString();

  // Cálculo de proximidade < 50m
  let isWithin50m = false;
  if (destinationCoords?.lat != null && destinationCoords?.lng != null) {
    const R = 6371000;
    const dLat = (destinationCoords.lat - coords.lat) * (Math.PI / 180);
    const dLon = (destinationCoords.lng - coords.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coords.lat * (Math.PI / 180)) * Math.cos(destinationCoords.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distMeters = R * c;
    if (distMeters < 50) {
      isWithin50m = true;
    }
  }

  // Se estiver online, envia direto pro Supabase
  if (isOnline) {
    try {
      // 1. Tenta atualizar na tabela 'deliveries' primeiro (mais provável para GPS/Rotas)
      const deliveryPayload: any = {
        lat: coords.lat,
        lng: coords.lng,
        driver_lat: coords.lat,
        driver_lng: coords.lng,
        current_lat: coords.lat,
        current_lng: coords.lng,
      };

      // O gatilho do Supabase define automaticamente 'Finalizada' se < 50m, 
      // mas também podemos antecipar no payload
      if (isWithin50m) {
        deliveryPayload.status = 'Finalizada';
        deliveryPayload.auto_finalized = true;
        deliveryPayload.finalized_at = now;
      } else {
        deliveryPayload.status = 'Em Andamento';
      }

      const { data: delivery, error: delError } = await supabase
        .from('deliveries')
        .update(deliveryPayload)
        .eq('id', id)
        .select();

      if (!delError && delivery && delivery.length > 0) {
        const wasFinalized = isWithin50m || delivery[0]?.status === 'Finalizada';
        return { isOffline: false, isFinalized: wasFinalized };
      }

      // 2. Se falhar ou não encontrar, tenta na tabela 'tasks'
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: isWithin50m ? 'Finalizada' : 'in_progress',
          checkin_lat: coords.lat,
          checkin_lng: coords.lng,
          checkin_at: now,
        })
        .eq('id', id);

      if (taskError) throw taskError;
      return { isOffline: false, isFinalized: isWithin50m };
    } catch (err) {
      console.warn('Falha na rede ou erro ao salvar check-in, enfileirando offline...', err);
    }
  }

  // Fallback offline: salva na fila local
  if (typeof window !== 'undefined') {
    try {
      const payload = {
        id,
        lat: coords.lat,
        lng: coords.lng,
        at: now,
        isFinalized: isWithin50m
      };
      const pendingQueue = JSON.parse(localStorage.getItem('pending_checkins') || '[]');
      const filtered = pendingQueue.filter((item: any) => item.id !== id);
      filtered.push(payload);
      localStorage.setItem('pending_checkins', JSON.stringify(filtered));
    } catch (storageErr) {
      console.error('Erro ao acessar localStorage:', storageErr);
    }
  }

  return { isOffline: true, isFinalized: isWithin50m };
};

// Sincronizador de pendências offline ao reconectar
export const syncPendingCheckins = async () => {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  try {
    const raw = localStorage.getItem('pending_checkins');
    if (!raw) return;

    const pendingQueue: any[] = JSON.parse(raw);
    if (!Array.isArray(pendingQueue) || pendingQueue.length === 0) return;

    for (const item of pendingQueue) {
      // Tenta deliveries
      const { data } = await supabase.from('deliveries').update({
        status: 'Em Andamento',
        lat: item.lat,
        lng: item.lng,
      }).eq('id', item.id).select();

      // Se não era delivery, tenta tasks
      if (!data || data.length === 0) {
        await supabase.from('tasks').update({
          status: 'in_progress',
          checkin_lat: item.lat,
          checkin_lng: item.lng,
          checkin_at: item.at,
        }).eq('id', item.id);
      }
    }

    localStorage.removeItem('pending_checkins');
  } catch (err) {
    console.error('Erro ao sincronizar check-ins pendentes:', err);
  }
};

// Registra listener global para reconexão
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    await syncPendingCheckins();
  });
}

export default function RouteCard({ task, onStatusUpdate }: RouteCardProps) {
  const [loading, setLoading] = useState(false);
  const [showGPSChoice, setShowGPSChoice] = useState(false);
  const [isPendingLocal, setIsPendingLocal] = useState(false);

  // Verifica se esta tarefa tem checkin pendente no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('pending_checkins');
        if (raw) {
          const queue = JSON.parse(raw);
          const found = queue.some((item: any) => item.id === task.id);
          setIsPendingLocal(found);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [task.id]);

  // Registrar Chegada com Geolocalização e suporte Offline
  const handleCheckIn = async () => {
    setLoading(true);
    try {
      // 1. Obter posição exata via satélite do celular
      const coords = await getCurrentPosition();

      // 2. Salvar check-in com coordenadas do destino para validação de proximidade (< 50m)
      const result = await saveCheckIn(task.id, coords, {
        lat: task.destination_lat,
        lng: task.destination_lng
      });

      if (result.isOffline) {
        setIsPendingLocal(true);
        if (result.isFinalized) {
          alert('Destino alcançado (< 50m)! O check-in offline foi salvo e a entrega será marcada como Finalizada.');
        } else {
          alert('Conexão indisponível! O check-in foi salvo localmente e será sincronizado automaticamente quando a internet voltar.');
        }
      } else {
        setIsPendingLocal(false);
        if (result.isFinalized) {
          alert('🎉 Destino alcançado (< 50m)! A entrega foi FINALIZADA automaticamente com sucesso via validação de GPS.');
        } else {
          alert('Check-in realizado com sucesso com validação de GPS!');
        }
      }

      if (onStatusUpdate) onStatusUpdate();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao capturar localização. Verifique as permissões de GPS.');
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = task.status === 'completed' || task.status === 'entregue' || task.status === 'Finalizada';
  const hasCheckin = !!task.checkin_at || isPendingLocal;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm mb-3 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
      {/* Título e Endereço */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">
            {task.title}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center mt-1">
            <MapPin className="w-3.5 h-3.5 mr-1 text-red-500 shrink-0" />
            <span className="truncate">{task.destination_address || 'Endereço não informado'}</span>
          </p>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${
            isCompleted
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
              : hasCheckin
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
          }`}
        >
          {isCompleted ? 'Concluído' : hasCheckin ? 'Em Andamento' : 'Pendente'}
        </span>
      </div>

      {/* Indicador de Check-in ou Fila Offline */}
      {isPendingLocal ? (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Salvo offline (aguardando conexão para sincronizar)</span>
        </div>
      ) : task.checkin_at ? (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>Check-in registrado às {new Date(task.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      ) : null}

      {/* Botões de Ação para a Equipe de Rua */}
      <div className="relative grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        {/* Botão para Abrir no Google Maps / Waze */}
        <div className="relative">
          <div className="flex rounded-lg overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() =>
                openInNativeGPS(
                  task.destination_lat,
                  task.destination_lng,
                  'google',
                  task.destination_address
                )
              }
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span>Navegar (GPS)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowGPSChoice(!showGPSChoice)}
              className="bg-blue-700 hover:bg-blue-800 text-white px-2 py-2.5 active:bg-blue-900 transition-colors cursor-pointer border-l border-blue-500/40"
              title="Escolher aplicativo de GPS"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Menu Dropdown de escolha GPS (Google Maps ou Waze) */}
          {showGPSChoice && (
            <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 z-20 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowGPSChoice(false);
                  openInNativeGPS(task.destination_lat, task.destination_lng, 'google', task.destination_address);
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center gap-2"
              >
                🗺️ Google Maps
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGPSChoice(false);
                  openInNativeGPS(task.destination_lat, task.destination_lng, 'waze', task.destination_address);
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center gap-2"
              >
                🚙 Waze
              </button>
            </div>
          )}
        </div>

        {/* Botão para Registrar Chegada */}
        <button
          type="button"
          onClick={handleCheckIn}
          disabled={loading || isCompleted}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">
            {loading ? 'Obtendo GPS...' : hasCheckin ? 'Atualizar Check-in' : 'Fazer Check-in'}
          </span>
        </button>
      </div>
    </div>
  );
}
