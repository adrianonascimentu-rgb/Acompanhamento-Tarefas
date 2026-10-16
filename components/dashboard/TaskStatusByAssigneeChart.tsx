'use client';

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useTheme } from '@/hooks/useTheme';

export const TaskStatusByAssigneeChart = ({ data = [] }: { data?: any[] }) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <h3 className="text-sm font-bold mb-4">Tarefas por Status (Responsável)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={Array.isArray(data) ? data : []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
            <XAxis dataKey="name" fontSize={10} tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
            <YAxis fontSize={10} tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderColor: isDarkMode ? '#334155' : '#e2e8f0', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Bar dataKey="completed" name="Concluídas" stackId="a" fill="#10b981" />
            <Bar dataKey="inProgress" name="Em Andamento" stackId="a" fill="#3b82f6" />
            <Bar dataKey="delayed" name="Atrasadas" stackId="a" fill="#f43f5e" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
