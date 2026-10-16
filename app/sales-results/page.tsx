'use client';

// Force chunk regeneration
import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  Legend
} from 'recharts';
import { 
  BarChart3, ArrowLeft, Search, User, Download, Share2, 
  MoreVertical, Shield, Users, Target, TrendingUp, Calendar, Filter, Activity, Settings, Plus, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { LoginForm } from '@/components/auth/LoginForm';
import { GsapSalesProgressBar } from '@/components/dashboard/GsapSalesProgressBar';
import { exportSalesDashboardToPDF } from '@/lib/exportPdf';
import Link from 'next/link';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function SalesResultsPage() {
  const { isDarkMode } = useTheme();
  const { role, user, isAdmin, canAccessSales, isAuthenticated, login } = useRole();
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchSalesData = useCallback(async () => {
    try {
      setLoading(true);
      
      const currentRole = role?.toLowerCase();
      const isManagerial = isAdmin || currentRole === 'gerente' || currentRole === 'supervisor';

      // Fetch all collaborators who should be in the sales list
      let query = supabase
        .from('profiles')
        .select('id, name, type, can_access_sales');
      
      if (!isManagerial && user?.id) {
        query = query.eq('id', user.id);
      } else {
        query = query.or('type.eq.vendedor,can_access_sales.eq.true');
      }

      const { data: profiles, error: profilesError } = await query.order('name');

      if (profilesError) throw profilesError;

      // Fetch existing sales entries for the selected period
      let salesQuery = supabase
        .from('sales_results')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear);

      if (!isManagerial && user?.id) {
        salesQuery = salesQuery.eq('collaborator_id', user.id);
      }

      const { data: sales, error: salesError } = await salesQuery;

      if (profiles) {
        const formattedData = profiles.map(profile => {
          const entry = sales?.find(s => s.collaborator_id === profile.id);
          return {
            id: profile.id,
            name: profile.name,
            res2025: entry?.result_2025 || 0,
            sugMeta: entry?.target_suggestion || 0,
            meta2026: entry?.target_2026 || 0,
            res2026: entry?.result_2026 || 0,
            ...entry
          };
        });
        setSalesData(formattedData);
      }
    } catch (error: any) {
      console.error('Error fetching sales data:', error?.message || error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (isAuthenticated && canAccessSales) {
      fetchSalesData();
    }
  }, [isAuthenticated, canAccessSales, fetchSalesData]);

  if (!isAuthenticated) return <LoginForm onLogin={login} />;
  if (!canAccessSales) return <div className="p-4">Acesso negado. Você não tem permissão para visualizar este módulo.</div>;

  const totals = salesData.reduce((acc, curr) => ({
    res2025: acc.res2025 + curr.res2025,
    meta2026: acc.meta2026 + curr.meta2026,
    res2026: acc.res2026 + curr.res2026,
  }), { res2025: 0, meta2026: 0, res2026: 0 });

  const diff = totals.res2026 - totals.meta2026;
  const percent = totals.meta2026 > 0 ? (diff / totals.meta2026) * 100 : 0;

  const renderChartContainer = (title: string, children: React.ReactNode) => (
    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        {title}
      </h3>
      <div className="h-64 w-full">
        {children}
      </div>
    </div>
  );

  const handleExportPDF = () => {
    exportSalesDashboardToPDF({
      title: `Relatório de Resultados de Vendas - ${new Date(2000, selectedMonth - 1).toLocaleString('pt-BR', { month: 'long' })} / ${selectedYear}`,
      period: `${new Date(2000, selectedMonth - 1).toLocaleString('pt-BR', { month: 'long' })} ${selectedYear}`,
      totalRevenue: totals.res2026,
      totalSales: salesData.length,
      avgTicket: salesData.length > 0 ? totals.res2026 / salesData.length : 0,
      salesResults: salesData.map(d => ({
        name: d.name,
        res2025: d.res2025,
        meta2026: d.meta2026,
        res2026: d.res2026,
      }))
    });
  };

  return (
    <div id="sales-dashboard" className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`flex items-center justify-between p-4 border-b sticky top-0 z-10 ${isDarkMode ? 'border-slate-800 bg-slate-900/80 backdrop-blur-md' : 'border-slate-100 bg-white/80 backdrop-blur-md'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <TrendingUp size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Resultados de Vendas</h1>
        </div>

        <div className="actions-bar flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Exportar dados do dashboard para PDF"
          >
            <Download size={16} className="text-blue-400" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>

          {isAdmin && (
            <Link href="/sales-results/admin" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Settings size={20} />
            </Link>
          )}
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto pb-32 p-4 space-y-6">
        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex-1 flex gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="flex-1 bg-transparent border-none text-xs font-bold uppercase tracking-wider p-2 outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="flex-1 bg-transparent border-none text-xs font-bold uppercase tracking-wider p-2 outline-none"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Activity className="animate-spin mb-4" size={32} />
            <p className="text-sm font-medium">Carregando resultados...</p>
          </div>
        ) : salesData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <TrendingUp size={48} className="mb-4 opacity-20" />
            <p className="font-medium">Nenhum dado para este período</p>
            {isAdmin && (
              <Link href="/sales-results/admin" className="mt-4 text-emerald-600 font-bold text-sm">
                Alimentar Dados
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Resultado {selectedYear}</p>
                <p className="text-2xl font-black text-blue-600">R$ {totals.res2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Meta {selectedYear}</p>
                <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>R$ {totals.meta2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Diferença</p>
                <p className={`text-2xl font-black ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  R$ {Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Performance</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-black ${percent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {percent >= 0 ? '+' : ''}{percent.toFixed(2)}%
                  </p>
                  <TrendingUp size={20} className={percent >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
                </div>
              </div>
            </div>

            {/* GSAP Sales Target Progress Bar Card */}
            <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <GsapSalesProgressBar
                currentRevenue={totals.res2026}
                targetGoal={totals.meta2026}
                label={`Progresso Geral de Meta vs. Faturamento Realizado (${selectedYear})`}
                subtitle="Indicador em tempo real alimentado com animação fluida GSAP"
                isDarkMode={isDarkMode}
                showDetails={true}
                barHeight="h-4"
                colorScheme={totals.res2026 >= totals.meta2026 ? 'emerald' : 'blue'}
              />
            </div>

            {/* Main Chart */}
            {renderChartContainer(`Comparativo de Resultados - ${new Date(2000, selectedMonth - 1).toLocaleString('pt-BR', { month: 'long' })}`, (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: any) => {
                      const numValue = typeof value === 'number' ? value : 0;
                      return `R$ ${numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                  <Bar name="Resultado 2025" dataKey="res2025" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar name="Meta 2026" dataKey="meta2026" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar name="Resultado 2026" dataKey="res2026" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ))}

            {/* Detailed Table */}
            <div className={`overflow-hidden rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Detalhamento por Colaborador
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Colaborador</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Res. 2025</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Meta {selectedYear}</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Res. {selectedYear}</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Atingimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((item, idx) => {
                      const atingimento = item.meta2026 > 0 ? (item.res2026 / item.meta2026) * 100 : 0;
                      return (
                        <tr key={idx} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                          <td className="p-4 text-sm font-bold">{item.name}</td>
                          <td className="p-4 text-sm text-right text-slate-500">R$ {item.res2025.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-4 text-sm text-right font-medium">R$ {item.meta2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-4 text-sm text-right font-bold text-blue-600">R$ {item.res2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-4 text-right min-w-[160px]">
                            <GsapSalesProgressBar
                              currentRevenue={item.res2026 || 0}
                              targetGoal={item.meta2026 || 0}
                              isDarkMode={isDarkMode}
                              showDetails={false}
                              barHeight="h-2.5"
                              colorScheme={atingimento >= 100 ? 'emerald' : 'blue'}
                              delay={0.1 + idx * 0.05}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
