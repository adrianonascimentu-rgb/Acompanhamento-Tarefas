'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { useUI } from '@/hooks/useUI';
import { DemandModal } from '@/components/dashboard/DemandModal';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Tag,
  Trash2,
  X,
  Send,
  Loader2,
  Eye,
  Inbox,
  CheckCheck,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Save,
  Check,
  Edit3,
  Calendar,
  Filter,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Demand {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  category: string;
  status: string;
  notes?: string | null;
  created_at: string;
}

type DemandStatusKey = 'recebido' | 'revisao' | 'finalizado';

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    icon: any;
    color: string;
    bgLight: string;
    bgDark: string;
    borderLight: string;
    borderDark: string;
    badgeLight: string;
    badgeDark: string;
  }
> = {
  'recebido': {
    label: 'Recebido',
    icon: Inbox,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50',
    bgDark: 'bg-amber-950/40',
    borderLight: 'border-amber-200',
    borderDark: 'border-amber-800/60',
    badgeLight: 'bg-amber-100 text-amber-800 border-amber-200',
    badgeDark: 'bg-amber-950/70 text-amber-300 border-amber-800/70'
  },
  'revisao': {
    label: 'Revisão',
    icon: Eye,
    color: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-50',
    bgDark: 'bg-blue-950/40',
    borderLight: 'border-blue-200',
    borderDark: 'border-blue-800/60',
    badgeLight: 'bg-blue-100 text-blue-800 border-blue-200',
    badgeDark: 'bg-blue-950/70 text-blue-300 border-blue-800/70'
  },
  'finalizado': {
    label: 'Finalizado',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50',
    bgDark: 'bg-emerald-950/40',
    borderLight: 'border-emerald-200',
    borderDark: 'border-emerald-800/60',
    badgeLight: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    badgeDark: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70'
  },
  'pending': {
    label: 'Recebido',
    icon: Inbox,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50',
    bgDark: 'bg-amber-950/40',
    borderLight: 'border-amber-200',
    borderDark: 'border-amber-800/60',
    badgeLight: 'bg-amber-100 text-amber-800 border-amber-200',
    badgeDark: 'bg-amber-950/70 text-amber-300 border-amber-800/70'
  }
};

function normalizeStatus(rawStatus?: string): 'recebido' | 'revisao' | 'finalizado' {
  if (!rawStatus) return 'recebido';
  const s = rawStatus.toLowerCase().trim();
  if (s === 'finalizado' || s === 'concluído' || s === 'concluido' || s === 'completed') {
    return 'finalizado';
  }
  if (s === 'revisao' || s === 'revisão' || s === 'reviewed' || s === 'em andamento') {
    return 'revisao';
  }
  return 'recebido';
}

const LOCAL_NOTES_PREFIX = 'demand_note_';

function getStoredNote(demandId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(`${LOCAL_NOTES_PREFIX}${demandId}`) || '';
  } catch (e) {
    return '';
  }
}

function saveStoredNote(demandId: string, note: string) {
  if (typeof window === 'undefined') return;
  try {
    if (!note) {
      localStorage.removeItem(`${LOCAL_NOTES_PREFIX}${demandId}`);
    } else {
      localStorage.setItem(`${LOCAL_NOTES_PREFIX}${demandId}`, note);
    }
  } catch (e) {}
}

