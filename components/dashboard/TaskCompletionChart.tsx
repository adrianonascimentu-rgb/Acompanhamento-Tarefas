'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@/hooks/useTheme';

interface TaskCompletionChartProps {
  data: { name: string; completed: number }[];
  title?: string;
  subtitle?: string;
}

export function TaskCompletionChart({ 
  data = [], 
  title = "Tarefas Concluídas", 
  subtitle = "Histórico mensal de entregas finalizadas" 
}: TaskCompletionChartProps) {
  const { isDarkMode } = useTheme();

  return (
    <div className="p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={Array.isArray(data) ? data : []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke={isDarkMode ? '#64748b' : '#94a3b8'} 
              fontSize={11} 
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
            <Tooltip 
              cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
              contentStyle={{ 
                backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '12px',
                color: isDarkMode ? '#f8fafc' : '#0f172a'
              }}
            />
            <Bar 
              dataKey="completed" 
              fill="#2563eb" 
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
