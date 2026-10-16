'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Truck, 
  Calendar, 
  User, 
  Users, 
  FileText, 
  ArrowLeft, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Edit3, 
  Clock, 
  Sparkles, 
  CheckCircle2,
  Package,
  MessageSquareWarning,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { 
  TruckScheduleData, 
  fetchTruckSchedule, 
  updateTruckSchedule, 
  DEFAULT_TRUCK_SCHEDULE,
  TruckArrivalRecord 
} from '@/lib/truckSchedule';
import { TruckScheduleModal } from '@/components/TruckScheduleModal';
import { LoginForm } from '@/components/auth/LoginForm';
import { useUI } from '@/hooks/useUI';

export default function TruckHistoryReportPage() {
  const { role, isAdmin, user, isAuthenticated, login } = useRole();
  const { isDarkMode } = useTheme();
  const { showToast } = useUI();

  // Apenas Administrador, Gerente ou Supervisor podem alterar
  const canEdit = isAdmin || role === 'gerente' || role === 'supervisor';

  const [scheduleData, setScheduleData] = useState<TruckScheduleData>(DEFAULT_TRUCK_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTruckSchedule();
      setScheduleData(data);
    } catch (e) {
      console.warn('Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const handleSaveData = async (newData: any) => {
    const res = await updateTruckSchedule({
      ...newData,
      updated_by_name: user?.name || (isAdmin ? 'Administrador' : role)
    });
    if (res.success) {
      setScheduleData(res.data);
    }
  };

  const filteredHistory = useMemo(() => {
    const list = scheduleData.history || [];
    if (!searchTerm.trim()) return list;

    const term = searchTerm.toLowerCase();
    return list.filter((r) => 
      r.driver_name?.toLowerCase().includes(term) ||
      r.assistant_name?.toLowerCase().includes(term) ||
      r.notes?.toLowerCase().includes(term) ||
      r.comments?.toLowerCase().includes(term) ||
      r.arrival_date?.includes(term)
    );
  }, [scheduleData.history, searchTerm]);

  // Exportar histórico para CSV
  const handleExportCSV = () => {
    if (!scheduleData.history || scheduleData.history.length === 0) {
      showToast('Nenhum registro para exportar.', 'warning');
      return;
    }

    const headers = ['Data de Chegada', 'Motorista', 'Ajudante', 'Comentários e Ocorrências', 'Observações', 'Registrado Em', 'Registrado Por'];
    const rows = scheduleData.history.map(r => [
      r.arrival_date,
      `"${(r.driver_name || '').replace(/"/g, '""')}"`,
      `"${(r.assistant_name || '').replace(/"/g, '""')}"`,
      `"${(r.comments || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      r.created_at || '',
      `"${(r.created_by || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_caminhao_reposicao_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Relatório CSV exportado com sucesso!', 'success');
  };

  if (!isAuthenticated && !user) {
    return <LoginForm onLogin={login} />;
  }

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-20 flex items-center justify-between px-4 py-4 md:px-8 border-b backdrop-blur-md ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <Link 
            href="/reports" 
            className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            title="Voltar aos Relatórios"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                <Truck size={18} />
              </div>
              <h1 className="text-base md:text-xl font-black tracking-tight">Relatório de Reposição & Caminhões</h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Histórico cronológico de recebimentos de mercadoria, motoristas, avarias e divergências de carga
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          {canEdit && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition-all"
            >
              <Plus size={15} />
              <span>Registrar Chegada / Alterar</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Próximo Carro</p>
                <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                  {scheduleData.next_arrival_date 
                    ? new Date(scheduleData.next_arrival_date + 'T00:00:00').toLocaleDateString('pt-BR') 
                    : 'A definir'}
                </p>
              </div>
            </div>
          </div>

          <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Último Carro</p>
                <p className="text-lg font-black">
                  {scheduleData.last_arrival_date 
                    ? new Date(scheduleData.last_arrival_date + 'T00:00:00').toLocaleDateString('pt-BR') 
                    : 'Não registrado'}
                </p>
              </div>
            </div>
          </div>

          <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Recebimentos</p>
                <p className="text-xl font-black">{scheduleData.history?.length || 0}</p>
              </div>
            </div>
          </div>

          <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30">
                <User size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Último Motorista</p>
                <p className="text-sm font-black truncate max-w-[140px]">
                  {scheduleData.history?.[0]?.driver_name || 'Nenhum'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Histórico e Filtro de Busca */}
        <div className={`rounded-3xl border overflow-hidden ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
        }`}>
          {/* Barra de Filtro */}
          <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar por motorista, avaria, mercadoria, data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full h-11 pl-10 pr-4 rounded-2xl border text-xs font-medium outline-none focus:ring-2 focus:ring-blue-600 transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>

            <span className="text-xs font-bold text-slate-400 self-start sm:self-center">
              Mostrando {filteredHistory.length} de {scheduleData.history?.length || 0} viagens registradas
            </span>
          </div>

          {/* Listagem em Tabela Responsiva */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-400">Carregando histórico...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-20 text-center px-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Truck size={30} />
              </div>
              <h4 className="text-base font-bold mb-1">Nenhum registro encontrado</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                {searchTerm ? 'Nenhum resultado corresponde aos termos da busca.' : 'Registre as chegadas dos caminhões de reposição para compilar este relatório.'}
              </p>
              {canEdit && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20"
                >
                  Registrar Chegada de Caminhão
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'border-slate-800 text-slate-400 bg-slate-950/40' : 'border-slate-100 text-slate-500 bg-slate-50/70'
                  }`}>
                    <th className="py-3.5 px-6">Data de Chegada</th>
                    <th className="py-3.5 px-6">Motorista</th>
                    <th className="py-3.5 px-6">Ajudante</th>
                    <th className="py-3.5 px-6 min-w-[260px]">Comentários & Ocorrências (Avarias / Faltas / NF)</th>
                    <th className="py-3.5 px-6">Observações Gerais</th>
                    <th className="py-3.5 px-6">Registrado Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium">
                  {filteredHistory.map((rec, idx) => {
                    const recDate = new Date(rec.arrival_date + 'T00:00:00');
                    const formattedDate = !isNaN(recDate.getTime())
                      ? recDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                      : rec.arrival_date;

                    return (
                      <tr key={rec.id || idx} className={`transition-colors ${
                        isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/80'
                      }`}>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <strong className="font-black text-sm capitalize">{formattedDate}</strong>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 font-bold">
                            <User size={14} className="text-slate-400 shrink-0" />
                            <span>{rec.driver_name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <Users size={14} className="text-slate-400 shrink-0" />
                            <span>{rec.assistant_name || <span className="text-slate-400 italic">Sem ajudante</span>}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 max-w-sm">
                          {rec.comments ? (
                            <div className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200">
                              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                                <MessageSquareWarning size={12} /> Ocorrências registradas:
                              </span>
                              <p className="text-xs leading-relaxed whitespace-pre-wrap">
                                {rec.comments}
                              </p>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-900/40">
                              <CheckCircle2 size={11} /> Carga 100% conforme
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 max-w-xs">
                          {rec.notes ? (
                            <p className="truncate text-slate-600 dark:text-slate-400" title={rec.notes}>
                              {rec.notes}
                            </p>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap text-slate-400 text-[11px]">
                          {rec.created_by || 'Sistema'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Gestão de Datas e Registro */}
      {canEdit && (
        <TruckScheduleModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          data={scheduleData}
          onSave={handleSaveData}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