export default function DemandsPage() {
  const { isDarkMode } = useTheme();
  const { user, role, isAdmin } = useRole();
  const { showToast, showConfirm } = useUI();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'Todas' | 'recebido' | 'revisao' | 'finalizado'>('Todas');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // State for expanded viewing modal
  const [selectedDemandToView, setSelectedDemandToView] = useState<Demand | null>(null);
  const [notesState, setNotesState] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDemands = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('demands')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin && role !== 'gerente' && user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const loadedDemands: Demand[] = data || [];
      setDemands(loadedDemands);

      const initialNotes: Record<string, string> = {};
      loadedDemands.forEach((d) => {
        const local = getStoredNote(d.id);
        initialNotes[d.id] = d.notes || local || '';
      });
      setNotesState(initialNotes);
    } catch (error) {
      console.error('Error fetching demands:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, role, user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchDemands();
    } else {
      setLoading(false);
    }

    const channel = supabase
      .channel('demands_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demands' },
        () => {
          fetchDemands();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchDemands]);

  const handleUpdateStatus = async (demandId: string, targetStatus: 'recebido' | 'revisao' | 'finalizado') => {
    try {
      setUpdatingId(demandId);
      setDemands(prev =>
        prev.map(d => (d.id === demandId ? { ...d, status: targetStatus } : d))
      );

      const { error } = await supabase
        .from('demands')
        .update({ status: targetStatus })
        .eq('id', demandId);

      if (error) throw error;

      const statusLabel = STATUS_CONFIG[targetStatus]?.label || targetStatus;
      showToast(`Demanda marcada como "${statusLabel}"!`, 'success');
    } catch (error: any) {
      console.error('Error updating demand status:', error);
      showToast('Erro ao atualizar status da demanda.', 'error');
      fetchDemands();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNote = async (demandId: string) => {
    const noteText = notesState[demandId] || '';
    setSavingNoteId(demandId);
    saveStoredNote(demandId, noteText);

    try {
      const { error } = await supabase
        .from('demands')
        .update({ notes: noteText })
        .eq('id', demandId);

      if (error && error.code !== 'PGRST204' && !error.message?.includes('notes')) {
        console.warn('Erro ao persistir nota no Supabase:', error.message);
      }

      setDemands(prev => prev.map(d => d.id === demandId ? { ...d, notes: noteText } : d));
      setSavedSuccessId(demandId);
      showToast('Observação salva com sucesso!', 'success');
      setTimeout(() => setSavedSuccessId(null), 2500);
    } catch (err: any) {
      console.warn('Aviso ao salvar nota:', err);
      showToast('Observação salva localmente!', 'info');
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleDeleteDemand = async (id: string) => {
    showConfirm({
      title: 'Excluir Demanda',
      message: 'Tem certeza que deseja excluir esta solicitação?',
      type: 'danger',
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('demands')
            .delete()
            .eq('id', id);

          if (error) throw error;
          saveStoredNote(id, '');
          setDemands(prev => prev.filter(d => d.id !== id));
          showToast('Demanda excluída com sucesso!', 'success');
        } catch (error) {
          console.error('Error deleting demand:', error);
          showToast('Erro ao excluir demanda.', 'error');
        }
      }
    });
  };

  const handleConsolidateDemands = async () => {
    const demandsToConsolidate = demands.filter(d => d.category?.toLowerCase() === 'pedido de material' && d.status === 'a solicitar');

    if (demandsToConsolidate.length === 0) {
      showToast('Não há pedidos de material pendentes para consolidar.', 'warning');
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      showConfirm({
        title: 'Consolidar Pedidos',
        message: `Você tem certeza que deseja consolidar ${demandsToConsolidate.length} pedidos de material em um único pedido?`,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
        type: 'info'
      });
    });
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      const consolidatedContent = demandsToConsolidate.map(d => `--- Pedido de ${d.user_name} ---\n${d.content}`).join('\n\n');
      
      const { error: insertError } = await supabase.from('demands').insert([
        {
          user_id: user?.id,
          user_name: user?.name || 'Administrador',
          content: `**PEDIDO CONSOLIDADO - ${new Date().toLocaleDateString()}**\n\n${consolidatedContent}`,
          category: 'pedido de material',
          status: 'solicitado'
        }
      ]);
      
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('demands')
        .update({ status: 'solicitado' })
        .in('id', demandsToConsolidate.map(d => d.id));
        
      if (updateError) throw updateError;

      fetchDemands();
      showToast('Pedidos consolidados com sucesso!', 'success');
    } catch (error) {
      console.error('Error consolidating demands:', error);
      showToast('Erro ao consolidar pedidos.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grouping metrics
  const totalCount = demands.length;
  const recebidoCount = demands.filter(d => normalizeStatus(d.status) === 'recebido').length;
  const revisaoCount = demands.filter(d => normalizeStatus(d.status) === 'revisao').length;
  const finalizadoCount = demands.filter(d => normalizeStatus(d.status) === 'finalizado').length;

  const filteredDemands = demands.filter(d => {
    const norm = normalizeStatus(d.status);
    const demandNote = notesState[d.id] || d.notes || '';
    const matchesSearch = 
      d.content?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      d.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      demandNote.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = activeFilter === 'Todas' || norm === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className={`min-h-screen p-3 sm:p-5 md:p-8 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header (Responsive Layout) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <ClipboardList size={22} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                Gestão de Demandas
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Acompanhamento, Observações e Status em Tempo Real
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            {(isAdmin || role === 'gerente') && (
              <button
                type="button"
                onClick={handleConsolidateDemands}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs shrink-0"
              >
                <Save size={14} />
                <span className="truncate">Consolidar</span>
              </button>
            )}

            <button 
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl sm:rounded-2xl text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-95 shrink-0"
            >
              <Plus size={16} />
              <span>Nova Demanda</span>
            </button>
          </div>
        </div>

        {/* Stats & Filter Cards (High-Contrast, Touch-Friendly Responsive Grid) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Total */}
          <button 
            type="button"
            onClick={() => setActiveFilter('Todas')}
            className={`p-3.5 sm:p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-98 relative overflow-hidden ${
              activeFilter === 'Todas' 
                ? 'ring-2 ring-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-sm' 
                : isDarkMode 
                ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-100' 
                : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Todas
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ClipboardList size={15} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
              {totalCount}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-1">
              Todas solicitações
            </p>
          </button>

          {/* Recebidos */}
          <button 
            type="button"
            onClick={() => setActiveFilter('recebido')}
            className={`p-3.5 sm:p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-98 relative overflow-hidden ${
              activeFilter === 'recebido' 
                ? 'ring-2 ring-amber-500 bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-sm' 
                : isDarkMode 
                ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-100' 
                : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Recebidas
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Inbox size={15} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {recebidoCount}
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300/80 font-semibold mt-1">
              Aguardando início
            </p>
          </button>

          {/* Em Revisão */}
          <button 
            type="button"
            onClick={() => setActiveFilter('revisao')}
            className={`p-3.5 sm:p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-98 relative overflow-hidden ${
              activeFilter === 'revisao' 
                ? 'ring-2 ring-blue-600 bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-sm' 
                : isDarkMode 
                ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-100' 
                : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs sm:text-sm font-black text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                Revisão
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Eye size={15} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {revisaoCount}
            </p>
            <p className="text-[11px] text-blue-800 dark:text-blue-300/80 font-semibold mt-1">
              Em análise técnica
            </p>
          </button>

          {/* Finalizadas */}
          <button 
            type="button"
            onClick={() => setActiveFilter('finalizado')}
            className={`p-3.5 sm:p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-98 relative overflow-hidden ${
              activeFilter === 'finalizado' 
                ? 'ring-2 ring-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-sm' 
                : isDarkMode 
                ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-100' 
                : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                Finalizadas
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={15} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {finalizadoCount}
            </p>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300/80 font-semibold mt-1">
              Atendidas / Prontas
            </p>
          </button>
        </div>

        {/* Search Bar & Status Filter Tabs Bar */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input 
              type="text" 
              placeholder="Pesquisar demandas, solicitante, categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium focus:outline-none transition-all ${
                isDarkMode 
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500' 
                  : 'bg-white border border-slate-200/90 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 shadow-xs'
              }`}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Status Tabs Bar (Legible, High-Contrast & Touch-Friendly) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5">
            {[
              { id: 'Todas', label: 'Todas', count: totalCount, icon: ClipboardList, activeBg: 'bg-indigo-600 text-white', inactiveBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700' },
              { id: 'recebido', label: 'Recebido', count: recebidoCount, icon: Inbox, activeBg: 'bg-amber-500 text-white', inactiveBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60' },
              { id: 'revisao', label: 'Revisão', count: revisaoCount, icon: Eye, activeBg: 'bg-blue-600 text-white', inactiveBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60' },
              { id: 'finalizado', label: 'Finalizado', count: finalizadoCount, icon: CheckCircle2, activeBg: 'bg-emerald-600 text-white', inactiveBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60' },
            ].map((tab) => {
              const isSelected = activeFilter === tab.id;
              const TabIcon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id as any)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 border cursor-pointer active:scale-95 ${
                    isSelected
                      ? `${tab.activeBg} border-transparent shadow-xs font-black`
                      : `${tab.inactiveBg} hover:opacity-90`
                  }`}
                >
                  <TabIcon size={14} className="shrink-0" />
                  <span>{tab.label}</span>
                  <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                    isSelected 
                      ? 'bg-black/20 text-white' 
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xs'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Demands Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className={`h-64 rounded-2xl animate-pulse ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200/80'}`} />
            ))
          ) : filteredDemands.length > 0 ? (
            <AnimatePresence>
              {filteredDemands.map((demand) => {
                const normStatus = normalizeStatus(demand.status);
                const currentConfig = STATUS_CONFIG[normStatus] || STATUS_CONFIG['recebido'];
                const StatusIcon = currentConfig.icon;
                const isUpdating = updatingId === demand.id;
                const isSavingThisNote = savingNoteId === demand.id;
                const isSavedThisNote = savedSuccessId === demand.id;
                const currentNote = notesState[demand.id] !== undefined ? notesState[demand.id] : (demand.notes || '');

                return (
                  <motion.div
                    key={demand.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all flex flex-col justify-between gap-3 relative ${
                      isDarkMode 
                        ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-md shadow-black/20' 
                        : 'bg-white border-slate-200/80 hover:border-indigo-200 shadow-xs hover:shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Top Bar: Category & Status Badge & Actions */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {/* Current Status Pill */}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                            isDarkMode ? currentConfig.badgeDark : currentConfig.badgeLight
                          }`}>
                            <StatusIcon size={12} />
                            <span>{currentConfig.label}</span>
                          </span>

                          {/* Category Pill */}
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider truncate shrink-0 ${
                            isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {demand.category || 'Geral'}
                          </span>
                        </div>

                        {(isAdmin || user?.id === demand.user_id) && (
                          <button 
                            type="button"
                            onClick={() => handleDeleteDemand(demand.id)}
                            title="Excluir demanda"
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all shrink-0 cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      
                      {/* Demand Content / Message */}
                      <div 
                        onClick={() => setSelectedDemandToView(demand)}
                        className="cursor-pointer group/content bg-slate-50/60 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-2.5 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                        title="Toque para ver o texto completo"
                      >
                        <p className={`text-xs sm:text-sm font-medium leading-relaxed line-clamp-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {demand.content}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 group-hover/content:underline">
                          <span>Ver detalhes completos</span>
                          <ArrowRight size={11} />
                        </div>
                      </div>

                      {/* Observations / Comments Box */}
                      <div className="p-2.5 sm:p-3 rounded-xl border bg-slate-50/80 dark:bg-slate-950/60 border-slate-200/70 dark:border-slate-800/70 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <MessageSquare size={12} className="text-indigo-500" />
                            <span>Observação / Parecer</span>
                          </label>
                          {isSavedThisNote && (
                            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                              <Check size={11} /> Salvo!
                            </span>
                          )}
                        </div>

                        <textarea
                          rows={2}
                          placeholder="Adicione um parecer ou nota..."
                          value={currentNote}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNotesState(prev => ({ ...prev, [demand.id]: val }));
                          }}
                          className={`w-full p-2 text-xs font-medium rounded-lg outline-none resize-none transition-all ${
                            isDarkMode 
                              ? 'bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500' 
                              : 'bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500'
                          }`}
                        />

                        <div className="flex justify-end pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleSaveNote(demand.id)}
                            disabled={isSavingThisNote}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all shadow-2xs active:scale-95 cursor-pointer ${
                              isSavedThisNote 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            } disabled:opacity-50`}
                          >
                            {isSavingThisNote ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : isSavedThisNote ? (
                              <Check size={11} />
                            ) : (
                              <Save size={11} />
                            )}
                            <span>{isSavingThisNote ? 'Salvando...' : isSavedThisNote ? 'Salvo' : 'Salvar Nota'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Status Action Buttons & User / Date Footer */}
                    <div className="space-y-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      {/* Status Selector Grid (Optimized for Mobile Touch) */}
                      <div>
                        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                          <span>Alterar Status:</span>
                          {isUpdating && <Loader2 size={10} className="animate-spin text-indigo-500" />}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1.5">
                          {/* Recebido */}
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(demand.id, 'recebido')}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                              normStatus === 'recebido'
                                ? 'bg-amber-500 text-white shadow-xs font-black'
                                : isDarkMode
                                ? 'bg-slate-800/80 text-amber-400 hover:bg-amber-950/40 border border-slate-800'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                            }`}
                          >
                            <Inbox size={13} />
                            <span>Recebido</span>
                          </button>

                          {/* Revisão */}
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(demand.id, 'revisao')}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                              normStatus === 'revisao'
                                ? 'bg-blue-600 text-white shadow-xs font-black'
                                : isDarkMode
                                ? 'bg-slate-800/80 text-blue-400 hover:bg-blue-950/40 border border-slate-800'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
                            }`}
                          >
                            <Eye size={13} />
                            <span>Revisão</span>
                          </button>

                          {/* Finalizado */}
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(demand.id, 'finalizado')}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                              normStatus === 'finalizado'
                                ? 'bg-emerald-600 text-white shadow-xs font-black'
                                : isDarkMode
                                ? 'bg-slate-800/80 text-emerald-400 hover:bg-emerald-950/40 border border-slate-800'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                            }`}
                          >
                            <CheckCircle2 size={13} />
                            <span>Finalizado</span>
                          </button>
                        </div>
                      </div>

                      {/* Requester & Date Info */}
                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <div className="size-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[9px] shrink-0">
                            {demand.user_name ? demand.user_name.charAt(0).toUpperCase() : <User size={10} />}
                          </div>
                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
                            {demand.user_name || 'Colaborador'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-[10px]">
                          <Calendar size={11} className="text-slate-400" />
                          <span>{demand.created_at ? new Date(demand.created_at).toLocaleDateString('pt-BR') : ''}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          ) : (
            <div className="col-span-full py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
              <div className={`size-16 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'
              }`}>
                <ClipboardList size={30} />
              </div>
              <h3 className="text-base font-bold mb-1 text-slate-900 dark:text-white">Nenhuma demanda encontrada</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto px-4">
                {searchQuery || activeFilter !== 'Todas' 
                  ? 'Tente alterar os filtros ou o termo de busca para localizar sua solicitação.' 
                  : 'Comece criando uma nova solicitação clicando em "Nova Demanda".'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Demand Modal */}
      <DemandModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        user={user} 
      />

      {/* Expanded Demand Message Modal */}
      <AnimatePresence>
        {selectedDemandToView && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDemandToView(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`relative w-full max-w-2xl rounded-2xl sm:rounded-3xl overflow-hidden border shadow-2xl ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
              }`}
            >
              <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
                isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <MessageSquare size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight truncate">Detalhes da Demanda</h3>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                      Por <span className="text-indigo-500 font-bold">{selectedDemandToView.user_name}</span> em {selectedDemandToView.created_at ? new Date(selectedDemandToView.created_at).toLocaleString('pt-BR') : ''}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDemandToView(null)}
                  className={`p-2 rounded-xl transition-colors shrink-0 ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    isDarkMode ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-800/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    {selectedDemandToView.category || 'Geral'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                  }`}>
                    Status: {selectedDemandToView.status || 'Recebido'}
                  </span>
                </div>

                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950/50 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Mensagem Completa</h4>
                  <div className="text-xs sm:text-sm font-medium whitespace-pre-wrap leading-relaxed overflow-x-auto">
                    {selectedDemandToView.content}
                  </div>
                </div>

                {selectedDemandToView.notes && (
                  <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-amber-950/20 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Comentário / Observação</h4>
                    <p className="text-xs whitespace-pre-wrap font-medium">{selectedDemandToView.notes}</p>
                  </div>
                )}
              </div>

              <div className={`p-3.5 sm:p-4 border-t flex justify-end ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
                <button
                  onClick={() => setSelectedDemandToView(null)}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all active:scale-95"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
