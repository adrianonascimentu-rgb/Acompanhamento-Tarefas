'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell, 
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Award, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  BarChart2
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export interface WeeklyTrendPoint {
  weekKey: string;
  weekLabel: string;
  dateRange: string;
  completed: number;
  target?: number;
  prevCompleted?: number;
}

export interface CollaboratorStat {
  id?: string;
  name: string;
  fullName: string;
  completed: number;
  avatarUrl?: string;
  percentage?: number;
  role?: string;
}

interface TaskPerformanceSectionProps {
  weeklyData?: WeeklyTrendPoint[];
  collaboratorData?: CollaboratorStat[];
  isLoading?: boolean;
}

// Custom Tooltip for Weekly Line Chart
const CustomLineTooltip = ({ active, payload, label, isDarkMode }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as WeeklyTrendPoint;
    const completed = data.completed ?? payload[0].value ?? 0;
    const prev = data.prevCompleted;
    const hasDiff = prev !== undefined && prev > 0;
    const diff = hasDiff ? Math.round(((completed - prev) / prev) * 100) : 0;
    const isPositive = diff >= 0;

    return (
      <div className={`p-3 rounded-xl border shadow-xl backdrop-blur-md min-w-[180px] transition-all ${
        isDarkMode 
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-100' 
          : 'bg-white/95 border-slate-200/90 text-slate-800'
      }`}>
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {data.weekLabel}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {data.dateRange}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-500 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Concluídas:
            </span>
          </div>
          <span className="text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {completed} {completed === 1 ? 'tarefa' : 'tarefas'}
          </span>
        </div>

        {hasDiff && (
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
            <span className="text-slate-400">Vs. anterior:</span>
            <span className={`inline-flex items-center font-bold tabular-nums ${
              isPositive ? 'text-emerald-500' : 'text-rose-500'
            }`}>
              {isPositive ? <ArrowUpRight size={13} className="mr-0.5" /> : <ArrowDownRight size={13} className="mr-0.5" />}
              {isPositive ? `+${diff}%` : `${diff}%`}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Collaborator Bar Chart
const CustomBarTooltip = ({ active, payload, isDarkMode, totalTeamTasks }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as CollaboratorStat;
    const completed = data.completed ?? payload[0].value ?? 0;
    const pct = totalTeamTasks > 0 ? Math.round((completed / totalTeamTasks) * 100) : data.percentage ?? 0;

    return (
      <div className={`p-3 rounded-xl border shadow-xl backdrop-blur-md min-w-[190px] transition-all ${
        isDarkMode 
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-100' 
          : 'bg-white/95 border-slate-200/90 text-slate-800'
      }`}>
        <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-xs">
            {data.fullName?.charAt(0) || data.name?.charAt(0) || 'C'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              {data.fullName || data.name}
            </p>
            {data.role && (
              <p className="text-[10px] text-slate-400 truncate capitalize">
                {data.role}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Entregas finalizadas:
          </span>
          <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
            {completed}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
          <span className="text-slate-400">Participação:</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
            {pct}% do time
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Default high-fidelity sample data if no tasks in database yet
const DEFAULT_WEEKLY_DATA_6W: WeeklyTrendPoint[] = [
  { weekKey: 'w1', weekLabel: 'Sem 1', dateRange: '11/Ago - 17/Ago', completed: 9, prevCompleted: 7 },
  { weekKey: 'w2', weekLabel: 'Sem 2', dateRange: '18/Ago - 24/Ago', completed: 14, prevCompleted: 9 },
  { weekKey: 'w3', weekLabel: 'Sem 3', dateRange: '25/Ago - 31/Ago', completed: 12, prevCompleted: 14 },
  { weekKey: 'w4', weekLabel: 'Sem 4', dateRange: '01/Set - 07/Set', completed: 18, prevCompleted: 12 },
  { weekKey: 'w5', weekLabel: 'Sem 5', dateRange: '08/Set - 14/Set', completed: 16, prevCompleted: 18 },
  { weekKey: 'w6', weekLabel: 'Sem 6', dateRange: '15/Set - 21/Set', completed: 23, prevCompleted: 16 },
];

const DEFAULT_WEEKLY_DATA_12W: WeeklyTrendPoint[] = [
  { weekKey: 'w1', weekLabel: 'Sem 1', dateRange: '30/Jun - 06/Jul', completed: 8, prevCompleted: 7 },
  { weekKey: 'w2', weekLabel: 'Sem 2', dateRange: '07/Jul - 13/Jul', completed: 11, prevCompleted: 8 },
  { weekKey: 'w3', weekLabel: 'Sem 3', dateRange: '14/Jul - 20/Jul', completed: 10, prevCompleted: 11 },
  { weekKey: 'w4', weekLabel: 'Sem 4', dateRange: '21/Jul - 27/Jul', completed: 13, prevCompleted: 10 },
  { weekKey: 'w5', weekLabel: 'Sem 5', dateRange: '28/Jul - 03/Ago', completed: 15, prevCompleted: 13 },
  { weekKey: 'w6', weekLabel: 'Sem 6', dateRange: '04/Ago - 10/Ago', completed: 12, prevCompleted: 15 },
  { weekKey: 'w7', weekLabel: 'Sem 7', dateRange: '11/Ago - 17/Ago', completed: 9, prevCompleted: 12 },
  { weekKey: 'w8', weekLabel: 'Sem 8', dateRange: '18/Ago - 24/Ago', completed: 14, prevCompleted: 9 },
  { weekKey: 'w9', weekLabel: 'Sem 9', dateRange: '25/Ago - 31/Ago', completed: 12, prevCompleted: 14 },
  { weekKey: 'w10', weekLabel: 'Sem 10', dateRange: '01/Set - 07/Set', completed: 18, prevCompleted: 12 },
  { weekKey: 'w11', weekLabel: 'Sem 11', dateRange: '08/Set - 14/Set', completed: 16, prevCompleted: 18 },
  { weekKey: 'w12', weekLabel: 'Sem 12', dateRange: '15/Set - 21/Set', completed: 23, prevCompleted: 16 },
];

const DEFAULT_COLLABORATOR_DATA: CollaboratorStat[] = [
  { id: '1', name: 'Carlos', fullName: 'Carlos Silva', completed: 21, percentage: 26, role: 'Gerente Operacional' },
  { id: '2', name: 'Mariana', fullName: 'Mariana Costa', completed: 18, percentage: 23, role: 'Supervisora' },
  { id: '3', name: 'Roberto', fullName: 'Roberto Lima', completed: 15, percentage: 19, role: 'Logística & Estoque' },
  { id: '4', name: 'Ana', fullName: 'Ana Paula Santos', completed: 14, percentage: 17, role: 'Marketing & Conteúdo' },
  { id: '5', name: 'Lucas', fullName: 'Lucas Oliveira', completed: 12, percentage: 15, role: 'Vendas & CRM' },
];

// Harmonious gradient colors for collaborator ranking
const COLLABORATOR_BAR_COLORS = [
  '#2563eb', // Top performer (Deep Royal Blue)
  '#3b82f6', // #2 (Bright Blue)
  '#60a5fa', // #3 (Sky Blue)
  '#6366f1', // #4 (Indigo)
  '#8b5cf6', // #5 (Violet)
  '#a855f7', // #6 (Purple)
];

export function TaskPerformanceSection({
  weeklyData,
  collaboratorData,
  isLoading = false
}: TaskPerformanceSectionProps) {
  const { isDarkMode } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [weeksFilter, setWeeksFilter] = useState<'6w' | '12w'>('6w');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use provided data or fallback to rich defaults
  const activeWeeklyData = useMemo(() => {
    if (Array.isArray(weeklyData) && weeklyData.length > 0) {
      if (weeksFilter === '6w') {
        return weeklyData.slice(-6);
      }
      return weeklyData.slice(-12);
    }
    return weeksFilter === '6w' ? DEFAULT_WEEKLY_DATA_6W : DEFAULT_WEEKLY_DATA_12W;
  }, [weeklyData, weeksFilter]);

  const activeCollaboratorData = useMemo(() => {
    if (Array.isArray(collaboratorData) && collaboratorData.length > 0) {
      return [...collaboratorData].sort((a, b) => b.completed - a.completed).slice(0, 6);
    }
    return DEFAULT_COLLABORATOR_DATA;
  }, [collaboratorData]);

  // Derived Performance Metrics
  const totalCompletedInPeriod = useMemo(() => {
    return (activeWeeklyData || []).reduce((acc, curr) => acc + (curr?.completed || 0), 0);
  }, [activeWeeklyData]);

  const weeklyAverage = useMemo(() => {
    if (!activeWeeklyData || activeWeeklyData.length === 0) return 0;
    return (totalCompletedInPeriod / activeWeeklyData.length).toFixed(1);
  }, [activeWeeklyData, totalCompletedInPeriod]);

  const peakWeek = useMemo(() => {
    if (!activeWeeklyData || activeWeeklyData.length === 0) return null;
    return activeWeeklyData.reduce((max, curr) => (curr?.completed || 0) > (max?.completed || 0) ? curr : max, activeWeeklyData[0]);
  }, [activeWeeklyData]);

  const recentGrowthRate = useMemo(() => {
    if (!activeWeeklyData || activeWeeklyData.length < 2) return 0;
    const last = activeWeeklyData[activeWeeklyData.length - 1]?.completed || 0;
    const prev = activeWeeklyData[activeWeeklyData.length - 2]?.completed || 0;
    if (prev === 0) return 100;
    return Math.round(((last - prev) / prev) * 100);
  }, [activeWeeklyData]);

  const totalCollaboratorTasks = useMemo(() => {
    return (activeCollaboratorData || []).reduce((acc, curr) => acc + (curr?.completed || 0), 0);
  }, [activeCollaboratorData]);

  const topCollaborator = useMemo(() => {
    return activeCollaboratorData[0] || null;
  }, [activeCollaboratorData]);

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <TrendingUp size={16} />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Desempenho & Produtividade de Tarefas
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 pl-9">
            Evolução semanal de entregas e comparativo individual por colaborador
          </p>
        </div>

        {/* Global Controls & Summary Chips */}
        <div className="flex items-center gap-2 self-start sm:self-auto pl-9 sm:pl-0">
          {/* Week Filter Selector */}
          <div className={`flex items-center p-0.5 rounded-lg border text-xs font-semibold ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/80'
          }`}>
            <button
              onClick={() => setWeeksFilter('6w')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                weeksFilter === '6w'
                  ? (isDarkMode ? 'bg-slate-800 text-blue-400 shadow-xs' : 'bg-white text-blue-600 shadow-xs')
                  : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900')
              }`}
            >
              6 Semanas
            </button>
            <button
              onClick={() => setWeeksFilter('12w')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                weeksFilter === '12w'
                  ? (isDarkMode ? 'bg-slate-800 text-blue-400 shadow-xs' : 'bg-white text-blue-600 shadow-xs')
                  : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900')
              }`}
            >
              12 Semanas
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Concluídas */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Concluídas no Período
            </span>
            <CheckCircle2 size={14} className="text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {totalCompletedInPeriod}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">tarefas</span>
          </div>
        </div>

        {/* Média Semanal */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Média Semanal
            </span>
            <Calendar size={14} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {weeklyAverage}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">/ semana</span>
          </div>
        </div>

        {/* Ritmo / Variação Recente */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Variação Recente
            </span>
            <Sparkles size={14} className="text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-xl font-bold tabular-nums flex items-center ${
              recentGrowthRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
            }`}>
              {recentGrowthRate >= 0 ? `+${recentGrowthRate}%` : `${recentGrowthRate}%`}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">vs semana ant.</span>
          </div>
        </div>

        {/* Colaborador Destaque */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Líder de Entregas
            </span>
            <Award size={14} className="text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1 truncate">
            <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 truncate">
              {topCollaborator?.name || 'Equipe'}
            </span>
            {topCollaborator && (
              <span className="text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                ({topCollaborator.completed} tarefas)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dual Charts Grid: Line Chart (Trend) & Bar Chart (Collaborators) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* 1. LINE CHART: Weekly Performance Trend */}
        <div className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tendência Semanal de Entregas
                </h3>
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
                  Linha do Tempo
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Volume de tarefas concluídas ao longo das semanas
              </p>
            </div>

            {peakWeek && (
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Pico Semanal
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {peakWeek.completed} tarefas ({peakWeek.weekLabel})
                </span>
              </div>
            )}
          </div>

          {/* Chart Canvas */}
          <div className="h-64 w-full relative">
            {!mounted ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 animate-pulse">
                Carregando gráfico de tendência...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={activeWeeklyData}
                  margin={{ top: 12, right: 12, left: -24, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="weeklyCompletedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={isDarkMode ? 0.35 : 0.22} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} 
                    vertical={false} 
                  />

                  <XAxis 
                    dataKey="weekLabel" 
                    stroke={isDarkMode ? '#64748b' : '#94a3b8'} 
                    fontSize={11} 
                    tickLine={false}
                    axisLine={false}
                    dy={6}
                  />

                  <YAxis 
                    stroke={isDarkMode ? '#64748b' : '#94a3b8'} 
                    fontSize={11} 
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    dx={-4}
                  />

                  <Tooltip 
                    content={<CustomLineTooltip isDarkMode={isDarkMode} />} 
                    cursor={{
                      stroke: isDarkMode ? '#334155' : '#cbd5e1',
                      strokeWidth: 1.5,
                      strokeDasharray: '4 4'
                    }}
                  />

                  {/* Benchmark / Average dashed reference line */}
                  {Number(weeklyAverage) > 0 && (
                    <ReferenceLine 
                      y={Number(weeklyAverage)} 
                      stroke={isDarkMode ? '#334155' : '#e2e8f0'} 
                      strokeDasharray="3 3"
                    />
                  )}

                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#2563eb"
                    strokeWidth={2.75}
                    fillOpacity={1}
                    fill="url(#weeklyCompletedGradient)"
                    dot={{ 
                      r: 4, 
                      fill: '#2563eb', 
                      stroke: isDarkMode ? '#0f172a' : '#ffffff', 
                      strokeWidth: 2 
                    }}
                    activeDot={{ 
                      r: 6, 
                      fill: '#2563eb', 
                      stroke: '#93c5fd', 
                      strokeWidth: 2.5 
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart Footer Legend / Info */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-blue-600 rounded-full" />
                <span>Tarefas Concluídas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 border-t border-dashed border-slate-400" />
                <span>Média do Período ({weeklyAverage})</span>
              </div>
            </div>
            <span className="tabular-nums font-medium text-slate-400">
              {activeWeeklyData.length} semanas avaliadas
            </span>
          </div>
        </div>

        {/* 2. BAR CHART: Collaborator Comparison */}
        <div className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tarefas Concluídas por Colaborador
                </h3>
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/40">
                  Ranking
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Comparativo de entregas individuais no período
              </p>
            </div>

            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Média / Colaborador
              </span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {activeCollaboratorData.length > 0 
                  ? (totalCollaboratorTasks / activeCollaboratorData.length).toFixed(1) 
                  : 0} tarefas
              </span>
            </div>
          </div>

          {/* Chart Canvas */}
          <div className="h-64 w-full relative">
            {!mounted ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 animate-pulse">
                Carregando ranking de colaboradores...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeCollaboratorData}
                  margin={{ top: 12, right: 12, left: -24, bottom: 0 }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} 
                    vertical={false} 
                  />

                  <XAxis 
                    dataKey="name" 
                    stroke={isDarkMode ? '#64748b' : '#94a3b8'} 
                    fontSize={11} 
                    tickLine={false}
                    axisLine={false}
                    dy={6}
                  />

                  <YAxis 
                    stroke={isDarkMode ? '#64748b' : '#94a3b8'} 
                    fontSize={11} 
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    dx={-4}
                  />

                  <Tooltip 
                    content={<CustomBarTooltip isDarkMode={isDarkMode} totalTeamTasks={totalCollaboratorTasks} />} 
                    cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                  />

                  <Bar 
                    dataKey="completed" 
                    name="Concluídas" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  >
                    {activeCollaboratorData.map((_, index) => (
                      <Cell 
                        key={`collab-cell-${index}`} 
                        fill={COLLABORATOR_BAR_COLORS[index % COLLABORATOR_BAR_COLORS.length]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart Footer Top Performer Badge */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <span className="truncate">
                Destaque: <strong className="text-slate-700 dark:text-slate-300">{topCollaborator?.fullName || topCollaborator?.name}</strong>
              </span>
            </div>
            <span className="tabular-nums font-semibold text-blue-600 dark:text-blue-400 shrink-0">
              {topCollaborator?.completed} entregas ({totalCollaboratorTasks > 0 ? Math.round(((topCollaborator?.completed || 0) / totalCollaboratorTasks) * 100) : 0}%)
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
