'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { ArrowLeft, BarChart3, Users } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/hooks/useTheme';

const MOCK_LEADS = [
  { id: 1, name: 'João Silva', company: 'Tech Solutions', status: 'Novo', segment: 'Restaurante', created_at: new Date().toISOString() },
  { id: 2, name: 'Maria Oliveira', company: 'Global Corp', status: 'Em Contato', segment: 'Padaria', created_at: new Date().toISOString() },
  { id: 3, name: 'Pedro Santos', company: 'Inovação Ltda', status: 'Qualificado', segment: 'Açougue', created_at: new Date().toISOString() },
  { id: 4, name: 'Ana Costa', company: 'Doce Vida', status: 'Novo', segment: 'Doceria', created_at: new Date().toISOString() },
];

export default function LeadsDashboard() {
  const { isDarkMode } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [segmentData, setSegmentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: leads, error } = await supabase
        .from('leads')
        .select('*, assigned_profile:profiles(name)');
      
      const allLeads = (leads && leads.length > 0) ? leads : MOCK_LEADS;

      // 1. Process data for evolution: leads per vendedor per month
      const processedData: Record<string, Record<string, number>> = {};
      const segmentCounts: Record<string, number> = {};

      allLeads.forEach((lead: any) => {
        const vendedor = lead.assigned_profile?.name || 'Não Atribuído';
        const month = new Date(lead.created_at).toLocaleString('pt-BR', { month: 'short' });
        
        if (!processedData[month]) processedData[month] = {};
        if (!processedData[month][vendedor]) processedData[month][vendedor] = 0;
        processedData[month][vendedor]++;

        const seg = (lead.segment || 'Geral').trim();
        segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
      });

      const chartData = Object.entries(processedData).map(([month, vendedores]) => ({
        month,
        ...vendedores
      }));

      const segData = Object.entries(segmentCounts)
        .map(([segment, total]) => ({ segment, total }))
        .sort((a, b) => b.total - a.total);

      setData(chartData);
      setSegmentData(segData);
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className={`min-h-screen p-4 md:p-6 space-y-6 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className="flex items-center gap-4">
        <Link href="/leads" className={`p-2.5 rounded-full border transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-100'}`}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Painel Analítico de Leads</h1>
          <p className="text-xs text-slate-500">Métricas de nichos promissores e desempenho de vendedores</p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center items-center h-64 text-slate-400">Carregando métricas...</div>
      ) : (
        <div className="space-y-6">
          {/* Segment Bar Chart */}
          <div className={`p-6 rounded-2xl border space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20">
                <BarChart3 size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold">Leads por Segmento (Nichos Promissores)</h2>
                <p className="text-xs text-slate-500">Volume acumulado de oportunidades identificadas por mercado</p>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                  <XAxis
                    dataKey="segment"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`${value} Leads`, 'Total']}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {segmentData.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'][i % 6]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Evolution Chart */}
          <div className={`p-6 rounded-2xl border space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold">Evolução Mensal por Vendedor</h2>
                <p className="text-xs text-slate-500">Distribuição mensal de atribuição de leads para a equipe</p>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  {Object.keys(data[0] || {}).filter(k => k !== 'month').map((vendedor, i) => (
                    <Bar key={vendedor} dataKey={vendedor} stackId="a" fill={['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
