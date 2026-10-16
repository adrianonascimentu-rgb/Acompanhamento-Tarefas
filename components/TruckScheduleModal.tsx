'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Truck, 
  Calendar, 
  User, 
  Users, 
  FileText, 
  Check, 
  Plus, 
  Trash2, 
  Clock, 
  AlertCircle,
  ArrowRight,
  MessageSquareWarning,
  AlertTriangle,
  Edit2,
  Save
} from 'lucide-react';
import { TruckScheduleData, TruckArrivalRecord } from '@/lib/truckSchedule';
import { useUI } from '@/hooks/useUI';

interface TruckScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TruckScheduleData;
  onSave: (newData: {
    next_arrival_date?: string | null;
    last_arrival_date?: string | null;
    newRecord?: {
      arrival_date: string;
      driver_name: string;
      assistant_name?: string;
      notes?: string;
      comments?: string;
    };
    updateRecord?: {
      id: string;
      comments?: string;
      notes?: string;
      driver_name?: string;
      assistant_name?: string;
    };
    deletedRecordId?: string;
  }) => Promise<void>;
  isDarkMode?: boolean;
}

export function TruckScheduleModal({
  isOpen,
  onClose,
  data,
  onSave,
  isDarkMode = false
}: TruckScheduleModalProps) {
  const { showToast } = useUI();
  const [activeTab, setActiveTab] = useState<'dates' | 'new_arrival' | 'history'>('dates');
  
  // States for next and last dates
  const [nextDate, setNextDate] = useState<string>(data.next_arrival_date ? data.next_arrival_date.split('T')[0] : '');
  const [lastDate, setLastDate] = useState<string>(data.last_arrival_date ? data.last_arrival_date.split('T')[0] : '');
  
  // State for registering a completed truck arrival
  const [arrivalDate, setArrivalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [driverName, setDriverName] = useState<string>('');
  const [assistantName, setAssistantName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [comments, setComments] = useState<string>('');

  // Editing comments in history
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingComments, setEditingComments] = useState<string>('');

  const [saving, setSaving] = useState(false);

  // Sync state on open
  React.useEffect(() => {
    if (isOpen) {
      setNextDate(data.next_arrival_date ? data.next_arrival_date.split('T')[0] : '');
      setLastDate(data.last_arrival_date ? data.last_arrival_date.split('T')[0] : '');
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const handleSaveDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        next_arrival_date: nextDate || null,
        last_arrival_date: lastDate || null
      });
      showToast('Datas de reposição atualizadas com sucesso!', 'success');
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar datas.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arrivalDate) {
      showToast('Selecione a data em que o caminhão chegou.', 'warning');
      return;
    }
    if (!driverName.trim()) {
      showToast('Informe o nome do motorista.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        last_arrival_date: arrivalDate,
        newRecord: {
          arrival_date: arrivalDate,
          driver_name: driverName.trim(),
          assistant_name: assistantName.trim() || undefined,
          notes: notes.trim() || undefined,
          comments: comments.trim() || undefined
        }
      });

      showToast('Chegada do caminhão registrada no histórico com sucesso!', 'success');
      setDriverName('');
      setAssistantName('');
      setNotes('');
      setComments('');
      setActiveTab('history');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao registrar chegada.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEditComments = async (recordId: string) => {
    setSaving(true);
    try {
      await onSave({
        updateRecord: {
          id: recordId,
          comments: editingComments.trim()
        }
      });
      setEditingRecordId(null);
      showToast('Comentários e ocorrências atualizados!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar comentários.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHistory = async (id: string, recordDate: string) => {
    if (confirm(`Deseja remover o registro de chegada de ${new Date(recordDate + 'T00:00:00').toLocaleDateString('pt-BR')}?`)) {
      setSaving(true);
      try {
        await onSave({ deletedRecordId: id });
        showToast('Registro removido.', 'info');
      } catch (err: any) {
        showToast('Erro ao remover registro.', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className={`w-full max-w-xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-800 text-slate-100' 
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Truck size={20} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">Gestão de Caminhão de Reposição</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Controle de datas, motoristas, avarias e divergências de carga</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200/80 dark:border-slate-800 px-5 pt-3 gap-2 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              onClick={() => setActiveTab('dates')}
              className={`pb-3 px-3 text-xs font-bold transition-all relative ${
                activeTab === 'dates'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Definir Datas
              {activeTab === 'dates' && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('new_arrival')}
              className={`pb-3 px-3 text-xs font-bold transition-all relative ${
                activeTab === 'new_arrival'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Registrar Chegada
              {activeTab === 'new_arrival' && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Histórico
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 font-black">
                {data.history?.length || 0}
              </span>
              {activeTab === 'history' && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] custom-scrollbar">
            {/* TAB 1: DEFINIR DATAS */}
            {activeTab === 'dates' && (
              <form onSubmit={handleSaveDates} className="space-y-5">
                <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 flex items-start gap-3">
                  <AlertCircle size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                    Essas datas ficam visíveis em <strong>destaque no topo do aplicativo</strong> para todos os colaboradores acompanharem a chegada da reposição.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                      📅 Data Prevista do Próximo Carro
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                        className={`w-full h-12 pl-4 pr-10 rounded-2xl border text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-600 transition-all ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white' 
                            : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      />
                      <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Exibido em destaque no topo do balão</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                      🚚 Data do Último Carro que Chegou
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={lastDate}
                        onChange={(e) => setLastDate(e.target.value)}
                        className={`w-full h-12 pl-4 pr-10 rounded-2xl border text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-600 transition-all ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white' 
                            : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      />
                      <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Exibido logo abaixo em texto complementar</p>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50"
                  >
                    <Check size={16} />
                    {saving ? 'Salvando...' : 'Salvar Datas'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 h-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: REGISTRAR CHEGADA (COM MOTORISTA, AJUDANTE E CAMPO DE COMENTÁRIOS / OCORRÊNCIAS) */}
            {activeTab === 'new_arrival' && (
              <form onSubmit={handleRegisterArrival} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Data da Chegada *
                  </label>
                  <input
                    required
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className={`w-full h-12 px-4 rounded-2xl border text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-600 ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Nome do Motorista *
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      placeholder="Ex: Carlos Silva"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className={`w-full h-12 pl-10 pr-4 rounded-2xl border text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-600 ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Nome do Ajudante (Opcional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: Marcos Santos, Roberto"
                      value={assistantName}
                      onChange={(e) => setAssistantName(e.target.value)}
                      className={`w-full h-12 pl-10 pr-4 rounded-2xl border text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-600 ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                </div>

                {/* CAMPO DEDICADO PARA COMENTÁRIOS E DIVERGÊNCIAS (AVARIAS, DIVERGÊNCIAS DE NF, FALTAS/SOBRAS) */}
                <div className={`p-4 rounded-2xl border ${
                  isDarkMode ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50/70 border-amber-200/80'
                }`}>
                  <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1.5">
                    <MessageSquareWarning size={16} />
                    Comentários & Ocorrências da Carga
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                    Informe aqui: <strong>mercadorias avariadas</strong>, produtos em <strong>falta física</strong> ou quantidades diferentes, produtos que <strong>vieram sem constar na Nota Fiscal</strong> e outros detalhes pertinentes.
                  </p>
                  <textarea
                    rows={3}
                    placeholder="Ex: 2 caixas com embalagem amassada (código 1042); vieram 10 unidades do item B em vez de 15; 1 peça do produto X veio física sem constar na NF..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500 resize-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Outras Observações Gerais (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Carga geral de reposição da semana, descarregamento no galpão 2..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={`w-full p-3.5 rounded-2xl border text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 resize-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-600/25 disabled:opacity-50"
                  >
                    <Plus size={16} />
                    {saving ? 'Gravando...' : 'Salvar no Histórico'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="px-5 h-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Ver Histórico
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: HISTÓRICO COMPLETO */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Histórico de Caminhões Recebidos ({data.history?.length || 0})
                  </span>
                  <button
                    onClick={() => setActiveTab('new_arrival')}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Plus size={14} /> Novo Registro
                  </button>
                </div>

                {!data.history || data.history.length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed rounded-3xl border-slate-200 dark:border-slate-800">
                    <Truck size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum histórico registrado</p>
                    <p className="text-xs text-slate-400 mt-0.5">Registre as chegadas de caminhões para manter o relatório atualizado.</p>
                    <button
                      onClick={() => setActiveTab('new_arrival')}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Registrar Primeiro Carro
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.history.map((record, index) => {
                      const recDate = new Date(record.arrival_date + 'T00:00:00');
                      const formattedDate = !isNaN(recDate.getTime())
                        ? recDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
                        : record.arrival_date;

                      const isEditingThis = editingRecordId === record.id;

                      return (
                        <div
                          key={record.id || index}
                          className={`p-4 rounded-2xl border transition-all ${
                            isDarkMode 
                              ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700' 
                              : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Truck size={16} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black capitalize">{formattedDate}</h4>
                                <p className="text-[11px] text-slate-500">
                                  {index === 0 && <span className="text-emerald-500 font-bold mr-1.5">● Mais recente</span>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (isEditingThis) {
                                    setEditingRecordId(null);
                                  } else {
                                    setEditingRecordId(record.id);
                                    setEditingComments(record.comments || '');
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                                title="Editar comentários/avarias"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteHistory(record.id, record.arrival_date)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                title="Excluir do histórico"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-slate-400 shrink-0" />
                              <span className="text-slate-500">Motorista:</span>
                              <strong className="font-bold text-slate-800 dark:text-slate-200 truncate">{record.driver_name}</strong>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Users size={13} className="text-slate-400 shrink-0" />
                              <span className="text-slate-500">Ajudante:</span>
                              <strong className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                {record.assistant_name || 'Nenhum'}
                              </strong>
                            </div>
                          </div>

                          {/* Seção de Comentários / Ocorrências (Avarias, Falta/Sobra, NF) */}
                          {isEditingThis ? (
                            <div className="mt-3 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 space-y-2">
                              <label className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                <MessageSquareWarning size={13} /> Editar Comentários & Ocorrências:
                              </label>
                              <textarea
                                rows={2}
                                value={editingComments}
                                onChange={(e) => setEditingComments(e.target.value)}
                                placeholder="Avarias, divergência de NF, falta de peças..."
                                className={`w-full p-2.5 rounded-lg border text-xs outline-none ${
                                  isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingRecordId(null)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-700"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditComments(record.id)}
                                  disabled={saving}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                                >
                                  <Save size={12} /> Salvar
                                </button>
                              </div>
                            </div>
                          ) : (
                            record.comments && (
                              <div className="mt-2.5 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 text-xs">
                                <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 text-[10px] uppercase tracking-wider mb-0.5">
                                  <MessageSquareWarning size={12} /> Comentários & Ocorrências:
                                </span>
                                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                  {record.comments}
                                </p>
                              </div>
                            )
                          )}

                          {record.notes && (
                            <p className="mt-2 text-xs italic text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                              &quot;{record.notes}&quot;
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
