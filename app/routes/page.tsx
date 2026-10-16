'use client';

import { useEffect, useState } from 'react';
import { MapPin, CheckCircle, Clock, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import RouteCard, { syncPendingCheckins } from '@/components/RouteCard';
import { supabase } from '@/lib/supabaseClient';

interface TaskRoute {
  id: string;
  title: string;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  status: string;
  checkin_at?: string | null;
}

export default function RoutesPage() {
  const [tasks, setTasks] = useState<TaskRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar tarefas com rotas do colaborador logado
  const fetchRoutes = async () => {
    setLoading(true);
    setError(null);
    try {
      // Sincroniza checkins pendentes se estiver online
      await syncPendingCheckins();

      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      let userId = supabaseUser?.id;

      if (!userId) {
        // Fallback to localStorage session
        const savedUser = localStorage.getItem('user-data');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            userId = parsed.id;
          } catch (e) {}
        }
      }

      if (!userId) {
        setError('Usuário não autenticado.');
        setLoading(false);
        return;
      }

      // 1. Tenta buscar entregas atribuídas ao usuário logado (usando driver_id, courier_id ou collaborator_id)
      // Buscamos entregas que não foram finalizadas
      const { data: deliveries, error: fetchError } = await supabase
        .from('deliveries')
        .select('id, product, address, neighborhood, city, lat, lng, status')
        .or(`driver_id.eq.${userId},courier_id.eq.${userId},collaborator_id.eq.${userId}`)
        .neq('status', 'Finalizada')
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.warn('Erro ao buscar entregas específicas:', fetchError.message);
        
        // Fallback 1: Se falhar (ex: colunas de ID não existem), busca tarefas com GPS como antes
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id, title, destination_address, destination_lat, destination_lng, status, checkin_at')
          .eq('assigned_to', userId)
          .not('destination_lat', 'is', null)
          .order('created_at', { ascending: true });

        if (!tasksError && tasks && tasks.length > 0) {
          setTasks(tasks as any[]);
          return;
        }

        // Fallback 2: Se ainda não tiver nada, tenta buscar entregas pelo nome (caso driver_id não esteja preenchido)
        const { data: userProfile } = await supabase.from('profiles').select('name').eq('id', userId).single();
        if (userProfile?.name) {
          const { data: nameDeliveries } = await supabase
            .from('deliveries')
            .select('id, product, address, neighborhood, city, lat, lng, status')
            .eq('driver', userProfile.name)
            .neq('status', 'Finalizada');
          
          if (nameDeliveries && nameDeliveries.length > 0) {
            setTasks(nameDeliveries.map(d => ({
              id: d.id,
              title: d.product || 'Entrega',
              destination_address: [d.address, d.neighborhood, d.city].filter(Boolean).join(', '),
              destination_lat: d.lat,
              destination_lng: d.lng,
              status: d.status,
              checkin_at: null
            })));
            return;
          }
        }
      }

      if (deliveries && deliveries.length > 0) {
        setTasks(deliveries.map(d => ({
          id: d.id,
          title: d.product || 'Entrega',
          destination_address: [d.address, d.neighborhood, d.city].filter(Boolean).join(', '),
          destination_lat: d.lat,
          destination_lng: d.lng,
          status: d.status,
          checkin_at: null
        })));
      } else {
        // Se não houver entregas, tenta tarefas
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, destination_address, destination_lat, destination_lng, status, checkin_at')
          .eq('assigned_to', userId)
          .not('destination_lat', 'is', null)
          .order('created_at', { ascending: true });
        
        if (tasks && tasks.length > 0) {
          setTasks(tasks as any[]);
        } else {
          // Último recurso: ver todas as entregas do dia se for admin/gerente
          const { data: allToday } = await supabase
            .from('deliveries')
            .select('id, product, address, neighborhood, city, lat, lng, status')
            .neq('status', 'Finalizada')
            .limit(10);
          
          if (allToday && allToday.length > 0) {
            setTasks(allToday.map(d => ({
              id: d.id,
              title: d.product || 'Entrega',
              destination_address: [d.address, d.neighborhood, d.city].filter(Boolean).join(', '),
              destination_lat: d.lat,
              destination_lng: d.lng,
              status: d.status,
              checkin_at: null
            })));
          } else {
            setTasks([]);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar a rota do dia.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  // Métricas da rota
  const totalStops = tasks.length;
  const completedStops = tasks.filter(t => t.status === 'completed' || t.status === 'entregue').length;
  const pendingStops = totalStops - completedStops;

  return (
    <div className="max-w-md mx-auto p-4 pb-28 min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Rota do Dia
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sua lista de paradas e entregas
            </p>
          </div>
        </div>

        <button
          onClick={fetchRoutes}
          className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Atualizar rotas"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Card de Resumo de Progresso */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl text-center shadow-xs">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">Total</span>
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{totalStops}</span>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl text-center shadow-xs">
          <span className="text-xs text-amber-600 dark:text-amber-400 block flex items-center justify-center gap-1 font-medium">
            <Clock className="w-3 h-3" /> Pendentes
          </span>
          <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{pendingStops}</span>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 p-3 rounded-xl text-center shadow-xs">
          <span className="text-xs text-green-600 dark:text-green-400 block flex items-center justify-center gap-1 font-medium">
            <CheckCircle className="w-3 h-3" /> Feito
          </span>
          <span className="text-lg font-bold text-green-700 dark:text-green-300">{completedStops}</span>
        </div>
      </div>

      {/* Mensagens de estado */}
      {loading && (
        <div className="text-center py-10 text-xs text-zinc-500">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Carregando paradas da rota...
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs flex items-center gap-2 mb-4 border border-red-200 dark:border-red-900/50">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center shadow-xs">
          <MapPin className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nenhuma rota atribuída para hoje
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            As novas tarefas com endereço aparecerão aqui automaticamente.
          </p>
          <div className="mt-4">
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Consultar lista de tarefas &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Lista de Cards de Rota */}
      {!loading && tasks.map((task) => (
        <RouteCard 
          key={task.id} 
          task={task} 
          onStatusUpdate={fetchRoutes} 
        />
      ))}
    </div>
  );
}
