'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Users, CheckCircle2, MapPin, Radio, RefreshCw, Clock, Truck, Navigation } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getTodayLocalDateString } from '@/lib/utils';
import { getNeighborhoodCoords } from '@/lib/neighborhoodCoords';

// Importação dinâmica do mapa para evitar erros de SSR no Next.js
const LiveMap = dynamic(() => import('@/components/LiveMap'), { 
  ssr: false,
  loading: () => (
    <div className="h-[360px] sm:h-[480px] w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 flex flex-col items-center justify-center text-xs text-zinc-500 p-4 text-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
      <span className="font-medium">Carregando mapa interativo e rotas em tempo real...</span>
    </div>
  )
});

interface DashboardTask {
  id: string;
  title: string;
  status: string;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkin_at: string;
  assigned_to: string;
  profiles?: { name?: string; image_url?: string };
  source?: 'task' | 'delivery';
  route?: [number, number][];
  address?: string;
  neighborhood?: string;
  city?: string;
  product?: string;
}

export function LiveDashboardView() {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [missingTables, setMissingTables] = useState<string[]>([]);

  // Carregar dados dos check-ins do dia de ambas as tabelas (tasks e deliveries)
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const todayStr = getTodayLocalDateString();
      const currentMissing: string[] = [];
      
      // 1. Buscar check-ins na tabela de tarefas (tasks)
      const tasksPromise = supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          checkin_lat,
          checkin_lng,
          checkin_at,
          assigned_to,
          collaborator_id,
          due_date,
          address,
          neighborhood,
          city,
          profiles:assigned_to (name, image_url)
        `)
        .or(`due_date.eq.${todayStr},status.eq.Em Progresso,status.eq.Pendente`)
        .neq('status', 'Concluída')
        .order('checkin_at', { ascending: false });

      // 2. Buscar check-ins na tabela de entregas (deliveries) com rota e endereço de destino
      const deliveriesPromise = supabase
        .from('deliveries')
        .select(`
          id,
          product,
          status,
          lat,
          lng,
          created_at,
          updated_at,
          driver,
          driver_id,
          date,
          address,
          neighborhood,
          city,
          route
        `)
        .or(`date.eq.${todayStr},status.eq.Em Andamento,status.eq.Pendente`)
        .neq('status', 'Finalizada');

      const [tasksResult, deliveriesResult] = await Promise.all([tasksPromise, deliveriesPromise]);

      if (tasksResult.error && (tasksResult.error.code === '42P01' || tasksResult.error.message?.includes('not found'))) {
        currentMissing.push('tasks');
      }
      
      if (deliveriesResult.error && (deliveriesResult.error.code === '42P01' || deliveriesResult.error.message?.includes('not found'))) {
        currentMissing.push('deliveries');
      }

      setMissingTables(currentMissing);

      let unifiedTasks: DashboardTask[] = [];

      // Processar tarefas
      if (tasksResult.data && Array.isArray(tasksResult.data)) {
        unifiedTasks = [...unifiedTasks, ...tasksResult.data.map((t: any) => {
          let lat = typeof t.checkin_lat === 'number' && !isNaN(t.checkin_lat) ? t.checkin_lat : null;
          let lng = typeof t.checkin_lng === 'number' && !isNaN(t.checkin_lng) ? t.checkin_lng : null;

          if ((lat === null || lng === null) && (t.neighborhood || t.city)) {
            const coords = getNeighborhoodCoords(t.neighborhood, t.city);
            if (coords) {
              lat = coords[0];
              lng = coords[1];
            }
          }

          const fullAddr = [t.address, t.neighborhood, t.city].filter(Boolean).join(', ');

          return {
            id: String(t.id),
            title: t.title || 'Tarefa sem título',
            status: t.status || 'Pendente',
            checkin_lat: lat,
            checkin_lng: lng,
            checkin_at: t.checkin_at || new Date().toISOString(),
            assigned_to: t.assigned_to || t.collaborator_id || String(t.id),
            profiles: Array.isArray(t.profiles) ? t.profiles[0] : t.profiles,
            source: 'task' as const,
            address: fullAddr || undefined,
            neighborhood: t.neighborhood,
            city: t.city
          };
        })];
      }

      // Processar entregas (Caminhões em rota)
      if (deliveriesResult.data && Array.isArray(deliveriesResult.data)) {
        unifiedTasks = [...unifiedTasks, ...deliveriesResult.data.map((d: any) => {
          let lat = typeof d.lat === 'number' && !isNaN(d.lat) && d.lat !== 0 ? d.lat : null;
          let lng = typeof d.lng === 'number' && !isNaN(d.lng) && d.lng !== 0 ? d.lng : null;

          if ((lat === null || lng === null) && (d.neighborhood || d.city)) {
            const coords = getNeighborhoodCoords(d.neighborhood, d.city);
            if (coords) {
              lat = coords[0];
              lng = coords[1];
            }
          }

          const fullAddr = [d.address, d.neighborhood, d.city].filter(Boolean).join(', ');

          return {
            id: `delivery-${d.id}`,
            title: `Entrega: ${d.product || 'Mercadoria'}`,
            status: d.status || 'Em Andamento',
            checkin_lat: lat,
            checkin_lng: lng,
            checkin_at: d.updated_at || d.created_at || new Date().toISOString(),
            assigned_to: d.driver_id || `driver-${d.id}`,
            profiles: { name: d.driver || 'Motorista / Entregador' },
            source: 'delivery' as const,
            route: d.route,
            address: fullAddr || (d.neighborhood ? `Bairro ${d.neighborhood}` : 'Endereço registrado na entrega'),
            neighborhood: d.neighborhood,
            city: d.city,
            product: d.product
          };
        })];
      }

      // Ordenar por horário de atualização mais recente
      unifiedTasks.sort((a, b) => {
        const timeA = a.checkin_at ? new Date(a.checkin_at).getTime() : 0;
        const timeB = b.checkin_at ? new Date(b.checkin_at).getTime() : 0;
        return timeB - timeA;
      });
      
      setTasks(unifiedTasks);
    } catch (err) {
      console.error('Erro ao buscar dados do dashboard:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Inscrição em Tempo Real para ambas as tabelas
    const tasksChannel = supabase
      .channel('tasks-changes-live-view')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => fetchDashboardData()
      )
      .subscribe();

    const deliveriesChannel = supabase
      .channel('deliveries-changes-live-view')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(deliveriesChannel);
    };
  }, [fetchDashboardData]);

  // Filtros de métricas
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const totalCheckIns = safeTasks.length;
  const activeCollaborators = new Set(safeTasks.map(t => t.assigned_to).filter(Boolean)).size;
  const activeTrucks = safeTasks.filter(t => t.source === 'delivery').length;
  const tasksWithGps = safeTasks.filter(t => typeof t.checkin_lat === 'number' && typeof t.checkin_lng === 'number');

  // Preparar pontos para o mapa
  const mapPoints = tasksWithGps.map(t => ({
    id: t.id,
    title: t.title,
    checkin_lat: t.checkin_lat!,
    checkin_lng: t.checkin_lng!,
    checkin_at: t.checkin_at,
    collaborator_name: t.profiles?.name || (t.source === 'delivery' ? 'Motorista do Caminhão' : 'Colaborador'),
    source: t.source,
    route: t.route,
    address: t.address,
    neighborhood: t.neighborhood,
    city: t.city
  }));

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-5 md:p-6 space-y-4 sm:space-y-6 pb-28 md:pb-12 transition-all">
      {/* Alertas de tabelas ausentes */}
      {missingTables.length > 0 && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/60 rounded-xl shrink-0">
            <Radio className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-bold">Atenção: Sistema de Rastreamento parcial</p>
            <p className="mt-0.5 opacity-90">
              As seguintes tabelas não foram encontradas no banco de dados: <strong>{missingTables.join(', ')}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Cabeçalho Responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              Painel Ao Vivo
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
              <Radio className="w-3 h-3 text-emerald-500 animate-pulse" /> Tempo Real
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
            Localização em tempo real dos entregadores, veículo em deslocamento e endereço de destino como referência.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/deliveries"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 px-3.5 py-2.5 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all shadow-2xs active:scale-95"
          >
            <Truck className="w-4 h-4" />
            <span>Gerenciar Entregas</span>
          </Link>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cartões de Estatísticas Rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Caminhões em Rota</p>
            <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">{activeTrucks}</p>
          </div>
          <div className="p-2.5 sm:p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-200/50">
            <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Equipe no Terreno</p>
            <p className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-0.5">{activeCollaborators}</p>
          </div>
          <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Pontos Registrados</p>
            <p className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-0.5">{totalCheckIns}</p>
          </div>
          <div className="p-2.5 sm:p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400 border border-purple-200/50">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-xs col-span-2 lg:col-span-1">
          <div>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Última Atualização</p>
            <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {safeTasks.length > 0 && safeTasks[0].checkin_at 
                ? new Date(safeTasks[0].checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                : 'Sem registros'}
            </p>
          </div>
          <div className="p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-200/50">
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* Mapa Interativo */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-xs space-y-3 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-500 shrink-0" />
              Mapa em Tempo Real • Localização & Endereço de Entrega
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              O ícone do caminhão indica a posição atual e o endereço cadastrado é usado como referência do local de entrega.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-xl border border-blue-200/60 dark:border-blue-800/50">
              <Truck size={13} className="text-blue-600 dark:text-blue-400 shrink-0" /> Caminhão em Rota
            </span>
            <span className="text-[11px] font-extrabold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
              {mapPoints.length} no mapa
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-[360px] sm:h-[480px] flex flex-col items-center justify-center text-xs text-zinc-500 gap-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Buscando pontos GPS e endereços das entregas...
          </div>
        ) : (
          <LiveMap points={mapPoints} />
        )}
      </div>

      {/* Lista/Feed de Atividades */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-xs transition-all">
        <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
          <h2 className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-500 shrink-0" />
            Caminhões em Deslocamento & Endereços de Entrega
          </h2>
          <span className="text-[10px] sm:text-xs text-zinc-400 font-medium">
            {safeTasks.length} registro{safeTasks.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="space-y-2.5">
          {safeTasks.map((task) => (
            <div 
              key={task.id} 
              className="p-3 sm:p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shrink-0 shadow-xs ${
                  task.source === 'delivery' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-emerald-600 text-white'
                }`}>
                  {task.source === 'delivery' ? (
                    <Truck size={20} />
                  ) : task.profiles?.image_url ? (
                    <img src={task.profiles.image_url} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    task.profiles?.name?.charAt(0)?.toUpperCase() || 'U'
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {task.profiles?.name || 'Motorista / Entregador'}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider ${
                      task.source === 'delivery' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/60' 
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60'
                    }`}>
                      {task.source === 'delivery' ? 'Caminhão em Rota' : 'Tarefa'}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                    {task.title}
                  </p>

                  {task.address && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700/80 p-2 rounded-xl font-medium mt-1">
                      <MapPin size={14} className="text-rose-500 shrink-0" />
                      <span className="truncate">
                        <strong className="text-zinc-800 dark:text-zinc-200">Endereço de Destino:</strong> {task.address}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-200/60 dark:border-zinc-700/50 shrink-0 gap-1">
                <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs font-bold">
                  {task.checkin_at ? new Date(task.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Horário não rep.'}
                </span>

                {typeof task.checkin_lat === 'number' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Localização Ativa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                    <Clock className="w-3.5 h-3.5" /> Endereço de Ref.
                  </span>
                )}
              </div>
            </div>
          ))}

          {safeTasks.length === 0 && !loading && (
            <div className="text-center py-12 text-xs text-zinc-500 dark:text-zinc-400 space-y-2 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <Truck className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600" />
              <p className="font-bold text-sm">Nenhuma entrega em andamento para hoje.</p>
              <p className="text-zinc-400">Cadastre ou agende novas entregas na aba de Gestão de Entregas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveDashboardView;
