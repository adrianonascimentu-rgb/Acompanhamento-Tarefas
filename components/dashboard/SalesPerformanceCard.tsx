'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, ArrowUpRight, Target, CheckCircle2, Award, Zap, Users, AlertTriangle, Sparkles, Clock, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { gsap } from 'gsap';
import { useRole } from '@/hooks/useRole';

interface SalesPerformanceCardProps {
  isDarkMode?: boolean;
}

export function SalesPerformanceCard({ isDarkMode }: SalesPerformanceCardProps) {
  const { role, user, isAdmin } = useRole();
  const [performance, setPerformance] = useState<{
    totalGoal: number;
    totalResult: number;
    percentage: number;
    sellersCount: number;
  }>({
    totalGoal: 0,
    totalResult: 0,
    percentage: 0,
    sellersCount: 0
  });
  const [loading, setLoading] = useState(true);

  const circleRef = useRef<SVGCircleElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const resultNumRef = useRef<HTMLParagraphElement>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonthName = now.toLocaleString('pt-BR', { month: 'long' });
  const formattedMonthName = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
  const currentDay = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDay);

  const isManagerial = isAdmin || role === 'gerente' || role === 'supervisor';

  useEffect(() => {
    async function fetchSalesResults() {
      try {
        setLoading(true);

        // Fetch active sellers/collaborators eligible for sales
        let profileQuery = supabase
          .from('profiles')
          .select('id, name');
        
        if (!isManagerial && user?.id) {
          profileQuery = profileQuery.eq('id', user.id);
        } else {
          profileQuery = profileQuery.or('type.eq.vendedor,can_access_sales.eq.true');
        }

        const { data: sellers } = await profileQuery;
        const sellerIds = (sellers || []).map(s => s.id);

        if (sellerIds.length === 0 && !isManagerial) {
          setPerformance({ totalGoal: 0, totalResult: 0, percentage: 0, sellersCount: 0 });
          setLoading(false);
          return;
        }

        // Fetch sales results for current month
        let salesQuery = supabase
          .from('sales_results')
          .select('collaborator_id, target_2026, result_2026, month, year')
          .eq('month', currentMonth)
          .eq('year', currentYear);
        
        if (!isManagerial && user?.id) {
          salesQuery = salesQuery.eq('collaborator_id', user.id);
        } else if (sellerIds.length > 0) {
          salesQuery = salesQuery.in('collaborator_id', sellerIds);
        }

        const { data, error } = await salesQuery;

        if (!error && data && data.length > 0) {
          const relevantData = sellerIds.length > 0
            ? data.filter(curr => sellerIds.includes(curr.collaborator_id))
            : data;

          const totalGoal = relevantData.reduce((acc, curr) => acc + (parseFloat(curr.target_2026) || 0), 0);
          const totalResult = relevantData.reduce((acc, curr) => acc + (parseFloat(curr.result_2026) || 0), 0);
          const percentage = totalGoal > 0 ? Math.round((totalResult / totalGoal) * 1000) / 10 : 0;
          
          setPerformance({ 
            totalGoal, 
            totalResult, 
            percentage,
            sellersCount: relevantData.length
          });
        } else {
          // Fallback: search most recent recorded period
          let fallbackQuery = supabase
            .from('sales_results')
            .select('collaborator_id, target_2026, result_2026, month, year')
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(10);
          
          if (!isManagerial && user?.id) {
            fallbackQuery = fallbackQuery.eq('collaborator_id', user.id);
          } else if (sellerIds.length > 0) {
            fallbackQuery = fallbackQuery.in('collaborator_id', sellerIds);
          }

          const { data: fallbackData } = await fallbackQuery;

          if (fallbackData && fallbackData.length > 0) {
            const latestMonth = fallbackData[0].month;
            const latestYear = fallbackData[0].year;
            const monthEntries = fallbackData.filter(d => d.month === latestMonth && d.year === latestYear);
            const totalGoal = monthEntries.reduce((acc, curr) => acc + (parseFloat(curr.target_2026) || 0), 0);
            const totalResult = monthEntries.reduce((acc, curr) => acc + (parseFloat(curr.result_2026) || 0), 0);
            const percentage = totalGoal > 0 ? Math.round((totalResult / totalGoal) * 1000) / 10 : 0;
            setPerformance({ 
              totalGoal, 
              totalResult, 
              percentage,
              sellersCount: monthEntries.length 
            });
          } else {
            setPerformance({ totalGoal: 0, totalResult: 0, percentage: 0, sellersCount: 0 });
          }
        }
      } catch (err) {
        console.error('Error fetching sales performance data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSalesResults();

    const channel = supabase
      .channel('sales_results_current_month_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_results' }, () => {
        fetchSalesResults();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMonth, currentYear, isManagerial, role, user?.id]);

  // Gauge calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.min(100, Math.max(0, performance.percentage));
  const targetStrokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  const isGoalReached = performance.totalGoal > 0 && performance.totalResult >= performance.totalGoal;
  const gapValue = performance.totalGoal - performance.totalResult;

  // Status and color theme
  const getStatusInfo = () => {
    if (performance.totalGoal === 0) {
      return {
        label: 'Aguardando Metas',
        badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        strokeColor: 'text-slate-400 dark:text-slate-500',
        progressGradient: 'from-slate-400 to-slate-500',
        icon: Clock,
      };
    }
    if (isGoalReached) {
      return {
        label: 'Meta Superada 🚀',
        badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        strokeColor: 'text-emerald-500 dark:text-emerald-400',
        progressGradient: 'from-emerald-500 to-teal-400',
        icon: Sparkles,
      };
    }
    if (performance.percentage >= 75) {
      return {
        label: 'Excelente Ritmo 🔥',
        badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        strokeColor: 'text-blue-500 dark:text-blue-400',
        progressGradient: 'from-blue-500 to-indigo-500',
        icon: TrendingUp,
      };
    }
    if (performance.percentage >= 40) {
      return {
        label: 'Em Andamento 📈',
        badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        strokeColor: 'text-amber-500 dark:text-amber-400',
        progressGradient: 'from-amber-500 to-orange-400',
        icon: BarChart2,
      };
    }
    return {
      label: 'Atenção ao Ritmo ⚠️',
      badgeColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      strokeColor: 'text-rose-500 dark:text-rose-400',
      progressGradient: 'from-rose-500 to-pink-500',
      icon: AlertTriangle,
    };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  // GSAP animation
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      if (circleRef.current) {
        gsap.fromTo(
          circleRef.current,
          { strokeDashoffset: circumference },
          {
            strokeDashoffset: targetStrokeDashoffset,
            duration: 1.4,
            ease: 'power3.out',
            delay: 0.1,
          }
        );
      }

      if (barRef.current) {
        gsap.fromTo(
          barRef.current,
          { width: '0%' },
          {
            width: `${clampedPercentage}%`,
            duration: 1.4,
            ease: 'power3.out',
            delay: 0.15,
          }
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [circumference, targetStrokeDashoffset, clampedPercentage]);

  return (
    <div
      ref={containerRef}
      className={`p-5 sm:p-6 rounded-3xl border transition-all flex flex-col justify-between gap-5 relative overflow-hidden shadow-sm hover:shadow-md ${
        isDarkMode 
          ? 'bg-gradient-to-br from-slate-900 via-slate-900/98 to-slate-950 border-slate-800/90 shadow-slate-950/50' 
          : 'bg-gradient-to-br from-white via-white to-slate-50/80 border-slate-200/90'
      }`}
    >
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/25 shadow-inner">
            <TrendingUp size={22} className="stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Performance de Vendas
              </h3>
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-lg border border-emerald-500/20 whitespace-nowrap shadow-2xs">
                {formattedMonthName} {currentYear}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
              {isManagerial ? 'Equipe Comercial • Acompanhamento Global' : 'Meu Desempenho Individual • Acompanhamento'}
            </p>
          </div>
        </div>

        <Link 
          href="/sales-results" 
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800/80 transition-all shrink-0 active:scale-95 shadow-2xs"
          title="Ver Módulo de Vendas Completo"
        >
          <span>Painel Detalhado</span>
          <ArrowUpRight size={14} className="stroke-[2.5]" />
        </Link>
      </div>

      {/* Main Stats Showcase & Circular Gauge Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-slate-50/80 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 relative z-10 shadow-inner">
        
        {/* Left Stats Column */}
        <div className="md:col-span-8 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Zap size={13} className="stroke-[2.5]" />
              </div>
              <span className="text-[11px] uppercase font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                Faturamento Realizado vs Meta
              </span>
            </div>
            
            <div className="flex items-baseline gap-3 flex-wrap">
              <p 
                ref={resultNumRef}
                className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight"
              >
                {loading ? (
                  <span className="inline-block w-44 h-9 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
                ) : (
                  `R$ ${performance.totalResult.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                )}
              </p>
            </div>
          </div>

          {/* Target & Gap Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Target Box */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Target size={15} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Meta do Período</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {loading ? '...' : `R$ ${performance.totalGoal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Gap or Celebration Box */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isGoalReached ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                  {isGoalReached ? <CheckCircle2 size={15} /> : <Award size={15} />}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                    {isGoalReached ? 'Superávit' : 'Falta para a Meta'}
                  </span>
                  <span className={`text-xs sm:text-sm font-bold tabular-nums ${isGoalReached ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {loading ? '...' : `R$ ${Math.abs(gapValue).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Circular Gauge Column */}
        <div className="md:col-span-4 flex flex-col items-center justify-center pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-slate-200/60 dark:border-slate-800/80 md:pl-4">
          <div className="relative flex items-center justify-center">
            <svg className="w-28 h-28 transform -rotate-90">
              {/* Track */}
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                className="text-slate-200 dark:text-slate-700/60"
                fill="transparent"
              />
              {/* Animated Progress Arc */}
              <circle
                ref={circleRef}
                cx="56"
                cy="56"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference}
                strokeLinecap="round"
                className={`${status.strokeColor} transition-colors`}
                fill="transparent"
              />
            </svg>
            
            {/* Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {loading ? '...' : `${performance.percentage}%`}
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-400">
                Atingido
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`mt-3 flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border shadow-2xs ${status.badgeColor}`}>
            <StatusIcon size={13} className="shrink-0" />
            <span>{status.label}</span>
          </div>
        </div>
      </div>

      {/* Interactive Linear Progress Bar with Milestones */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <BarChart2 size={14} className="text-emerald-500" />
            <span>Progresso Geral do Mês</span>
          </div>
          <span className="tabular-nums px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold">
            {clampedPercentage.toFixed(1)}% / 100%
          </span>
        </div>

        {/* Bar */}
        <div className="relative w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/70 dark:border-slate-700/80 shadow-inner">
          <div
            ref={barRef}
            style={{ width: '0%' }}
            className={`h-full rounded-full bg-gradient-to-r ${status.progressGradient} transition-all shadow-xs`}
          />
        </div>

        {/* Milestone Labels */}
        <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">100% (Meta)</span>
        </div>
      </div>

      {/* Footer Quick Summary Tags & Days Remaining */}
      <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-3 text-xs relative z-10">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-slate-400" />
            <span>
              {isManagerial 
                ? `${performance.sellersCount} ${performance.sellersCount === 1 ? 'vendedor ativo' : 'vendedores ativos'}`
                : 'Performance Individual'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-blue-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {daysRemaining} {daysRemaining === 1 ? 'dia restante' : 'dias restantes'} no mês
            </span>
          </div>
        </div>

        <Link
          href="/sales-results"
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 group bg-blue-50/50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-lg border border-blue-200/50 dark:border-blue-900/50 transition-all"
        >
          <span>Gerenciar Metas & Vendas</span>
          <ArrowUpRight size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

