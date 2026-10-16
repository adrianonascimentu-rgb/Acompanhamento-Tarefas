'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  ArrowRight,
  ListTodo,
  Layers,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/hooks/useTheme';

export interface TaskVolumeChartProps {
  completedCount: number;
  pendingCount: number;
  delayedCount: number;
  totalCount: number;
  historicalData?: {
    period: string;
    completed: number;
    pending: number;
    delayed: number;
  }[];
  title?: string;
  subtitle?: string;
}

export function TaskVolumeChart({
  completedCount = 0,
  pendingCount = 0,
  delayedCount = 0,
  totalCount = 0,
  historicalData = [],
  title = 'Volume de Tarefas: Concluídas vs Pendentes',
  subtitle = 'Análise comparativa de execução e pendências',
}: TaskVolumeChartProps) {
  const { isDarkMode } = useTheme();
  const [viewMode, setViewMode] = useState<'bar' | 'pie'>('bar');

  const calculatedTotal = totalCount || (completedCount + pendingCount + delayedCount);
  const completionPercentage = calculatedTotal > 0 ? Math.round((completedCount / calculatedTotal) * 100) : 0;
  const pendingPercentage = calculatedTotal > 0 ? Math.round((pendingCount / calculatedTotal) * 100) : 0;
  const delayedPercentage = calculatedTotal > 0 ? Math.round((delayedCount / calculatedTotal) * 100) : 0;

  // Pie chart data
  const pieData = [
    { name: 'Concluídas', value: completedCount, color: '#10b981', percent: completionPercentage },
    { name: 'Pendentes', value: pendingCount, color: '#f59e0b', percent: pendingPercentage },
    { name: 'Atrasadas', value: delayedCount, color: '#f43f5e', percent: delayedPercentage },
  ].filter(item => item.value > 0);

  const displayPieData = pieData.length > 0 ? pieData : [
    { name: 'Sem Tarefas', value: 1, color: isDarkMode ? '#334155' : '#cbd5e1', percent: 0 }
  ];

  const chartHistoricalData = historicalData.length > 0 ? historicalData : [
    { period: 'Volume Atual', completed: completedCount, pending: pendingCount, delayed: delayedCount }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-slate-100 p-3.5 rounded-xl shadow-2xl text-xs space-y-2 min-w-[200px]">
          {label && (
            <p className="font-bold text-slate-200 border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <span>{label}</span>
              <span className="text-[10px] text-slate-400">Detalhamento</span>
            </p>
          )}
          {payload.map((entry: any, index: number) => {
            const count = entry.value;
            const pct = calculatedTotal > 0 ? Math.round((count / calculatedTotal) * 100) : 0;
            return (
              <div key={`tooltip-${index}`} className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-2 font-medium" style={{ color: entry.color || entry.fill }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                  {entry.name}:
                </span>
                <div className="flex items-center gap-1.5 font-bold tabular-nums">
                  <span>{count}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`p-4 sm:p-6 rounded-2xl border transition-all space-y-5 ${
      isDarkMode 
        ? 'bg-slate-900/90 border-slate-800 shadow-md shadow-slate-950/40' 
        : 'bg-white border-slate-200/80 shadow-xs hover:shadow-sm'
    }`}>
      {/* Top Header & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
            <Layers size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {title}
              </h3>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] font-bold rounded-md border border-blue-200/60 dark:border-blue-800/60">
                {completionPercentage}% Concluído
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl text-xs font-semibold shrink-0 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setViewMode('bar')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'bar'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Barras</span>
            </button>
            <button
              onClick={() => setViewMode('pie')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'pie'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Rosca</span>
            </button>
          </div>

          <Link
            href="/tasks"
            className="hidden md:flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition-colors"
          >
            <span>Ver Tarefas</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Metric Cards Row (4 Responsive Pillars) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total */}
        <Link
          href="/tasks?filter=Todas"
          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between group cursor-pointer ${
            isDarkMode 
              ? 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600' 
              : 'bg-slate-50/80 border-slate-200/70 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Geral
            </span>
            <ListTodo size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {calculatedTotal}
            </span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
              100%
            </span>
          </div>
        </Link>

        {/* Concluídas */}
        <Link
          href="/tasks?filter=Concluída"
          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between group cursor-pointer ${
            isDarkMode 
              ? 'bg-emerald-950/20 border-emerald-900/40 hover:border-emerald-700/60' 
              : 'bg-emerald-50/60 border-emerald-200/70 hover:border-emerald-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Concluídas
            </span>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
              {completionPercentage}%
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {completedCount}
            </span>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-semibold">
              Finalizadas
            </span>
          </div>
        </Link>

        {/* Pendentes */}
        <Link
          href="/tasks?filter=Pendente"
          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between group cursor-pointer ${
            isDarkMode 
              ? 'bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60' 
              : 'bg-amber-50/60 border-amber-200/70 hover:border-amber-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" />
              Pendentes
            </span>
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">
              {pendingPercentage}%
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {pendingCount}
            </span>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-semibold">
              Em Fila
            </span>
          </div>
        </Link>

        {/* Atrasadas */}
        <Link
          href="/tasks?filter=Atrasadas"
          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between group cursor-pointer ${
            isDarkMode 
              ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60' 
              : 'bg-rose-50/60 border-rose-200/70 hover:border-rose-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle size={14} className="text-rose-500" />
              Atrasadas
            </span>
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-900/60 px-1.5 py-0.5 rounded">
              {delayedPercentage}%
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {delayedCount}
            </span>
            <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 font-semibold">
              Requer Atenção
            </span>
          </div>
        </Link>
      </div>

      {/* Visual Multi-Segmented Ratio Bar */}
      {calculatedTotal > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Distribuição Proporcional</span>
            <span className="tabular-nums">
              {completedCount} concluídas de {calculatedTotal}
            </span>
          </div>
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-slate-200/60 dark:border-slate-700/60">
            {completedCount > 0 && (
              <div 
                style={{ width: `${(completedCount / calculatedTotal) * 100}%` }}
                className="h-full bg-emerald-500 rounded-sm transition-all" 
                title={`Concluídas: ${completedCount} (${completionPercentage}%)`}
              />
            )}
            {pendingCount > 0 && (
              <div 
                style={{ width: `${(pendingCount / calculatedTotal) * 100}%` }}
                className="h-full bg-amber-500 rounded-sm transition-all" 
                title={`Pendentes: ${pendingCount} (${pendingPercentage}%)`}
              />
            )}
            {delayedCount > 0 && (
              <div 
                style={{ width: `${(delayedCount / calculatedTotal) * 100}%` }}
                className="h-full bg-rose-500 rounded-sm transition-all" 
                title={`Atrasadas: ${delayedCount} (${delayedPercentage}%)`}
              />
            )}
          </div>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'bar' ? (
            <BarChart
              data={chartHistoricalData}
              margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDarkMode ? '#1e293b' : '#f1f5f9'}
                vertical={false}
              />
              <XAxis
                dataKey="period"
                stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                fontSize={12}
                fontWeight={600}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '14px' }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    completed: 'Concluídas',
                    pending: 'Pendentes / Em Andamento',
                    delayed: 'Atrasadas',
                  };
                  return (
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {labels[value] || value}
                    </span>
                  );
                }}
              />
              <Bar
                dataKey="completed"
                name="completed"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="pending"
                name="pending"
                fill="#f59e0b"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="delayed"
                name="delayed"
                fill="#f43f5e"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={displayPieData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
              >
                {displayPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke={isDarkMode ? '#0f172a' : '#ffffff'} strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '14px' }}
                formatter={(value) => (
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer Efficiency Bar & Call to Action */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-blue-500 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Eficiência Operacional:
          </span>
          <span className={`font-black px-2.5 py-0.5 rounded-lg border tabular-nums ${
            completionPercentage >= 70
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : completionPercentage >= 40
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}>
            {completionPercentage}% de Conclusão
          </span>
        </div>

        <Link
          href="/tasks"
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 group"
        >
          <span>Acessar Quadro de Tarefas</span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
