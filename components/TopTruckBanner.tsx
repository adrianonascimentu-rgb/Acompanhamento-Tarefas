'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Truck, 
  Clock, 
  Edit3, 
  History, 
  Sparkles,
} from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { 
  TruckScheduleData, 
  fetchTruckSchedule, 
  updateTruckSchedule, 
  DEFAULT_TRUCK_SCHEDULE 
} from '@/lib/truckSchedule';
import { TruckScheduleModal } from '@/components/TruckScheduleModal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function TopTruckBanner() {
  const pathname = usePathname();
  const isHomePage = pathname === '/' || pathname === '';
  const { role, isAdmin, user, isAuthenticated } = useRole();
  const { isDarkMode } = useTheme();
  
  // Apenas Administrador, Gerente ou Supervisor podem editar
  const canEdit = isAdmin || role === 'gerente' || role === 'supervisor';

  const [scheduleData, setScheduleData] = useState<TruckScheduleData>(DEFAULT_TRUCK_SCHEDULE);
  const [, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchTruckSchedule();
      setScheduleData(data);
    } catch (e) {
      console.warn('Erro ao carregar dados do caminhão:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Ouvir alterações em tempo real na tabela system_settings
    const isConfigured =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

    if (isConfigured) {
      const channel = supabase
        .channel('public:truck-schedule-banner')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_settings', filter: 'key=eq.truck_replenishment_schedule' },
          (payload: any) => {
            if (payload?.new?.value) {
              setScheduleData(payload.new.value);
            } else {
              loadData();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [loadData]);

  const handleSaveData = async (newData: any) => {
    const res = await updateTruckSchedule({
      ...newData,
      updated_by_name: user?.name || (isAdmin ? 'Administrador' : role)
    });
    if (res.success) {
      setScheduleData(res.data);
    }
  };

  // Calcular a diferença em dias entre a data do próximo carro e a data atual
  const getDaysUntilArrival = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
      if (isNaN(d.getTime())) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const target = new Date(d);
      target.setHours(0, 0, 0, 0);

      const diffTime = target.getTime() - today.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  // Formatar datas para exibição amigável em Português
  const formatFriendlyDate = (dateStr: string | null) => {
    if (!dateStr) return 'Não informada';
    try {
      const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
      if (isNaN(d.getTime())) return dateStr;

      const diffDays = getDaysUntilArrival(dateStr);

      const formatted = d.toLocaleDateString('pt-BR', { 
        weekday: 'short', 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });

      if (diffDays === 0) return `Hoje (${formatted})`;
      if (diffDays === 1) return `Amanhã (${formatted})`;
      if (diffDays === -1) return `Ontem (${formatted})`;
      if (diffDays !== null && diffDays > 1 && diffDays <= 7) return `Em ${diffDays} dias (${formatted})`;

      return formatted;
    } catch (e) {
      return dateStr;
    }
  };

  // Se o usuário não estiver autenticado, não renderiza o balão
  if (!isAuthenticated && !user) {
    return null;
  }

  const daysUntilArrival = getDaysUntilArrival(scheduleData.next_arrival_date);

  // Esquema visual dinâmico com cores confortáveis para não cansar a vista:
  // - 1 dia restante (diffDays === 1): Amarelo / Âmbar agradável
  // - Dia da chegada (diffDays === 0): Verde Esmeralda agradável
  // - Mais de 1 dia ou padrão: Azul suave
  const getBannerStyles = () => {
    if (daysUntilArrival === 0) {
      // HOJE - Verde agradável e suave
      return {
        bannerBg: isDarkMode 
          ? 'bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border-emerald-500/40 text-white shadow-emerald-500/10' 
          : 'bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-600 border-emerald-400/50 text-white shadow-emerald-500/20',
        badgeBg: 'bg-emerald-300 text-slate-950',
        badgeLabel: '🚚 CHEGA HOJE!',
        buttonTextColor: 'text-emerald-800'
      };
    } else if (daysUntilArrival === 1) {
      // FALTA 1 DIA (AMANHÃ) - Amarelo/Âmbar acolhedor que não cansa a vista
      return {
        bannerBg: isDarkMode 
          ? 'bg-gradient-to-r from-amber-950 via-yellow-950 to-slate-900 border-amber-500/40 text-white shadow-amber-500/10' 
          : 'bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-600 border-amber-400/50 text-white shadow-amber-500/20',
        badgeBg: 'bg-yellow-300 text-slate-950',
        badgeLabel: '⚠️ CHEGA AMANHÃ!',
        buttonTextColor: 'text-amber-900'
      };
    } else {
      // PADRÃO - Azul suave
      return {
        bannerBg: isDarkMode 
          ? 'bg-gradient-to-r from-slate-900 via-indigo-950/80 to-blue-950/80 border-indigo-500/30 text-white shadow-indigo-500/5' 
          : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 border-blue-500/40 text-white shadow-blue-500/20',
        badgeBg: 'bg-amber-400 text-slate-950',
        badgeLabel: 'Caminhão de Reposição',
        buttonTextColor: 'text-blue-700'
      };
    }
  };

  const { bannerBg, badgeBg, badgeLabel, buttonTextColor } = getBannerStyles();

  const nextDateDisplay = formatFriendlyDate(scheduleData.next_arrival_date);
  const lastDateDisplay = formatFriendlyDate(scheduleData.last_arrival_date);

  const hasNextDate = !!scheduleData.next_arrival_date;

  return (
    <>
      <div className={`${isHomePage ? 'w-full' : 'hidden md:block w-full'} px-3 sm:px-4 md:px-6 pt-3 pb-1`}>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-2xl md:rounded-3xl border shadow-lg transition-all duration-300 ${bannerBg}`}
        >
          {/* Background Ambient Glow */}
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute left-1/3 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative p-3.5 sm:p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            {/* Lado Esquerdo: Ícone e Texto em Destaque */}
            <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
              <div className="w-11 h-11 md:w-13 md:h-13 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Truck className="size-6 md:size-7 animate-pulse text-white" />
              </div>

              <div className="flex flex-col min-w-0">
                {/* Linha Superior: Selo e Título */}
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider ${badgeBg} shadow-sm flex items-center gap-1`}>
                    <Sparkles size={11} className="fill-current" />
                    {badgeLabel}
                  </span>
                  {canEdit && (
                    <span className="hidden md:inline text-[10px] text-white/75 font-medium">
                      (Apenas Admin / Gerente / Supervisor editam)
                    </span>
                  )}
                </div>

                {/* Destaque Principal: DATA DO PRÓXIMO CARRO */}
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xs md:text-sm font-medium text-white/90">
                    Próximo Carro:
                  </span>
                  <span className="text-sm md:text-base lg:text-lg font-black tracking-tight text-white drop-shadow-sm">
                    {hasNextDate ? nextDateDisplay : 'Aguardando definição'}
                  </span>
                </div>

                {/* Texto Menor Logo Abaixo: DATA DO ÚLTIMO CARRO */}
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] md:text-xs text-white/80 font-medium">
                  <Clock size={12} className="shrink-0 text-white/60" />
                  <span>Último Carro Recebido:</span>
                  <strong className="font-bold text-white/95">{lastDateDisplay}</strong>
                </div>
              </div>
            </div>

            {/* Lado Direito: Ações (Alterar Datas para Gestores e Ver Histórico) */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15 shrink-0">
              {/* Link para o Histórico / Relatório de Caminhões */}
              <Link
                href="/reports/truck-history"
                className="flex-1 sm:flex-initial justify-center px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white text-xs font-bold flex items-center gap-1.5 border border-white/15 backdrop-blur-sm whitespace-nowrap"
                title="Visualizar histórico completo com motoristas e ajudantes"
              >
                <History size={14} className="shrink-0" />
                <span className="hidden sm:inline">Histórico & Relatório</span>
                <span className="sm:hidden">Relatório</span>
              </Link>

              {/* Botão de Alteração Exclusivo para Gestores */}
              {canEdit && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className={`flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-xl bg-white ${buttonTextColor} hover:bg-white/95 active:scale-95 transition-all text-xs font-black shadow-md shadow-black/10 flex items-center gap-1.5 whitespace-nowrap`}
                >
                  <Edit3 size={14} className="shrink-0" />
                  <span>Alterar Datas</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal de Configuração de Datas e Registro de Chegada */}
      {canEdit && (
        <TruckScheduleModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          data={scheduleData}
          onSave={handleSaveData}
          isDarkMode={isDarkMode}
        />
      )}
    </>
  );
}
