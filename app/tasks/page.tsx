'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Search, User, Send, Calendar, ClipboardList, Users, Folder, Settings, X, LayoutGrid, List as ListIcon, Edit2, Trash2, MoreVertical, Bell, BellOff, CheckCircle2, ChevronDown, Flag, Plus, Columns as KanbanIcon, Clock, Filter, AlertCircle, Sun, Moon, MessageSquare, Package, HelpCircle, ListChecks, History, Link as LinkIcon, MapPin, Navigation } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { useUI } from '@/hooks/useUI';
import { TaskCard } from '@/components/TaskCard';
import { VoiceSearch } from '@/components/ui/VoiceSearch';
import { TasksMapView } from '@/components/tasks/TasksMapView';
import { calculateDistanceKm, formatDistance, getTaskCoords } from '@/lib/distance';
import { CompletionFeedback } from '@/components/CompletionFeedback';
import { DemandModal } from '@/components/dashboard/DemandModal';
import PushNotificationManager from '@/components/PushNotificationManager';
import { LoginForm } from '@/components/auth/LoginForm';
import { useDataPrefetch } from '@/hooks/useDataPrefetch';
import { getCurrentPosition } from '@/lib/navigation';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isWithinInterval,
  startOfDay,
  addDays,
  isPast,
  differenceInHours
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AnimatedCheckmark = ({ size = 64, className = "", strokeWidth = 3, animate = true }: { size?: number, className?: string, strokeWidth?: number, animate?: boolean }) => {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={animate ? "initial" : "animate"}
      animate="animate"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        variants={{
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 }
        }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
      <motion.path
        d="m9 12 2 2 4-4"
        variants={{
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 }
        }}
        transition={{ duration: 0.3, delay: 0.4, ease: "easeInOut" }}
      />
    </motion.svg>
  );
};

const triggerConfetti = () => {
  const duration = 3 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    // since particles fall down, start a bit higher than random
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);
};

import { DragDropContext, Draggable, DropResult } from '@hello-pangea/dnd';
import { StrictModeDroppable } from '@/components/StrictModeDroppable';

const filters = ['Todas', 'Urgente', 'Alta', 'Média', 'Baixa', 'Em Andamento', 'Pendente', 'Concluída', 'Atrasadas', 'Vencendo em Breve'];

const priorityMeanings: Record<string, string> = {
  'Urgente': 'Atenção imediata, impacto crítico.',
  'Alta': 'Prioridade elevada, concluir o quanto antes.',
  'Média': 'Importante, mas com prazo flexível.',
  'Baixa': 'Rotina ou melhoria, sem urgência imediata.'
};

const MOCK_TASKS = [
  {
    id: 1,
    title: 'Finalizar Relatório Mensal',
    description: 'Preparar o relatório de performance do mês para a diretoria.',
    due: 'Hoje',
    due_date: new Date().toISOString().split('T')[0],
    priority: 'Alta',
    progress: 75,
    status: 'Em Andamento',
    assignees: [{ name: 'Carlos' }, { name: 'Mariana' }],
    category: 'Gerência',
    task_type: 'Padrão'
  },
  {
    id: 2,
    title: 'Revisão de Social Media',
    description: 'Revisar os posts da próxima semana e aprovar criativos.',
    due: 'Amanhã',
    due_date: addDays(new Date(), 1).toISOString().split('T')[0],
    priority: 'Média',
    progress: 30,
    status: 'Pendente',
    assignees: [{ name: 'Ana' }],
    category: 'Marketing',
    task_type: 'Social Media'
  },
  {
    id: 3,
    title: 'Inventário de Estoque',
    description: 'Contagem sistemática de todos os itens do setor B.',
    due: '20/05/2026',
    due_date: '2026-05-20',
    priority: 'Urgente',
    progress: 100,
    status: 'Concluída',
    assignees: [{ name: 'Roberto' }],
    category: 'Logística',
    task_type: 'Estoque'
  }
];

import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatLocalDate, parseLocalDate } from '@/lib/utils';
import TaskComments from '@/components/tasks/TaskComments';
import DemandDetailsModal from '@/components/tasks/DemandDetailsModal';
import { ProgressBar } from '@/components/tasks/ProgressBar';
import { DateFilterSelect } from '@/components/DateFilterSelect';
import { subWeeks, startOfYear, endOfYear } from 'date-fns';

export const dynamic = 'force-dynamic';

function TasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams?.get('filter');
  
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [progressFilter, setProgressFilter] = useState('Todas');

  React.useEffect(() => {
    if (filterParam) {
      if (['Urgente', 'Alta', 'Média', 'Baixa'].includes(filterParam)) {
        setPriorityFilter(filterParam);
      } else if (['Em Andamento', 'Pendente', 'Concluída', 'Atrasadas'].includes(filterParam)) {
        setProgressFilter(filterParam === 'Atrasadas' ? 'Atrasada' : filterParam);
      }
    }
  }, [filterParam]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map' | 'calendar' | 'kanban'>('grid');
  const [showNearby, setShowNearby] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const handleToggleNearby = async () => {
    if (showNearby) {
      setShowNearby(false);
      return;
    }

    if (userCoords) {
      setShowNearby(true);
      setTaskToggleFilter('pending');
      showToast('Tarefas pendentes ordenadas por proximidade GPS.', 'info');
      return;
    }

    setLoadingGeo(true);
    try {
      const coords = await getCurrentPosition();
      setUserCoords(coords);
      setShowNearby(true);
      setTaskToggleFilter('pending');
      showToast('Localização obtida! Tarefas ordenadas por proximidade.', 'success');
    } catch (err: any) {
      console.warn('Geolocation error:', err.message);
      const fallbackCoords = { lat: -23.55052, lng: -46.633308 };
      setUserCoords(fallbackCoords);
      setShowNearby(true);
      setTaskToggleFilter('pending');
      showToast(err.message || 'Erro ao obter localização. Usando posição estimada.', 'warning');
    } finally {
      setLoadingGeo(false);
    }
  };

  React.useEffect(() => {
    const viewParam = searchParams?.get('view');
    if (viewParam === 'kanban' || viewParam === 'grid' || viewParam === 'list' || viewParam === 'map' || viewParam === 'calendar') {
      setViewMode(viewParam as any);
    }
  }, [searchParams]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  React.useEffect(() => {
    const searchParam = searchParams?.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
      setShowSearch(true);
    }
  }, [searchParams]);
  const [editingDescription, setEditingDescription] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState<string>('');

  const handleTaskSelection = (taskId: string | number | null) => {
    setSelectedTaskId(taskId ? taskId.toString() : null);
  };

  useEffect(() => {
    const handleHashChange = () => {
      // Hash change handling removed
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 30;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { isAdmin, user, role, isAuthenticated, isLoading: roleLoading, login } = useRole();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { getCachedTasks, getCachedCollaborators } = useDataPrefetch();
  const { notifications, unreadCount, markAsRead, clearAll, createNotification } = useNotifications();
  const { showToast, showConfirm } = useUI();
  const [pushTableMissing, setPushTableMissing] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [columnMissing, setColumnMissing] = useState(false);
  const [rlsError, setRlsError] = useState(false);
  const [selectedCollabId, setSelectedCollabId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [dateFilter, setDateFilter] = useState('Todas as Datas');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'assigned' | 'demands' | 'history'>('mine');

  useEffect(() => {
    if (!roleLoading) {
      if (isAdmin && activeTab === 'mine') {
        setActiveTab('all');
      } else if (!isAdmin && activeTab === 'all') {
        setActiveTab('mine');
      }
    }
  }, [isAdmin, roleLoading]);
  const [demands, setDemands] = useState<any[]>([]);
  const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
  const [loadingDemands, setLoadingDemands] = useState(false);
  const [taskToggleFilter, setTaskToggleFilter] = useState<'pending' | 'completed'>('pending');
  const [groupBy, setGroupBy] = useState<'status' | 'assignee'>('status');
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<any | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collabSearchTerm, setCollabSearchTerm] = useState('');
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [creatingDemandId, setCreatingDemandId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'none' | 'due_date_asc' | 'due_date_desc' | 'priority'>('none');
  const [pushEnabled, setPushEnabled] = useState(false);
  const isConfigured = 
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
  const offsetRef = useRef(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  const ViewSwitcher = () => (
    <div className={`flex p-1 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-900/90 border border-slate-800' : 'bg-slate-100 border border-slate-200/60'}`}>
      {[
        { id: 'grid', icon: LayoutGrid, label: 'Grelha' },
        { id: 'list', icon: ListIcon, label: 'Lista' },
        { id: 'map', icon: MapPin, label: 'Mapa' },
        { id: 'kanban', icon: KanbanIcon, label: 'Kanban' },
        { id: 'calendar', icon: Calendar, label: 'Calendário' }
      ].map((mode) => (
        <button
          key={mode.id}
          onClick={() => setViewMode(mode.id as any)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            viewMode === mode.id
              ? (isDarkMode ? 'bg-slate-800 text-blue-400 shadow-xs' : 'bg-white text-blue-600 shadow-xs')
              : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
          }`}
        >
          <mode.icon size={13} />
          <span className="hidden xs:inline">{mode.label}</span>
        </button>
      ))}
    </div>
  );

  const fetchDemands = useCallback(async () => {
    if (!user?.id) return;
    setLoadingDemands(true);
    try {
      let query = supabase
        .from('demands')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If not admin or manager, show only their own demands
      if (!isAdmin && role !== 'gerente') {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setDemands(data || []);
    } catch (error: any) {
      console.error('Error fetching demands:', error?.message || JSON.stringify(error));
      // Since demands is a newly added table, any error here is highly likely due to the table missing.
      setTableMissing(true);
    } finally {
      setLoadingDemands(false);
    }
  }, [isAdmin, role, user?.id]);

  useEffect(() => {
    if (activeTab === 'demands') {
      fetchDemands();
    }
  }, [activeTab, fetchDemands]);

  const handleUpdateDemandStatus = async (demandId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('demands')
        .update({ status: newStatus })
        .eq('id', demandId);
      
      if (error) throw error;
      setDemands(prev => prev.map(d => d.id === demandId ? { ...d, status: newStatus } : d));
      showToast('Status da demanda atualizado!', 'success');
    } catch (error: any) {
      console.error('Error updating demand status:', error.message || error);
      showToast('Erro ao atualizar status.', 'error');
    }
  };

  const handleDeleteDemand = async (demandId: string) => {
    showConfirm({
      title: 'Excluir Demanda',
      message: 'Tem certeza que deseja excluir esta demanda?',
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('demands').delete().eq('id', demandId);
          if (error) throw error;
          setDemands(prev => prev.filter(d => d.id !== demandId));
          showToast('Demanda excluída!', 'success');
        } catch (error: any) {
          console.error('Error deleting demand:', error.message || error);
          showToast('Erro ao excluir demanda.', 'error');
        }
      }
    });
  };

  const renderDemands = () => {
    if (loadingDemands) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="size-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando Demandas...</p>
        </div>
      );
    }

    if (demands.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="size-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
            <MessageSquare size={40} className="text-slate-300" />
          </div>
          <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {(!isAdmin && role !== 'gerente') ? 'Você ainda não enviou demandas' : 'Nenhuma demanda encontrada'}
          </h3>
          <p className="text-slate-500 max-w-sm">
            {(!isAdmin && role !== 'gerente') 
              ? 'Todas as demandas que você criar a partir de tarefas de estoque aparecerão aqui.'
              : 'As demandas enviadas pelos colaboradores aparecerão aqui para revisão.'}
          </p>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {demands.map((demand, idx) => (
            <motion.div
              key={demand.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-6 rounded-[32px] border shadow-sm relative overflow-hidden group cursor-pointer transition-all hover:shadow-md ${
                isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-slate-300'
              }`}
              onClick={() => setSelectedDemand(demand)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    demand.category === 'sugestão' ? 'bg-blue-100 text-blue-600' :
                    demand.category === 'veiculo' ? 'bg-amber-100 text-amber-600' :
                    demand.category === 'rotinas' ? 'bg-emerald-100 text-emerald-600' :
                    demand.category === 'pedido de material' ? 'bg-purple-100 text-purple-600' :
                    demand.category === 'contagem' ? 'bg-rose-100 text-rose-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {demand.category === 'sugestão' ? <MessageSquare size={18} /> :
                     demand.category === 'veiculo' ? <Clock size={18} /> :
                     demand.category === 'rotinas' ? <ClipboardList size={18} /> :
                     demand.category === 'pedido de material' ? <Package size={18} /> :
                     demand.category === 'contagem' ? <ListChecks size={18} /> :
                     <HelpCircle size={18} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categoria</p>
                    <p className={`text-xs font-bold capitalize ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{demand.category}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                  demand.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {demand.status === 'pending' ? 'Pendente' : 'Revisado'}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Colaborador</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <p className="text-sm font-bold text-blue-600">{demand.user_name}</p>
                  {demand.origin_task_id && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const task = tasks.find(t => t.id === demand.origin_task_id);
                        if (task) setSelectedTaskId(task.id);
                        else showToast('Tarefa original não encontrada ou já concluída.', 'info');
                      }}
                      className="text-[9px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-200 transition-colors flex items-center gap-1"
                    >
                      <LinkIcon size={8} />
                      Ver Tarefa Origem
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Conteúdo</p>
                <p className={`text-sm leading-relaxed italic ${isDarkMode ? 'text-slate-300' : 'text-slate-900'}`}>&quot;{demand.content}&quot;</p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-medium">
                  {new Date(demand.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Link href={`/tasks/new?title=${encodeURIComponent(`Demanda: ${demand.category}`)}&description=${encodeURIComponent(`${demand.content}\n\n---\nSolicitado por: ${demand.user_name}`)}&taskType=${encodeURIComponent(
                        demand.category === 'estoque' || demand.category === 'pedido de material' || demand.category === 'contagem' ? 'Estoque' :
                        demand.category === 'rotinas' ? 'Rotina' : 'Outros'
                      )}&origin_demand_id=${demand.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                      title="Criar Tarefa a partir desta demanda"
                    >
                      <ClipboardList size={18} />
                    </Link>
                  )}
                  {demand.status === 'pending' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateDemandStatus(demand.id, 'reviewed');
                      }}
                      className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                      title="Marcar como Revisado"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateDemandStatus(demand.id, 'pending');
                      }}
                      className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
                      title="Marcar como Pendente"
                    >
                      <Clock size={18} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDemand(demand.id);
                    }}
                    className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const triggerCompletionAnimation = (taskId: string) => {
    setCompletedTaskIds(prev => [...prev, taskId.toString()]);
    triggerConfetti();
    setTimeout(() => {
      setCompletedTaskIds(prev => prev.filter(id => id !== taskId.toString()));
    }, 2500);
  };

  const toggleTaskExpansion = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setExpandedTaskIds(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  React.useEffect(() => {
    async function fetchCollaborators() {
      const cached = getCachedCollaborators();
      if (Array.isArray(cached) && cached.length > 0) {
        setCollaborators(cached);
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, type')
          .not('type', 'eq', 'entregador')
          .not('role', 'ilike', '%entrega%')
          .order('name');
        
        if (error) {
          if (error.code === '42501') {
            setRlsError(true);
          }
          if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
            console.warn('Política recursiva (42P17) em profiles detectada. Ativando rota de contingência /api/collaborators...');
            try {
              const res = await fetch('/api/collaborators');
              const json = await res.json();
              if (json?.collaborators?.length) {
                const filtered = json.collaborators.filter((c: any) => 
                  c.type !== 'entregador' && !c.role?.toLowerCase()?.includes('entrega')
                );
                setCollaborators(filtered);
                return;
              }
            } catch (apiErr) {
              console.warn('Falha no fallback de colaboradores:', apiErr);
            }
            setCollaborators([]);
            return;
          }
          if (error.code === '42P01' || error.code === 'PGRST205') {
            console.warn('Aviso: A tabela "profiles" não foi encontrada no Supabase.');
            setCollaborators([]);
            return;
          }
          if (error.message === 'Failed to fetch' || error.message?.includes('Failed to fetch') || error.message?.includes('TypeError')) {
            setCollaborators([]);
            return;
          }
          console.error('Supabase error fetching collaborators:', error.message, error.code);
          return;
        }
        setCollaborators(data || []);
      } catch (err: any) {
        if (err?.message === 'Failed to fetch' || err?.message?.includes('Failed to fetch') || err instanceof TypeError) {
          return;
        }
        console.error('Unexpected error fetching collaborators:', err?.message || err);
      }
    }
    fetchCollaborators();
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const savedPush = localStorage.getItem('push_enabled');
      if (savedPush === 'true' && Notification.permission === 'granted') {
        setPushEnabled(true);
      }
    }
  }, []);

  useEffect(() => {
    const checkPushTable = async () => {
      if (!isAdmin) return;
      const { error } = await supabase.from('push_subscriptions').select('id').limit(1);
      if (error && (error.message?.includes('relation "push_subscriptions" does not exist') || error.code === 'P0001')) {
        setPushTableMissing(true);
      }
    };
    checkPushTable();
  }, [isAdmin]);

  const fetchTasks = useCallback(async (isLoadMore = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    if (!user?.id) {
       // Only stop loading if we've waited reasonable time or if role loading is finished
       if (!roleLoading) setLoading(false);
       return;
    }
    
    try {
      setLoading(true);
      if (!isConfigured) {
        setTasks(MOCK_TASKS);
        setLoading(false);
        setHasMore(false);
        return;
      }
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        const cached = getCachedTasks();
        if (Array.isArray(cached) && cached.length > 0) {
          setTasks(cached);
          setLoading(false);
        } else {
          setLoading(true);
          setTasks([]); // Clear existing tasks on a fresh fetch
        }
      }

      const currentOffset = isLoadMore ? offsetRef.current : 0;

      // If not admin, find task IDs where the user is an assignee
      let userTaskIds: string[] = [];
      if (!isAdmin && user?.id) {
        const { data: userAssignments } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('profile_id', user.id);
        userTaskIds = (userAssignments || []).map((a: any) => a.task_id);
      }
      
      let query = supabase
        .from('tasks')
        .select(`
          *,
          profiles!collaborator_id (
            id,
            name
          ),
          task_assignees (
            profile_id,
            profiles!profile_id (
              id,
              name,
              image_url
            )
          )
        `, { count: 'exact' });

      // Apply Security/Ownership Filter: Non-admins only see tasks assigned to them or created by them
      if (!isAdmin && user?.id) {
        if (userTaskIds.length > 0) {
          query = query.or(`collaborator_id.eq.${user.id},created_by.eq.${user.id},id.in.(${userTaskIds.join(',')})`);
        } else {
          query = query.or(`collaborator_id.eq.${user.id},created_by.eq.${user.id}`);
        }
      }

      // Apply Tab Filters
      const effectiveTab = (!isAdmin && activeTab === 'all') ? 'mine' : activeTab;
      if (effectiveTab === 'mine') {
        // Tasks assigned specifically to me
        if (userTaskIds.length > 0) {
          query = query.or(`collaborator_id.eq.${user.id},id.in.(${userTaskIds.join(',')})`);
        } else {
          query = query.eq('collaborator_id', user.id);
        }
      } else if (effectiveTab === 'assigned') {
        // Tasks I created for others
        query = query.eq('created_by', user.id);
      } else if (effectiveTab === 'history') {
        // Completed tasks (still limited by security filter)
        query = query.eq('status', 'Concluída');
      } else if (effectiveTab === 'all') {
        // Default behavior: security filter already handles visibility
      }

      // Apply Advanced Filters
      if (priorityFilter !== 'Todas') {
        query = query.eq('priority', priorityFilter);
      }
      
      if (statusFilter !== 'Todas') {
        if (statusFilter === 'Vencendo em Breve') {
          const soon = addDays(new Date(), 2).toISOString();
          query = query.lte('due_date', soon).gte('due_date', new Date().toISOString()).neq('status', 'Concluída');
        } else if (statusFilter === 'Atrasada') {
          query = query.lt('due_date', new Date().toISOString()).neq('status', 'Concluída');
        } else if (statusFilter !== 'Todas') {
          query = query.eq('status', statusFilter);
        }
      }

      if (selectedCollabId !== 'all') {
        query = query.eq('collaborator_id', selectedCollabId);
      }

      if (dateFilter !== 'Todas as Datas') {
        const now = new Date();
        if (dateFilter === 'Hoje') {
          query = query.gte('due_date', startOfDay(now).toISOString()).lte('due_date', addDays(startOfDay(now), 1).toISOString());
        } else if (dateFilter === 'Esta Semana') {
          query = query.gte('due_date', startOfWeek(now).toISOString()).lte('due_date', endOfWeek(now).toISOString());
        } else if (dateFilter === 'Este Mês') {
          query = query.gte('due_date', startOfMonth(now).toISOString()).lte('due_date', endOfMonth(now).toISOString());
        }
      }

      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      // Apply Toggle Filter (Pendentes/Concluídas) - if not in history tab
      if (activeTab !== 'history') {
        if (taskToggleFilter === 'pending') {
          query = query.neq('status', 'Concluída');
        } else if (taskToggleFilter === 'completed') {
          query = query.eq('status', 'Concluída');
        }
      }

      // Apply Sort Order
      if (activeTab === 'history') {
        query = query.order('updated_at', { ascending: false, nullsFirst: false });
      } else {
        if (sortOrder === 'due_date_asc') {
          query = query.order('due_date', { ascending: true, nullsFirst: false });
        } else if (sortOrder === 'due_date_desc') {
          query = query.order('due_date', { ascending: false, nullsFirst: false });
        } else if (sortOrder === 'priority') {
          // Custom priority sorting is handled client side or with a priority index
          query = query.order('priority', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }
      }

      let { data, error, count } = await query
        .range(currentOffset, currentOffset + LIMIT - 1);

      if (error) {
        if (error.code === '42501') {
          setRlsError(true);
        }
        // Se houver erro de recursão (42P17) na junção com profiles, tenta fallback buscando apenas tasks
        if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
          console.warn('Detectada política com recursão em profiles ao buscar tasks. Executando fallback direto...');
          const fallbackRes = await supabase
            .from('tasks')
            .select('*', { count: 'exact' })
            .range(currentOffset, currentOffset + LIMIT - 1);
          if (fallbackRes.error) {
            throw fallbackRes.error;
          }
          data = fallbackRes.data;
        } else {
          throw error;
        }
      }

      let formattedTasks = data?.map(task => {
        const manyAssignees = task.task_assignees?.map((ta: any) => ({
          id: ta.profile_id,
          name: ta.profiles?.name,
          avatarUrl: ta.profiles?.image_url
        })) || [];

        let assigneeIds = manyAssignees.map((a: any) => a.id);
        let assignees = manyAssignees.map((a: any) => ({ name: a.name || 'User', avatarUrl: a.avatarUrl })).filter((a: any) => a.name);

        if (assigneeIds.length === 0 && task.collaborator_id) {
          assigneeIds = [task.collaborator_id];
          assignees = [{ name: task.profiles?.name || 'User', avatarUrl: task.profiles?.image_url }].filter((a: any) => a.name);
        }

        const dueDate = task.due_date && typeof task.due_date === 'string' ? parseLocalDate(task.due_date) : null;
        const now = new Date();
        const startOfToday = startOfDay(now);
        const isDueSoon = dueDate && differenceInHours(dueDate, startOfToday) >= 0 && differenceInHours(dueDate, startOfToday) <= 48;
        const isOverdue = dueDate && dueDate < startOfToday && task.status !== 'Concluída';

        return {
          ...task,
          assigneeIds,
          assignees,
          due: task.due_date && typeof task.due_date === 'string' ? formatLocalDate(task.due_date) : 'N/A',
          image: task.image_url || `https://picsum.photos/seed/${task.id}/800/400`,
          date: task.due_date && typeof task.due_date === 'string' ? parseLocalDate(task.due_date) : null,
          isDueSoon,
          isOverdue
        };
      }) || [];

      // Strict privacy check: non-admins only see their own tasks
      if (!isAdmin && user?.id) {
        formattedTasks = formattedTasks.filter(t => 
          t.collaborator_id === user.id ||
          t.created_by === user.id ||
          (t.assigneeIds && t.assigneeIds.includes(user.id))
        );
      }

      if (isLoadMore) {
        setTasks(prev => {
          // Avoid duplicates
          const existingIds = new Set(prev.map(t => t.id));
          const uniqueNew = formattedTasks.filter(t => !existingIds.has(t.id));
          return [...prev, ...uniqueNew];
        });
        offsetRef.current = currentOffset + formattedTasks.length;
        setOffset(offsetRef.current);
      } else {
        setTasks(formattedTasks);
        offsetRef.current = formattedTasks.length;
        setOffset(formattedTasks.length);
      }
      
      // If we got exactly LIMIT items, there might be more
      setHasMore(formattedTasks.length === LIMIT);
    } catch (err: any) {
      console.error('Unexpected error fetching tasks:', err?.message || err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isAuthenticated, user?.id, role, isAdmin, activeTab, priorityFilter, statusFilter, dateFilter, selectedCollabId, searchQuery, taskToggleFilter, sortOrder]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchTasks(true);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadingMore, fetchTasks]);

  React.useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const tables = ['tasks', 'profiles', 'demands', 'task_assignees'];
    const channels = tables.map(table => {
      return supabase
        .channel(`public:${table}-tasks-realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, async (payload) => {
          if (table === 'tasks') {
            if (payload.eventType === 'UPDATE') {
              const updatedTask = payload.new;
              
              // Trigger animation if status changed to Concluída
              setTasks(prevTasks => {
                const existingTask = prevTasks.find(t => t.id.toString() === updatedTask.id.toString());
                if (existingTask && updatedTask.status === 'Concluída' && existingTask.status !== 'Concluída') {
                  triggerCompletionAnimation(updatedTask.id);
                }
                return prevTasks;
              });

              // Fetch the full task with joins to ensure we have updated profile/assignee info
              const { data, error } = await supabase
                .from('tasks')
                .select(`
                  *,
                  profiles:collaborator_id (id, name, image_url),
                  task_assignees (
                    profile_id,
                    profiles (id, name, image_url)
                  )
                `)
                .eq('id', updatedTask.id)
                .single();
              
              if (data && !error) {
                const task = data;
                const manyAssignees = task.task_assignees?.map((ta: any) => ({
                  id: ta.profile_id,
                  name: ta.profiles?.name,
                  avatarUrl: ta.profiles?.image_url
                })) || [];

                let assigneeIds = manyAssignees.map((a: any) => a.id);
                let assignees = manyAssignees.map((a: any) => ({ name: a.name || 'User', avatarUrl: a.avatarUrl })).filter((a: any) => a.name);

                if (assigneeIds.length === 0 && task.collaborator_id) {
                  assigneeIds = [task.collaborator_id];
                  assignees = [{ name: task.profiles?.name || 'User', avatarUrl: task.profiles?.image_url }].filter((a: any) => a.name);
                }

                const dueDate = task.due_date && typeof task.due_date === 'string' ? parseLocalDate(task.due_date) : null;
                const now = new Date();
                const startOfToday = startOfDay(now);
                const isDueSoon = dueDate && differenceInHours(dueDate, startOfToday) >= 0 && differenceInHours(dueDate, startOfToday) <= 48;
                const isOverdue = dueDate && dueDate < startOfToday && task.status !== 'Concluída';

                const formattedTask = {
                  ...task,
                  assigneeIds,
                  assignees,
                  due: task.due_date && typeof task.due_date === 'string' ? formatLocalDate(task.due_date) : 'N/A',
                  image: task.image_url || `https://picsum.photos/seed/${task.id}/800/400`,
                  date: task.due_date && typeof task.due_date === 'string' ? parseLocalDate(task.due_date) : null,
                  isDueSoon,
                  isOverdue
                };

                setTasks(prevTasks => {
                  const exists = prevTasks.some(t => t.id.toString() === formattedTask.id.toString());
                  if (exists) {
                    return prevTasks.map(t => t.id.toString() === formattedTask.id.toString() ? formattedTask : t);
                  } else {
                    return [formattedTask, ...prevTasks];
                  }
                });
              } else {
                // Fallback to simple update if fetch fails
                setTasks(prevTasks => {
                  const exists = prevTasks.some(t => t.id.toString() === updatedTask.id.toString());
                  if (exists) {
                    return prevTasks.map(t => {
                      if (t.id.toString() === updatedTask.id.toString()) {
                        // Update derived fields if due_date or status changed
                        let extraFields: any = {};
                        const effectiveDueDate = updatedTask.due_date || t.due_date;
                        const effectiveStatus = updatedTask.status || t.status;

                        if (effectiveDueDate) {
                          const dueDate = parseLocalDate(effectiveDueDate);
                          const now = new Date();
                          const startOfToday = startOfDay(now);
                          extraFields = {
                            due: formatLocalDate(effectiveDueDate),
                            date: dueDate,
                            isDueSoon: dueDate && differenceInHours(dueDate, startOfToday) >= 0 && differenceInHours(dueDate, startOfToday) <= 48,
                            isOverdue: dueDate && dueDate < startOfToday && effectiveStatus !== 'Concluída'
                          };
                        }

                        return { ...t, ...updatedTask, ...extraFields };
                      }
                      return t;
                    });
                  } else {
                    // We don't have enough info to format it properly without fetching,
                    // but we can try to add a basic version or just ignore it.
                    // It's safer to just ignore it if we couldn't fetch the full task.
                    return prevTasks;
                  }
                });
              }
            } else if (payload.eventType === 'INSERT') {
              // Fetch the full task with joins to match our state structure
              const { data, error } = await supabase
                .from('tasks')
                .select(`
                  *,
                  profiles:collaborator_id (id, name, image_url),
                  task_assignees (
                    profile_id,
                    profiles (id, name, image_url)
                  )
                `)
                .eq('id', payload.new.id)
                .single();
              
              if (data && !error) {
                const task = data;
                const manyAssignees = task.task_assignees?.map((ta: any) => ({
                  id: ta.profile_id,
                  name: ta.profiles?.name,
                  avatarUrl: ta.profiles?.image_url
                })) || [];

                let assigneeIds = manyAssignees.map((a: any) => a.id);
                let assignees = manyAssignees.map((a: any) => ({ name: a.name || 'User', avatarUrl: a.avatarUrl })).filter((a: any) => a.name);

                if (assigneeIds.length === 0 && task.collaborator_id) {
                  assigneeIds = [task.collaborator_id];
                  assignees = [{ name: task.profiles?.name || 'User', avatarUrl: task.profiles?.image_url }].filter((a: any) => a.name);
                }

                const dueDate = task.due_date && typeof task.due_date === 'string' ? parseLocalDate(task.due_date) : null;
                const now = new Date();
                const startOfToday = startOfDay(now);
                const isDueSoon = dueDate && differenceInHours(dueDate, startOfToday) >= 0 && differenceInHours(dueDate, startOfToday) <= 48;
                const isOverdue = dueDate && dueDate < startOfToday && task.status !== 'Concluída';

                const formattedTask = {
                  ...task,
                  assigneeIds,
                  assignees,
                  due: task.due_date && typeof task.due_date === 'string' ? formatLocalDate(task.due_date) : 'N/A',
                  image: task.image_url || `https://picsum.photos/seed/${task.id}/800/400`,
                  date: task.due_date && typeof task.due_date === 'string' ? parseLocalDate(task.due_date) : null,
                  isDueSoon,
                  isOverdue
                };

                setTasks(prev => {
                  if (prev.some(t => t.id.toString() === formattedTask.id.toString())) return prev;
                  // Prepend new task
                  return [formattedTask, ...prev];
                });
              } else {
                // Fallback to full fetch if single fetch fails
                fetchTasks();
              }
            } else if (payload.eventType === 'DELETE') {
              setTasks(prevTasks => prevTasks.filter(t => t.id.toString() !== payload.old.id.toString()));
            }
          } else if (table === 'demands') {
            fetchDemands();
          } else if (table === 'profiles') {
            // Re-fetch collaborators if profiles change
            const fetchCollaborators = async () => {
              try {
                const { data, error } = await supabase.from('profiles').select('id, name, type').order('name');
                if (!error && data) setCollaborators(data);
              } catch (_) {}
            };
            fetchCollaborators();
          } else if (table === 'task_assignees') {
            fetchTasks();
          }
        })
        .subscribe();
    });

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [isAuthenticated, user?.id, fetchTasks, fetchDemands]);

  const handleStatusUpdate = async (taskId: string | number, newStatus: string, skipStateUpdate = false) => {
    try {
      const taskIdStr = String(taskId);
      const task = tasks.find(t => t.id.toString() === taskIdStr);
      if (!task) return;

      const canManage = isAdmin || task.assigneeIds.includes(user?.id);
      if (!canManage) {
        showToast('Você não tem permissão para alterar esta tarefa.', 'error');
        if (skipStateUpdate) {
          fetchTasks(); // Revert local state if it was optimistically updated
        }
        return;
      }

      const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'Concluída') {
        updates.progress = 100;
      } else if (task.status === 'Concluída' && newStatus !== 'Concluída') {
        updates.progress = Math.min(task.progress || 0, 90);
      }

      let { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskIdStr);

      // Fallback if updated_at column doesn't exist
      if (error && error.message?.includes('updated_at')) {
        delete updates.updated_at;
        const { error: retryError } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', taskIdStr);
        error = retryError;
      }

      if (error) throw error;

      // Update local state if not skipped
      if (!skipStateUpdate) {
        setTasks(tasks.map(t => t.id.toString() === taskIdStr ? { ...t, ...updates } : t));
        if (newStatus === 'Concluída' && task.status !== 'Concluída') {
          triggerCompletionAnimation(taskIdStr);
        }
      }

      // Create notifications for all assignees except the one who changed it (if they are an assignee)
      const otherAssignees = task.assigneeIds.filter((id: string) => id !== user?.id);
      
      for (const assigneeId of otherAssignees) {
        await createNotification(
          assigneeId,
          'Status de Tarefa Alterado',
          `${user?.name || 'Alguém'} alterou o status da tarefa "${task.title}" para "${newStatus}".`,
          'status_change',
          taskIdStr,
          `status_change_${taskIdStr}_${newStatus}`
        );
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      showToast('Erro ao atualizar status: ' + (error?.message || JSON.stringify(error)), 'error');
      if (skipStateUpdate) {
        fetchTasks(); // Revert local state if it was optimistically updated
      }
    }
  };

  const handleCreateDemand = async (task: any) => {
    setCreatingDemandId(task.id);
    try {
      const { error } = await supabase.from('demands').insert([
        {
          user_id: user?.id,
          user_name: user?.name || 'Colaborador',
          content: `Demanda de Estoque gerada a partir da tarefa: ${task.title}\n\nDescrição: ${task.description || 'Sem descrição'}`,
          category: 'pedido de material',
          status: 'pending',
          origin_task_id: task.id,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      // Notify admins and managers
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .or('role.eq.admin,role.eq.gerente');

      if (admins) {
        for (const admin of admins) {
          await createNotification(
            admin.id,
            'Nova Demanda de Estoque',
            `${user?.name || 'Um colaborador'} gerou uma demanda de estoque: "${task.title}".`,
            'warning'
          );
        }
      }

      showToast('Demanda de estoque criada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Error creating demand:', error);
      showToast('Erro ao criar demanda.', 'error');
    } finally {
      setCreatingDemandId(null);
    }
  };

  const handleProgressUpdate = async (taskId: string | number, newProgress: number) => {
    try {
      const taskIdStr = String(taskId);
      const currentTask = tasks.find(t => t.id.toString() === taskIdStr);
      if (!currentTask) return;

      const canManage = isAdmin || currentTask.assigneeIds.includes(user?.id);
      if (!canManage) {
        showToast('Você não tem permissão para alterar esta tarefa.', 'error');
        return;
      }

      const updates: any = { progress: newProgress };
      
      if (newProgress === 100) {
        updates.status = 'Concluída';
      } else if (newProgress < 100 && currentTask?.status === 'Concluída') {
        updates.status = 'Em Andamento';
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskIdStr);

      if (error) throw error;

      // Update local state
      setTasks(tasks.map(t => t.id.toString() === taskIdStr ? { ...t, ...updates } : t));
      if (newProgress === 100 && currentTask?.progress !== 100) {
        triggerCompletionAnimation(taskIdStr);
      }

      if (updates.status && updates.status !== currentTask.status) {
        const otherAssignees = currentTask.assigneeIds.filter((id: string) => id !== user?.id);
        for (const assigneeId of otherAssignees) {
          await createNotification(
            assigneeId,
            'Status de Tarefa Alterado',
            `${user?.name || 'Alguém'} alterou o status da tarefa "${currentTask.title}" para "${updates.status}".`,
            'status_change',
            taskIdStr,
            `status_change_${taskIdStr}_${updates.status}`
          );
        }
      }
    } catch (error: any) {
      console.error('Error updating progress:', error.message || error);
    }
  };

  const handleDescriptionUpdate = async (taskId: string, newDescription: string) => {
    try {
      const task = tasks.find(t => t.id.toString() === taskId.toString());
      if (!task) return;

      if (task.description === newDescription) return;

      const canManage = isAdmin || task.assigneeIds.includes(user?.id);
      if (!canManage) {
        showToast('Você não tem permissão para alterar esta tarefa.', 'error');
        setEditingDescription(task.description || '');
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ description: newDescription })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.map(t => 
        t.id.toString() === taskId.toString() ? { ...t, description: newDescription } : t
      ));
      
      showToast('Descrição atualizada!', 'success');
    } catch (err: any) {
      console.error('Error updating description:', err);
      showToast('Erro ao atualizar descrição.', 'error');
    }
  };

  const handleTitleUpdate = async (taskId: string, newTitle: string) => {
    try {
      if (!newTitle.trim()) {
        showToast('O título não pode estar vazio.', 'warning');
        const task = tasks.find(t => t.id.toString() === taskId.toString());
        if (task) setEditingTitle(task.title);
        return;
      }

      const task = tasks.find(t => t.id.toString() === taskId.toString());
      if (!task) return;

      if (task.title === newTitle) return;

      const canManage = isAdmin || task.assigneeIds.includes(user?.id);
      if (!canManage) {
        showToast('Você não tem permissão para alterar esta tarefa.', 'error');
        setEditingTitle(task.title);
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ title: newTitle })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.map(t => 
        t.id.toString() === taskId.toString() ? { ...t, title: newTitle } : t
      ));
      
      showToast('Título atualizado!', 'success');
    } catch (err: any) {
      console.error('Error updating title:', err);
      showToast('Erro ao atualizar título.', 'error');
    }
  };

  const handleAssigneeToggle = async (taskId: string, profileId: string, isAssigned: boolean) => {
    try {
      if (!isAdmin) {
        showToast('Apenas administradores podem alterar atribuídos.', 'error');
        return;
      }

      if (isAssigned) {
        // Remove assignee
        const { error } = await supabase
          .from('task_assignees')
          .delete()
          .eq('task_id', taskId)
          .eq('profile_id', profileId);
        
        if (error) throw error;
      } else {
        // Add assignee
        const { error } = await supabase
          .from('task_assignees')
          .insert({ task_id: taskId, profile_id: profileId });
        
        if (error) throw error;

        // Send push notification
        const task = tasks.find(t => t.id.toString() === taskId.toString());
        if (task) {
          fetch('/api/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profileId,
              title: 'Nova Tarefa Delegada',
              body: `Você foi atribuído à tarefa: ${task.title}`,
              url: `${window.location.origin}/tasks`
            })
          }).catch(err => console.error('Error sending push notification:', err));
        }
      }

      // Refresh tasks to get updated assignees
      await fetchTasks();
      showToast(isAssigned ? 'Colaborador removido.' : 'Colaborador atribuído.', 'success');
    } catch (err: any) {
      console.error('Error toggling assignee:', err);
      showToast('Erro ao atualizar atribuídos.', 'error');
    }
  };

  const handlePriorityUpdate = async (taskId: string | number, newPriority: string) => {
    try {
      const taskIdStr = String(taskId);
      const task = tasks.find(t => t.id.toString() === taskIdStr);
      if (!task) return;

      const canManage = isAdmin || task.assigneeIds.includes(user?.id);
      if (!canManage) {
        showToast('Você não tem permissão para alterar esta tarefa.', 'error');
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ priority: newPriority })
        .eq('id', taskIdStr);

      if (error) throw error;

      // Update local state
      setTasks(tasks.map(t => t.id.toString() === taskIdStr ? { ...t, priority: newPriority } : t));

      setShowUpdateSuccess(true);
      setTimeout(() => setShowUpdateSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error updating priority:', error.message || error);
      showToast('Erro ao atualizar a prioridade.', 'error');
    }
  };

  const handleDueDateUpdate = async (taskId: string | number, newDate: string) => {
    try {
      if (!newDate) return;
      
      const taskIdStr = String(taskId);
      const task = tasks.find(t => t.id.toString() === taskIdStr);
      if (!task) return;

      const canManage = isAdmin || task.assigneeIds.includes(user?.id);
      if (!canManage) {
        showToast('Você não tem permissão para alterar esta tarefa.', 'error');
        return;
      }

      const selectedDate = new Date(newDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        showToast('A data de entrega não pode ser no passado.', 'warning');
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ due_date: newDate })
        .eq('id', taskIdStr);

      if (error) throw error;

      // Update local state
      setTasks(tasks.map(t => t.id.toString() === taskIdStr ? { 
        ...t, 
        due_date: newDate,
        due: formatLocalDate(newDate),
        date: parseLocalDate(newDate)
      } : t));

      setShowUpdateSuccess(true);
      setTimeout(() => setShowUpdateSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error updating due date:', error.message || error);
      showToast('Erro ao atualizar a data de entrega.', 'error');
    }
  };

  const handleDelete = async (taskId: string | number) => {
    showConfirm({
      title: 'Excluir Tarefa',
      message: 'Tem certeza que deseja excluir esta tarefa?',
      type: 'danger',
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        try {
          const taskIdStr = String(taskId);
          const task = tasks.find(t => t.id.toString() === taskIdStr);
          if (!task) return;

          const canManage = isAdmin || task.assigneeIds.includes(user?.id);
          if (!canManage) {
            showToast('Você não tem permissão para excluir esta tarefa.', 'error');
            return;
          }

          const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskIdStr);

          if (error) throw error;

          setTasks(tasks.filter(t => t.id.toString() !== taskIdStr));
          
          setShowDeleteSuccess(true);
          setTimeout(() => setShowDeleteSuccess(false), 3000);
          showToast('Tarefa excluída com sucesso!', 'success');
        } catch (error: any) {
          console.error('Error deleting task:', error.message || error);
          showToast('Erro ao excluir a tarefa.', 'error');
        }
      }
    });
  };

  React.useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchTasks();
    } else if (!isAuthenticated) {
      setLoading(false);
    }
    // Only trigger on initial load or filter changes, not on fetchTasks itself
    // to avoid dependency loops with offset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, activeTab, priorityFilter, statusFilter, dateFilter, selectedCollabId, searchQuery, taskToggleFilter, sortOrder, isAdmin]);

  if (roleLoading || (loading && isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  let filteredTasks = tasks.filter(t => {
    // Keep tasks that are currently playing the completion animation
    if (completedTaskIds.includes(t.id.toString())) return true;
    if (showNearby) {
      return t.status !== 'Concluída';
    }
    return true; // Most filtering is now server-side
  });

  if (showNearby && userCoords) {
    filteredTasks = filteredTasks
      .map((t, index) => {
        const coords = getTaskCoords(t, index);
        const distKm = calculateDistanceKm(userCoords.lat, userCoords.lng, coords.lat, coords.lng);
        return {
          ...t,
          distanceKm: distKm,
          distanceFormatted: formatDistance(distKm),
        };
      })
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  }

  const pendingCount = tasks.filter(t => t.status === 'Pendente').length;
  const inProgressCount = tasks.filter(t => t.status === 'Em Andamento' || t.status === 'Em progresso').length;
  const completedCount = tasks.filter(t => t.status === 'Concluída').length;

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId
    ) {
      return;
    }

    const taskId = draggableId;
    const newStatus = destination.droppableId;

    // 1. Encontrar a tarefa que está sendo movida
    const movedTask = tasks.find(t => t.id.toString() === taskId.toString());
    if (!movedTask) return;

    // 2. Preparar o novo array de tarefas
    let newTasks = [...tasks];
    
    // Remover a tarefa da sua posição atual no array principal
    const sourceIndexInTasks = newTasks.findIndex(t => t.id.toString() === taskId.toString());
    if (sourceIndexInTasks !== -1) {
      newTasks.splice(sourceIndexInTasks, 1);
    }

    // 3. Encontrar a posição de destino no array principal
    // Precisamos mapear o destination.index (que é relativo à lista filtrada da coluna)
    // para um índice no array principal 'tasks'.
    const destColumnTasks = filteredTasks.filter(t => t.status === newStatus && t.id.toString() !== taskId.toString());
    
    let targetIndexInTasks;
    if (destColumnTasks.length > 0 && destination.index < destColumnTasks.length) {
      const targetTask = destColumnTasks[destination.index];
      targetIndexInTasks = newTasks.findIndex(t => t.id.toString() === targetTask.id.toString());
    } else if (destColumnTasks.length > 0) {
      // Soltar no final da coluna
      const lastTask = destColumnTasks[destColumnTasks.length - 1];
      targetIndexInTasks = newTasks.findIndex(t => t.id.toString() === lastTask.id.toString()) + 1;
    } else {
      // Coluna está vazia ou estamos anexando ao final
      targetIndexInTasks = newTasks.length;
    }

    // 4. Atualizar o status e progresso da tarefa
    const updatedTask = { ...movedTask, status: newStatus };
    if (newStatus === 'Concluída') {
      updatedTask.progress = 100;
    } else if (movedTask.status === 'Concluída' && newStatus !== 'Concluída') {
      // Se mover de volta de concluída, ajusta o progresso se necessário
      updatedTask.progress = Math.min(movedTask.progress, 90);
    }

    // 5. Inserir na nova posição
    newTasks.splice(targetIndexInTasks, 0, updatedTask);
    
    // 6. Atualizar o estado local imediatamente para feedback visual rápido
    setTasks(newTasks);
    if (newStatus === 'Concluída' && movedTask.status !== 'Concluída') {
      triggerCompletionAnimation(taskId);
    }

    // 7. Persistir a mudança de status no banco de dados
    await handleStatusUpdate(taskId, newStatus, true);
  };

  const renderKanban = () => {
    const statuses = ['Pendente', 'Em Andamento', 'Concluída'];
    const groups = groupBy === 'status' 
      ? statuses 
      : ['Unassigned', ...collaborators.map(c => c.id)];

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-8 min-h-[calc(100vh-300px)] no-scrollbar -mx-4 px-4">
          {groups.map((groupValue) => {
            let columnTasks;
            let groupTitle;
            let groupIcon;

            if (groupBy === 'status') {
              columnTasks = filteredTasks.filter(t => t.status === groupValue);
              groupTitle = groupValue;
              groupIcon = (
                <div className={`size-3 rounded-full shadow-sm ${
                  groupValue === 'Pendente' ? 'bg-amber-500 shadow-amber-500/20' :
                  groupValue === 'Em Andamento' ? 'bg-blue-500 shadow-blue-500/20' :
                  groupValue === 'Revisão' ? 'bg-indigo-500 shadow-indigo-500/20' : 'bg-emerald-500 shadow-emerald-500/20'
                }`} />
              );
            } else {
              const collab = collaborators.find(c => c.id === groupValue);
              columnTasks = filteredTasks.filter(t => 
                groupValue === 'Unassigned' 
                  ? (!t.assigneeIds || t.assigneeIds.length === 0)
                  : (t.assigneeIds && t.assigneeIds.includes(groupValue))
              );
              groupTitle = groupValue === 'Unassigned' ? 'Não Atribuídas' : (collab?.name || 'Inconhecido');
              groupIcon = groupValue === 'Unassigned' ? <Users size={14} className="text-slate-400" /> : (
                <div className="size-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white overflow-hidden shrink-0">
                  {collab?.image_url ? (
                    <Image src={collab.image_url} alt={collab.name} fill sizes="24px" className="object-cover" />
                  ) : (
                    groupTitle.charAt(0).toUpperCase()
                  )}
                </div>
              );
            }

            return (
              <div key={groupValue} className={`flex flex-col w-[320px] shrink-0 rounded-3xl p-4 transition-all ${
                isDarkMode ? 'bg-slate-900/60 border border-slate-800/80 shadow-inner' : 'bg-slate-100 shadow-sm'
              }`}>
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2.5">
                    {groupIcon}
                    <h3 className={`font-bold text-sm uppercase tracking-widest opacity-80 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'} truncate max-w-[180px]`}>{groupTitle}</h3>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {columnTasks.length}
                    </span>
                  </div>
                  {isAdmin && groupBy === 'status' && (
                    <button 
                      onClick={() => router.push(`/tasks/new?status=${groupValue}`)}
                      className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>

                <StrictModeDroppable droppableId={groupValue} isDropDisabled={groupBy === 'assignee'}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 flex flex-col gap-4 p-3 rounded-[24px] transition-all duration-300 border-2 border-dashed ${
                        snapshot.isDraggingOver 
                          ? (isDarkMode ? 'bg-blue-600/10 border-blue-500 ring-2 ring-blue-500/50 ring-offset-2 ring-offset-slate-900' : 'bg-blue-50 border-blue-400 ring-2 ring-blue-400/50 ring-offset-2 ring-offset-slate-100') 
                          : (isDarkMode ? 'bg-slate-900/20 border-slate-800/50' : 'bg-slate-50/50 border-slate-100')
                      }`}
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={(e) => {
                                toggleTaskExpansion(e, task.id.toString());
                                handleTaskSelection(task.id);
                              }}
                              className={`group rounded-2xl p-0 shadow-sm transition-all duration-200 cursor-pointer relative overflow-hidden border flex flex-col bg-white dark:bg-slate-800 ${
                                snapshot.isDragging 
                                  ? 'shadow-2xl ring-2 ring-blue-600 rotate-[2deg] scale-[1.02] z-50' 
                                  : (isDarkMode ? 'border-slate-700/50 hover:border-blue-500/50 hover:bg-slate-800' : 'border-slate-100 hover:border-blue-100 hover:shadow-md')
                              } ${expandedTaskIds.includes(task.id.toString()) ? 'ring-2 ring-blue-600' : ''}`}
                            >
                              {/* Priority Accent Bar */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1.5 z-10 ${
                                task.priority === 'Urgente' ? 'bg-rose-500 shadow-[2px_0_10px_rgba(244,63,94,0.3)]' :
                                task.priority === 'Alta' ? 'bg-rose-400' :
                                task.priority === 'Média' ? 'bg-amber-400' : 'bg-slate-300'
                              }`} />

                              {/* Completion Visual Feedback Overlay */}
                              <CompletionFeedback isVisible={completedTaskIds.includes(task.id.toString())} />
                              
                              <div className="p-4 pl-5.5 flex flex-col">
                                <div className="flex justify-between items-start mb-3 gap-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider ${
                                      task.priority === 'Urgente' ? 'bg-rose-600 text-white' :
                                      task.priority === 'Alta' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' :
                                      task.priority === 'Média' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                                      (isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600')
                                    }`}>
                                      <Flag size={10} className={task.priority === 'Urgente' || task.priority === 'Alta' ? 'fill-current' : ''} />
                                      {task.priority}
                                    </span>
                                    {task.task_type === 'Estoque' && (
                                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center gap-1">
                                        <Package size={10} />
                                        Estoque
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <h4 className={`font-bold text-sm mb-3 leading-snug group-hover:text-blue-600 transition-all duration-300 flex items-start justify-between gap-1 ${
                                  task.status === 'Concluída'
                                    ? 'line-through opacity-60 decoration-emerald-500 decoration-2 ' + (isDarkMode ? 'text-slate-400' : 'text-slate-500')
                                    : isDarkMode ? 'text-slate-100' : 'text-slate-900'
                                }`}>
                                  <span>{task.title}</span>
                                  {task.status === 'Concluída' && (
                                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                  )}
                                </h4>

                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                    task.isOverdue
                                      ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' 
                                      : task.isDueSoon && task.status !== 'Concluída'
                                      ? 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400'
                                      : isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
                                  }`}>
                                    <Calendar size={12} className={task.isOverdue || task.isDueSoon ? 'animate-pulse' : ''} />
                                    {task.due}
                                  </div>

                                  {task.category && (
                                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg tracking-wider ${isDarkMode ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                      {task.category}
                                    </span>
                                  )}
                                </div>
                                
                                {task.description && (
                                  <div className="mb-4">
                                    <button
                                      onClick={(e) => toggleTaskExpansion(e, task.id.toString())}
                                      className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors mb-1"
                                    >
                                      <ChevronDown size={12} className={`transition-transform duration-200 ${expandedTaskIds.includes(task.id.toString()) ? 'rotate-180' : ''}`} />
                                      {expandedTaskIds.includes(task.id.toString()) ? 'Ocultar descrição' : 'Ver descrição'}
                                    </button>
                                    <AnimatePresence>
                                      {expandedTaskIds.includes(task.id.toString()) && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          className="overflow-hidden"
                                        >
                                          <p className={`text-[11px] leading-relaxed mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {task.description}
                                          </p>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )}
                              </div>

                              {task.task_type === 'Estoque' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateDemand(task);
                                  }}
                                  disabled={creatingDemandId === task.id}
                                  className={`w-full mb-4 px-3 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                                    isDarkMode 
                                      ? 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400' 
                                      : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                                  } ${creatingDemandId === task.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <Package size={12} />
                                  {creatingDemandId === task.id ? 'Criando...' : 'Criar Demanda'}
                                </button>
                              )}

                              <div className="flex items-center justify-between mt-auto p-4 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                                <div className="flex -space-x-2 overflow-hidden">
                                  {Array.isArray(task.assignees) && task.assignees.slice(0, 3).map((assignee: any, i: number) => (
                                    <div 
                                      key={`${task.id}-assignee-kanban-${i}`}
                                      title={assignee.name}
                                      className="relative size-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-black text-white shadow-sm overflow-hidden"
                                    >
                                      {assignee.avatarUrl ? (
                                        <Image src={assignee.avatarUrl} alt={assignee.name || 'User'} fill sizes="28px" className="object-cover" />
                                      ) : (
                                        String(assignee.name || 'U').charAt(0).toUpperCase()
                                      )}
                                    </div>
                                  ))}
                                  {Array.isArray(task.assignees) && task.assignees.length > 3 && (
                                    <div className="relative z-10 size-7 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-black text-slate-500 dark:text-slate-400 shadow-sm">
                                      +{task.assignees.length - 3}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex flex-col items-end gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <ProgressBar 
                                      progress={task.progress || 0}
                                      onUpdate={(newProgress) => handleProgressUpdate(task.id, newProgress)}
                                      isDarkMode={isDarkMode}
                                    />
                                    <div className="flex items-center gap-1.5">
                                      <AnimatePresence mode="wait">
                                        {task.progress === 100 ? (
                                          <motion.div
                                            key="check"
                                            initial={{ scale: 0, rotate: -20, opacity: 0 }}
                                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                            className="text-emerald-500 flex items-center gap-1"
                                          >
                                            <AnimatedCheckmark size={14} strokeWidth={4} />
                                            <span className="text-[10px] font-black uppercase tracking-tighter">Concluído</span>
                                          </motion.div>
                                        ) : (
                                          <motion.span 
                                            key="percent"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className={`text-[10px] font-black ${
                                              task.progress > 80 
                                                ? (isDarkMode ? 'text-amber-300 drop-shadow-sm' : 'text-amber-600') 
                                                : (isDarkMode ? 'text-blue-300 drop-shadow-sm' : 'text-blue-600')
                                            }`}
                                          >
                                            {task.progress}%
                                          </motion.span>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {columnTasks.length === 0 && (
                        <div className={`flex-1 flex flex-col items-center justify-center py-12 transition-opacity ${isDarkMode ? 'text-slate-700 opacity-40' : 'text-slate-300 opacity-60'}`}>
                          <ClipboardList size={32} className="mb-2" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Vazio</p>
                        </div>
                      )}
                    </div>
                  )}
                </StrictModeDroppable>
                <button 
                  onClick={() => router.push(`/tasks/new?status=${status}`)}
                  className={`mt-4 w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
                    isDarkMode 
                      ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50 hover:border-slate-600 shadow-sm' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm'
                  }`}
                >
                  <Plus size={14} />
                  Adicionar Tarefa
                </button>
              </div>
            );
          })}
        </div>
        {hasMore && (
          <div ref={observerTarget} className="flex flex-col items-center justify-center mt-8 py-8 w-full gap-4">
            {loadingMore ? (
              <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <button 
                onClick={() => fetchTasks(true)}
                className={`px-6 py-2 rounded-full font-bold text-xs transition-all ${
                  isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Carregar Mais Tarefas
              </button>
            )}
          </div>
        )}
      </DragDropContext>
    );
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    const rows: React.ReactNode[] = [];
    let days: React.ReactNode[] = [];

    calendarDays.forEach((day, i) => {
      const dayTasks = filteredTasks.filter(t => t.date && isSameDay(t.date, day));
      
      days.push(
        <div 
          key={day.toString()} 
          className={`min-h-[100px] border p-1 transition-colors ${
            !isSameMonth(day, monthStart) 
              ? (isDarkMode ? 'bg-slate-900/50 text-slate-700' : 'bg-slate-50 text-slate-300') 
              : (isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-900')
          } ${isSameDay(day, new Date()) ? 'ring-2 ring-blue-600 ring-inset' : ''}`}
        >
          <div className="text-[10px] font-bold mb-1">{format(day, 'd')}</div>
          <div className="flex flex-col gap-1">
            {dayTasks.map(task => (
              <div 
                key={task.id} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleTaskSelection(task.id);
                }}
                className={`text-[8px] p-1 rounded font-bold cursor-pointer transition-transform hover:scale-105 flex items-center gap-1 ${
                  task.status === 'Concluída' 
                    ? 'bg-emerald-100 text-emerald-700 line-through opacity-70'
                    : task.isOverdue
                      ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-500'
                      : task.isDueSoon
                        ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-500'
                        : task.priority === 'Alta' || task.priority === 'Urgente'
                          ? 'bg-rose-50 text-rose-600' 
                          : task.priority === 'Baixa'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-blue-50 text-blue-600'
                } ${expandedTaskIds.includes(task.id.toString()) ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                title={task.title}
              >
                {task.isOverdue && <Clock size={8} className="shrink-0 text-rose-600" />}
                {!task.isOverdue && task.isDueSoon && task.status !== 'Concluída' && <Clock size={8} className="shrink-0 text-amber-600" />}
                <span className="truncate">{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      );

      if ((i + 1) % 7 === 0) {
        rows.push(<div key={i} className="grid grid-cols-7">{days}</div>);
        days = [];
      }
    });

    const noDueDateTasks = filteredTasks.filter(t => !t.date);

    return (
      <div className="flex flex-col gap-6">
        <div className="overflow-x-auto no-scrollbar -mx-4 px-4 pb-4">
          <div className={`rounded-xl border min-w-[700px] overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</h3>
              <div className="flex gap-2 items-center">
                <button 
                  onClick={() => setCurrentMonth(new Date())} 
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Hoje
                </button>
                <div className="flex gap-1">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                    <ArrowLeft size={16} />
                  </button>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className={`p-1 rounded transition-colors rotate-180 ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                    <ArrowLeft size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className={`grid grid-cols-7 text-center text-[10px] font-bold py-2 border-b ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d}>{d}</div>)}
            </div>
            {rows}
          </div>
        </div>

        {noDueDateTasks.length > 0 && (
          <div className={`rounded-xl border p-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Tarefas Sem Prazo Definido</h4>
            <div className="flex flex-wrap gap-2">
              {noDueDateTasks.map(task => (
                <div 
                  key={task.id} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTaskSelection(task.id);
                  }}
                  className={`text-xs px-2 py-1 rounded font-medium cursor-pointer transition-transform hover:scale-105 ${
                    task.status === 'Concluída' 
                      ? 'bg-emerald-100 text-emerald-700 line-through opacity-70'
                      : task.priority === 'Alta' 
                        ? 'bg-rose-100 text-rose-700' 
                        : task.priority === 'Baixa'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-blue-100 text-blue-700'
                  } ${expandedTaskIds.includes(task.id.toString()) ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                  title={task.title}
                >
                  {task.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };



  const renderTaskDetails = () => {
    const task = tasks.find(t => t.id.toString() === selectedTaskId?.toString());
    if (!task) return null;

    return (
      <AnimatePresence>
        {selectedTaskId && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleTaskSelection(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            
            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed inset-y-0 right-0 w-full sm:w-[500px] z-[110] shadow-2xl flex flex-col ${
                isDarkMode ? 'bg-slate-900 border-l border-slate-800' : 'bg-white border-l border-slate-200'
              }`}
            >
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleTaskSelection(null)}
                    className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h2 className="font-bold text-lg">Detalhes da Tarefa</h2>
                </div>
                <div className="flex items-center gap-2">
                      {isAdmin && (
                    <button 
                      onClick={() => {
                        showConfirm({
                          title: 'Excluir Tarefa',
                          message: 'Tem certeza que deseja excluir esta tarefa?',
                          type: 'danger',
                          confirmLabel: 'Excluir',
                          onConfirm: () => handleDelete(task.id)
                        });
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Excluir Tarefa"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleTaskSelection(null)}
                    className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                {/* Title & Status */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      task.status === 'Concluída' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' :
                      task.status === 'Revisão' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' :
                      task.status === 'Em Andamento' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' :
                      'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                    }`}>
                      {task.status}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      task.priority === 'Alta' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' :
                      task.priority === 'Média' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {task.priority}
                    </span>
                    {task.task_type === 'Estoque' && (
                      <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-wider bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center gap-1">
                        <Package size={10} />
                        Estoque
                      </span>
                    )}
                  </div>
                  <input 
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleTitleUpdate(task.id, editingTitle)}
                    className={`w-full bg-transparent text-2xl font-black tracking-tight outline-none border-b border-transparent focus:border-blue-600/30 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                  />
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  {task.status !== 'Concluída' && (
                    <button 
                      onClick={() => handleStatusUpdate(task.id, 'Concluída')}
                      className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} />
                      Marcar como Concluída
                    </button>
                  )}
                  {task.task_type === 'Estoque' && (
                    <button 
                      onClick={() => handleCreateDemand(task)}
                      disabled={creatingDemandId === task.id}
                      className={`flex-1 px-4 py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                        isDarkMode 
                          ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400' 
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                      } ${creatingDemandId === task.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Criar Demanda de Estoque"
                    >
                      <Package size={18} />
                      {creatingDemandId === task.id ? 'Criando...' : 'Criar Demanda'}
                    </button>
                  )}
                  {isAdmin && (
                    <Link href={`/tasks/edit/${task.id}`}
                      className={`p-2.5 rounded-xl transition-colors flex items-center justify-center ${
                        isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title="Editar Completo"
                    >
                      <Edit2 size={18} />
                    </Link>
                  )}
                </div>

                {/* Editable Fields */}
                <div className="grid grid-cols-1 gap-6">
                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <ClipboardList size={12} />
                      Descrição
                    </label>
                    <textarea 
                      value={editingDescription}
                      onChange={(e) => setEditingDescription(e.target.value)}
                      onBlur={() => handleDescriptionUpdate(task.id, editingDescription)}
                      placeholder="Adicione uma descrição detalhada..."
                      rows={4}
                      className={`w-full p-4 rounded-xl border font-medium outline-none transition-colors resize-none text-sm leading-relaxed ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-600'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Status */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</label>
                      <select 
                        value={task.status || 'Pendente'}
                        onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                        className={`w-full h-11 px-4 rounded-xl border font-bold outline-none transition-colors appearance-none text-sm ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-600'
                        }`}
                      >
                        <option value="Pendente">Pendente</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="Revisão">Revisão</option>
                        <option value="Concluída">Concluída</option>
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Prioridade</label>
                      <select 
                        value={task.priority || 'Média'}
                        onChange={(e) => handlePriorityUpdate(task.id, e.target.value)}
                        className={`w-full h-11 px-4 rounded-xl border font-bold outline-none transition-colors appearance-none text-sm ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-600'
                        }`}
                      >
                        <option value="Urgente">Urgente</option>
                        <option value="Alta">Alta</option>
                        <option value="Média">Média</option>
                        <option value="Baixa">Baixa</option>
                      </select>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Progresso</label>
                      <span className="text-sm font-black text-blue-600">{task.progress || 0}%</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <ProgressBar 
                        progress={task.progress || 0}
                        onUpdate={(newProgress) => handleProgressUpdate(task.id, newProgress)}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Calendar size={12} />
                      Prazo de Entrega
                    </label>
                    <input 
                      type="date"
                      min={new Date().toLocaleDateString('en-CA')}
                      value={task.due_date && task.due_date.includes('-') ? task.due_date : ''}
                      onChange={(e) => handleDueDateUpdate(task.id, e.target.value)}
                      className={`w-full h-11 px-4 rounded-xl border font-bold outline-none transition-colors text-sm ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-600'
                      }`}
                    />
                  </div>

                  {/* Assignees */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Users size={12} />
                      Atribuído para
                    </label>

                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar colaborador..."
                        value={collabSearchTerm}
                        onChange={(e) => setCollabSearchTerm(e.target.value)}
                        className={`w-full h-9 pl-9 pr-4 rounded-xl text-[11px] font-medium outline-none border transition-all ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-600'
                        }`}
                      />
                    </div>
                    
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {collaborators.filter(c => c.name?.toLowerCase().includes(collabSearchTerm.toLowerCase())).map((collab) => {
                        const isAssigned = task.assigneeIds?.includes(collab.id);
                        return (
                          <button
                            key={collab.id}
                            onClick={() => handleAssigneeToggle(task.id, collab.id, isAssigned)}
                            disabled={!isAdmin}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                              isAssigned 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                                : (isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                            } ${!isAdmin && 'cursor-default opacity-80'}`}
                          >
                            <div className={`size-5 rounded-full flex items-center justify-center text-[8px] ${
                              isAssigned ? 'bg-white/20' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-200')
                            }`}>
                              {String(collab.name || 'U').charAt(0)}
                            </div>
                            {collab.name}
                            {isAdmin && (
                              <div className={`ml-1 rounded-full p-0.5 ${isAssigned ? 'bg-white/20' : 'bg-slate-400/20'}`}>
                                {isAssigned ? <X size={10} /> : <Plus size={10} />}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Comments */}
                <div className={`border-t pt-8 mt-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <h3 className={`text-lg font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    <ClipboardList size={20} className="text-blue-600" />
                    Comentários
                  </h3>
                  <TaskComments taskId={task.id} isDarkMode={isDarkMode} />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 border-b backdrop-blur-md flex flex-col ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="flex items-center p-3.5 sm:p-4 justify-between w-full gap-2">
          <Link href="/" className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ArrowLeft size={20} />
          </Link>
          <AnimatePresence mode="wait">
            {showSearch ? (
              <motion.div 
                key="search"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: '100%' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 px-2"
              >
                <div className="relative flex items-center">
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar tarefas..."
                    className={`w-full h-10 pl-4 pr-12 rounded-xl outline-none focus:ring-2 focus:ring-blue-600/20 transition-all text-sm ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <VoiceSearch 
                      onResult={(text) => setSearchQuery(text)} 
                      isDarkMode={isDarkMode} 
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.h2 
                key="title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-base sm:text-lg font-bold leading-tight tracking-tight flex-1 text-left sm:text-center truncate"
              >
                Tarefas Delegadas
              </motion.h2>
            )}
          </AnimatePresence>
          
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Desktop Action Buttons */}
            <div className="hidden sm:flex items-center gap-2 mr-1">
              <Link
                href="/tasks/new"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
              >
                <Plus size={15} />
                <span>Nova Tarefa</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsDemandModalOpen(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border active:scale-95 ${
                  isDarkMode 
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MessageSquare size={14} className="text-blue-500" />
                <span>Nova Demanda</span>
              </button>
            </div>

            <button
              onClick={() => toggleDarkMode(!isDarkMode)}
              className={`flex size-9 sm:size-10 items-center justify-center rounded-xl transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
              title="Alternar Tema"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery('');
              }}
              className={`flex size-9 sm:size-10 items-center justify-center rounded-xl transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              {showSearch ? <X size={18} /> : <Search size={18} />}
            </button>
            <PushNotificationManager userId={user?.id} isDarkMode={isDarkMode} />
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative flex size-9 sm:size-10 items-center justify-center rounded-xl transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 size-4 bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Dedicated Mobile Action Buttons Bar (Always 100% visible, fully responsive side-by-side) */}
        <div className="flex sm:hidden items-center gap-2 px-3 pb-3">
          <Link
            href="/tasks/new"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 text-center"
          >
            <Plus size={16} className="shrink-0" />
            <span className="truncate">Nova Tarefa</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsDemandModalOpen(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all border active:scale-95 text-center ${
              isDarkMode 
                ? 'bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-700' 
                : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50 shadow-xs'
            }`}
          >
            <MessageSquare size={15} className="shrink-0 text-blue-500" />
            <span className="truncate">Nova Demanda</span>
          </button>
        </div>

        {/* Global Filters in Header */}
        <div className={`flex items-center gap-2 px-4 pb-3 overflow-x-auto no-scrollbar ${showSearch ? 'hidden' : ''}`}>
        </div>
      </header>

      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`absolute top-16 right-4 w-72 border rounded-xl shadow-xl z-[100] p-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
          >
            <div className="p-2 border-b border-slate-50 dark:border-slate-800 mb-2 flex justify-between items-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notificações ({unreadCount})</p>
              {unreadCount > 0 && (
                <button 
                  onClick={clearAll}
                  className="text-[10px] text-blue-600 font-bold hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto no-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((notif, idx) => (
                  <div 
                    key={`${notif.id}-${idx}`} 
                    onClick={() => markAsRead(notif.id)}
                    className={`p-2 rounded-lg cursor-pointer transition-colors relative border-l-4 ${
                      !notif.read 
                        ? (isDarkMode ? 'bg-blue-900/10 hover:bg-blue-900/20' : 'bg-blue-50/50 hover:bg-blue-50') 
                        : (isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50')
                    } ${
                      notif.type === 'overdue' ? 'border-rose-500' :
                      notif.type === 'due_soon' ? 'border-amber-500' :
                      'border-blue-500'
                    }`}
                  >
                    {!notif.read && <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${
                      notif.type === 'overdue' ? 'bg-rose-600' :
                      notif.type === 'due_soon' ? 'bg-amber-600' :
                      'bg-blue-600'
                    }`} />}
                    <p className={`text-sm font-semibold ${
                      notif.type === 'overdue' ? 'text-rose-600' :
                      notif.type === 'due_soon' ? 'text-amber-600' :
                      (isDarkMode ? 'text-slate-100' : 'text-slate-900')
                    }`}>{notif.title}</p>
                    <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{notif.message}</p>
                    <p className="text-[8px] text-slate-400 mt-1">{new Date(notif.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400">
                  <p className="text-xs">Nenhuma notificação</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-7xl mx-auto w-full">
          {/* Tabs Navigation */}
          <div className="px-4 pt-4 space-y-4">
            <div className={`flex items-center gap-1 p-1 rounded-xl overflow-x-auto no-scrollbar ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100 border border-slate-200/60'}`}>
              <button
                onClick={() => setActiveTab('mine')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'mine' 
                    ? (isDarkMode ? 'bg-slate-800 text-blue-400 shadow-xs' : 'bg-white text-blue-600 shadow-xs') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                <User size={13} />
                Minhas Tarefas
              </button>
              <button
                onClick={() => setActiveTab('assigned')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'assigned' 
                    ? (isDarkMode ? 'bg-slate-800 text-blue-400 shadow-xs' : 'bg-white text-blue-600 shadow-xs') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                <Send size={13} />
                Tarefas Atribuídas
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('all')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'all' 
                      ? (isDarkMode ? 'bg-slate-800 text-blue-400 shadow-xs' : 'bg-white text-blue-600 shadow-xs') 
                      : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                  }`}
                >
                  <Users size={13} />
                  Todas as Tarefas
                </button>
              )}
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'history' 
                    ? (isDarkMode ? 'bg-slate-800 text-emerald-400 shadow-xs' : 'bg-white text-emerald-600 shadow-xs') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                <History size={13} />
                Histórico
              </button>
              <button
                onClick={() => setActiveTab('demands')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'demands' 
                    ? (isDarkMode ? 'bg-slate-800 text-amber-400 shadow-xs' : 'bg-white text-amber-600 shadow-xs') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                <MessageSquare size={13} />
                {(!isAdmin && role !== 'gerente') ? 'Minhas Demandas' : 'Demandas'}
              </button>
            </div>

            {/* View Switcher and Sorting Toggle Area */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <ViewSwitcher />
              
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
                 {activeTab !== 'history' && activeTab !== 'demands' && (
                  <div className="relative shrink-0">
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className={`h-10 pl-4 pr-8 rounded-2xl text-sm font-semibold appearance-none outline-none border transition-all ${
                        sortOrder !== 'none'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                          : isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <option value="none">Ordenar: Padrão</option>
                      <option value="due_date_asc">Prazo: Prox</option>
                      <option value="due_date_desc">Prazo: Dist</option>
                      <option value="priority">Prioridade</option>
                    </select>
                    <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${sortOrder !== 'none' ? 'text-white' : isDarkMode ? 'text-slate-400' : 'text-blue-600'}`} />
                  </div>
                )}
                
                {isAdmin && (
                  <div className="relative shrink-0">
                    <select
                      value={selectedCollabId}
                      onChange={(e) => setSelectedCollabId(e.target.value)}
                      className={`h-10 pl-8 pr-8 rounded-2xl text-xs font-bold appearance-none outline-none border transition-all ${
                        selectedCollabId !== 'all'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                          : (isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                      }`}
                    >
                      <option value="all">Vendedores: Todos</option>
                      {collaborators.filter(c => c.type === 'vendedor' || c.type === 'admin').map(collab => (
                        <option key={collab.id} value={collab.id}>{collab.name}</option>
                      ))}
                    </select>
                    <div className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${selectedCollabId !== 'all' ? 'text-white' : 'text-slate-400'}`}>
                      <User size={14} />
                    </div>
                    <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${selectedCollabId !== 'all' ? 'text-white' : 'text-slate-400'}`}>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table Missing Warning */}
          {tableMissing && isAdmin && (
            <div className="mx-4 mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-500">Banco de Dados não configurado</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Algumas tabelas necessárias (como <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">tasks</code> ou <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">demands</code>) não foram encontradas no Supabase. 
                </p>
                <button 
                  onClick={() => {
                    const sql = `-- 1. Create the tasks table\nCREATE TABLE IF NOT EXISTS tasks (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  title TEXT NOT NULL,\n  description TEXT,\n  due_date TEXT,\n  priority TEXT CHECK (priority IN ('Alta', 'Média', 'Baixa', 'Urgente')),\n  progress INTEGER DEFAULT 0,\n  status TEXT DEFAULT 'Pendente',\n  collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,\n  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,\n  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL\n);\n\n-- 2. Create task_assignees table\nCREATE TABLE IF NOT EXISTS task_assignees (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,\n  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,\n  UNIQUE(task_id, profile_id)\n);\n\n-- 3. Create demands table\nCREATE TABLE IF NOT EXISTS demands (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,\n  user_name TEXT,\n  content TEXT,\n  category TEXT,\n  status TEXT DEFAULT 'pending',\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL\n);\n\n-- 4. Enable RLS\nALTER TABLE tasks ENABLE ROW LEVEL SECURITY;\nALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;\nALTER TABLE demands ENABLE ROW LEVEL SECURITY;\n\n-- 5. Create policies\nCREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all on task_assignees" ON task_assignees FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all on demands" ON demands FOR ALL USING (true) WITH CHECK (true);`;
                    navigator.clipboard.writeText(sql);
                    showToast('SQL copiado! Cole no SQL Editor do Supabase.', 'success');
                  }}
                  className="mt-2 text-xs font-bold text-amber-600 hover:text-amber-700 underline underline-offset-2"
                >
                  Copiar SQL para criar tabelas
                </button>
              </div>
            </div>
          )}

          {/* Push Table Missing Warning */}
          {pushTableMissing && isAdmin && (
            <div className="mx-4 mt-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
              <Bell className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-blue-500">Tabela &apos;push_subscriptions&apos; ausente</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  A tabela para armazenar as inscrições de notificações push não foi encontrada. 
                  As notificações não funcionarão até que a tabela seja criada.
                </p>
                <button 
                  onClick={() => {
                    const sql = `-- Criar tabela de inscrições push\nCREATE TABLE IF NOT EXISTS push_subscriptions (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,\n  subscription JSONB NOT NULL,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,\n  UNIQUE(subscription)\n);\n\n-- Habilitar RLS\nALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;\n\n-- Políticas de acesso\nCREATE POLICY "Usuários podem gerenciar suas próprias inscrições" ON push_subscriptions\n  FOR ALL USING (auth.uid() = profile_id);`;
                    navigator.clipboard.writeText(sql);
                    showToast('SQL copiado! Cole no SQL Editor do Supabase.', 'success');
                  }}
                  className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2"
                >
                  Copiar SQL para criar tabela
                </button>
              </div>
            </div>
          )}

          {/* Column Missing Warning */}
          {columnMissing && isAdmin && (
            <div className="mx-4 mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-500">Coluna &apos;created_by&apos; ausente</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  A coluna <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">created_by</code> está faltando na tabela de tarefas. 
                  Algumas funcionalidades de permissão podem não funcionar corretamente.
                </p>
                <button 
                  onClick={() => {
                    const sql = `-- Adicionar coluna created_by à tabela tasks\nALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;\n\n-- Atualizar tarefas existentes com um criador padrão (ex: o primeiro admin)\nUPDATE tasks SET created_by = '${user?.id || '77777777-7777-7777-7777-777777777777'}' WHERE created_by IS NULL;`;
                    navigator.clipboard.writeText(sql);
                    showToast('SQL copiado! Cole no SQL Editor do Supabase.', 'success');
                  }}
                  className="mt-2 text-xs font-bold text-amber-600 hover:text-amber-700 underline underline-offset-2"
                >
                  Copiar SQL para corrigir coluna
                </button>
              </div>
            </div>
          )}

          {/* Filters and View Toggle */}
        <div className="flex flex-col p-4 gap-4">
          {/* Status Overview Counters */}
          {activeTab !== 'demands' && activeTab !== 'history' && (
            <div className="space-y-4 mb-2">
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'}`}>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Pendentes</span>
                  <span className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{pendingCount}</span>
                </div>
                <div className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'}`}>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider text-center leading-tight">Em Andamento</span>
                  <span className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{inProgressCount}</span>
                </div>
                <div className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'}`}>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Concluídas</span>
                  <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{completedCount}</span>
                </div>
              </div>

              {pendingCount === 0 && inProgressCount === 0 && tasks.length > 0 && taskToggleFilter === 'pending' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center gap-3 text-center ${
                    isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  }`}
                >
                  <div className="size-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-widest">Tudo em dia!</h4>
                    <p className="text-[10px] opacity-80 font-bold">Você concluiu todos os seus compromissos pendentes. Bom trabalho!</p>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          <div className="flex gap-3 overflow-x-auto no-scrollbar items-center">
            {/* Toggle Filter Buttons */}
            {activeTab !== 'history' && activeTab !== 'demands' && (
              <div className={`flex p-1 rounded-full shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {(['pending', 'completed'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTaskToggleFilter(filter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      taskToggleFilter === filter
                        ? (isDarkMode ? 'bg-slate-700 shadow-sm text-white' : 'bg-white shadow-sm text-blue-600')
                        : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-blue-600')
                    }`}
                  >
                    {filter === 'pending' ? 'Pendentes' : 'Concluídas'}
                  </button>
                ))}
              </div>
            )}

            {/* Direct List / Map Toggle Button */}
            
            {/* Show Nearby GPS Button */}

            <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 text-sm font-bold transition-all border-2 ${
                  showAdvancedFilters || statusFilter !== 'Todas' || dateFilter !== 'Todas as Datas' || selectedCollabId !== 'all'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                    : (isDarkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                }`}
              >
                <Filter size={16} />
                Mais Filtros
                {(statusFilter !== 'Todas' || dateFilter !== 'Todas as Datas' || selectedCollabId !== 'all') && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-white text-blue-600 text-[10px] font-black ml-1">
                    {[statusFilter !== 'Todas', dateFilter !== 'Todas as Datas', selectedCollabId !== 'all'].filter(Boolean).length}
                  </span>
                )}
            </button>
            
            <div className="flex gap-2 shrink-0 pr-4">
            </div>
          </div>
          
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl border mb-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className={`w-full h-10 pl-9 pr-4 rounded-xl text-xs font-bold appearance-none outline-none border transition-all ${
                          isDarkMode 
                            ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-blue-600' 
                            : 'bg-white border-slate-200 text-slate-700 focus:border-blue-600 shadow-sm'
                        }`}
                      >
                        <option value="Todas">Todos os Status</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="Revisão">Revisão</option>
                        <option value="Concluída">Concluída</option>
                        <option value="Vencendo em Breve">Vencendo em Breve</option>
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </div>

                  {/* Date Filter */}
                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Prazo de Entrega
                    </label>
                    <DateFilterSelect
                      value={dateFilter}
                      onChange={setDateFilter}
                      isDarkMode={isDarkMode}
                    />
                  </div>

                  {/* Collaborator Filter */}
                  {isAdmin && (
                    <div className="space-y-2">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Colaborador
                      </label>
                      <div className="relative">
                        <select
                          value={selectedCollabId}
                          onChange={(e) => setSelectedCollabId(e.target.value)}
                          className={`w-full h-10 pl-9 pr-4 rounded-xl text-xs font-bold appearance-none outline-none border transition-all ${
                            isDarkMode 
                              ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-blue-600' 
                              : 'bg-white border-slate-200 text-slate-700 focus:border-blue-600 shadow-sm'
                          }`}
                        >
                          <option value="all">Todos os Colaboradores</option>
                          {collaborators.map(collab => (
                            <option key={collab.id} value={collab.id}>{collab.name}</option>
                          ))}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <User size={16} />
                        </div>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={16} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reset Button */}
                  {(statusFilter !== 'Todas' || dateFilter !== 'Todas as Datas' || selectedCollabId !== 'all' || priorityFilter !== 'Todas' || progressFilter !== 'Todas') && (
                    <div className="md:col-span-3 flex justify-end">
                      <button
                        onClick={() => {
                          setStatusFilter('Todas');
                          setDateFilter('Todas as Datas');
                          setSelectedCollabId('all');
                          setPriorityFilter('Todas');
                          setProgressFilter('Todas');
                        }}
                        className="text-[10px] font-bold text-rose-500 uppercase tracking-widest hover:underline flex items-center gap-1"
                      >
                        <X size={12} />
                        Limpar Todos os Filtros
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                {/* Search Bar or other info could go here if needed */}
              </div>
            </div>
          </div>
        </div>

        {/* Task List / Calendar / Kanban */}
        {activeTab === 'demands' ? (
          renderDemands()
        ) : (
          <div className="p-4">
            {viewMode === 'map' ? (
              <TasksMapView
                tasks={filteredTasks as any}
                isDarkMode={isDarkMode}
                onStatusUpdate={handleStatusUpdate}
              />
            ) : viewMode === 'calendar' ? (
              renderCalendar()
            ) : viewMode === 'kanban' ? (
              renderKanban()
            ) : (
              <div className="flex flex-col gap-4">
                {viewMode === 'list' && filteredTasks.length > 0 && (
                  <div className={`hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <div className="col-span-4">Tarefa</div>
                    <div className="col-span-1">Prazo</div>
                    <div className="col-span-2">Progresso</div>
                    <div className="col-span-2">Prioridade</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1 text-right">Ações</div>
                  </div>
                )}
              <div className={`${
                viewMode === 'grid' 
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' 
                  : 'flex flex-col gap-3'
              }`}>
                {filteredTasks.length > 0 ? (
                  <>
                    {filteredTasks.map((task, idx) => (
                      <TaskCard
                        key={`${task.id}-${idx}`}
                        task={task as any}
                        idx={idx}
                        viewMode={viewMode}
                        isDarkMode={isDarkMode}
                        completedTaskIds={completedTaskIds}
                        isAdmin={isAdmin}
                        handlePriorityUpdate={handlePriorityUpdate}
                        handleStatusUpdate={handleStatusUpdate}
                        handleProgressUpdate={handleProgressUpdate}
                        handleDueDateUpdate={handleDueDateUpdate}
                        handleDelete={handleDelete}
                        handleCreateDemand={handleCreateDemand}
                        creatingDemandId={creatingDemandId}
                        priorityMeanings={priorityMeanings}
                        AnimatedCheckmark={AnimatedCheckmark}
                        TaskComments={TaskComments}
                        expandedTaskIds={expandedTaskIds}
                        toggleTaskExpansion={toggleTaskExpansion}
                        onSelectTask={(id) => handleTaskSelection(id)}
                      />
                    ))}
                  </>
                ) : (
                  !hasMore && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 col-span-full">
                      <Search size={48} className="mb-4 opacity-20" />
                      <p className="font-medium">Nenhuma tarefa encontrada</p>
                    </div>
                  )
                )}
                {hasMore && (
                  <div ref={observerTarget} className="col-span-full flex flex-col items-center justify-center mt-8 py-8 w-full gap-4">
                    {loadingMore ? (
                      <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                    ) : (
                      <button 
                        onClick={() => fetchTasks(true)}
                        className={`px-6 py-2 rounded-full font-bold text-xs transition-all ${
                          isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Carregar Mais Tarefas
                      </button>
                    )}
                  </div>
                )}
              </div>
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      {isAdmin && (
        <Link href="/tasks/new"
          className="fixed bottom-24 md:bottom-8 right-6 bg-blue-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 z-[90] hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
        >
          <Plus size={20} />
          Nova Tarefa
        </Link>
      )}

      <AnimatePresence>
        {showDeleteSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[100]"
          >
            <CheckCircle2 size={20} />
            Tarefa excluída com sucesso!
          </motion.div>
        )}
        {showUpdateSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[100]"
          >
            <CheckCircle2 size={20} />
            Data atualizada com sucesso!
          </motion.div>
        )}
      </AnimatePresence>
      
      <DemandDetailsModal
        demand={selectedDemand}
        isOpen={!!selectedDemand}
        onClose={() => setSelectedDemand(null)}
        isDarkMode={isDarkMode}
        onUpdateStatus={handleUpdateDemandStatus}
        onDelete={handleDeleteDemand}
      />

      <DemandModal
        isOpen={isDemandModalOpen}
        onClose={() => setIsDemandModalOpen(false)}
        user={user}
      />

      {renderTaskDetails()}
    </div>
  );
}

export default function TasksPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    }>
      <TasksContent />
    </React.Suspense>
  );
}
