'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Wrench, 
  X, 
  Save, 
  Trash2, 
  Edit2, 
  ArrowLeft, 
  FileText, 
  Package, 
  User, 
  Calendar, 
  MapPin, 
  Phone, 
  Info,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import { useUI } from '@/hooks/useUI';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Warranty {
  id: string;
  protocol_number: number;
  received_at: string;
  received_by: string;
  defect: string;
  fiscal_document_type: string;
  fiscal_document_number: string;
  fiscal_document_date: string;
  product: string;
  brand_supplier: string;
  observation: string;
  should_discard: string;
  process_responsible: string;
  type: string;
  
  // Equipment specific fields
  assistance_name?: string;
  assistance_phone?: string;
  assistance_address?: string;
  sent_at?: string;
  sent_by?: string;
  reserved_in_system?: string;
  nfe_remessa?: string;
  nfe_retorno?: string;
  returned_at?: string;
  returned_by?: string;
  assistance_observation?: string;
  status: string;
  
  created_at: string;
  created_by?: string;
}

export default function WarrantiesPage() {
  const { isDarkMode } = useTheme();
  const { canAccessWarranties, isAdmin, role, user, isLoading: roleLoading } = useRole();
  const { showToast } = useUI();
  const router = useRouter();
  
  const isSupervisorOrAdmin = isAdmin || role === 'gerente' || role === 'supervisor';
  
  const canEditStatus = (warranty: Warranty | null) => {
    if (!warranty) return false;
    return isSupervisorOrAdmin || warranty.created_by === user?.id;
  };
  
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [statusColumnMissing, setStatusColumnMissing] = useState(false);
  const [errorCodes, setErrorCodes] = useState<{ id: string; label: string }[]>([]);

  const fetchErrorCodes = async () => {
    try {
      const { data, error } = await supabase.from('warranty_error_codes').select('*').order('label', { ascending: true });
      if (!error && data) setErrorCodes(data);
    } catch (e) {
      console.warn('Error codes table not available');
    }
  };

  useEffect(() => {
    fetchErrorCodes();
  }, []);

  const [formData, setFormData] = useState({
    received_at: new Date().toISOString().split('T')[0],
    received_by: '',
    defect: '',
    fiscal_document_type: 'Cupom Fiscal',
    fiscal_document_number: '',
    fiscal_document_date: '',
    product: '',
    brand_supplier: '',
    observation: '',
    should_discard: 'Não',
    process_responsible: '',
    type: 'Peça',
    
    // Equipment specific
    assistance_name: '',
    assistance_phone: '',
    assistance_address: '',
    sent_at: '',
    sent_by: '',
    reserved_in_system: 'Não',
    nfe_remessa: '',
    nfe_retorno: '',
    returned_at: '',
    returned_by: '',
    assistance_observation: '',
    status: 'Aberto'
  });

  const fetchWarranties = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('warranties')
        .select('*')
        .order('protocol_number', { ascending: false });

      if (error) {
        const isTableMissing = error.code === '42P01' || 
                               error.message?.includes('relation "warranties" does not exist') ||
                               error.message?.includes('Could not find the table');
        
        if (isTableMissing) {
          setTableMissing(true);
          setWarranties([]);
          return;
        }
        throw error;
      }
      
      setWarranties(data || []);
    } catch (error: any) {
      console.error('Error fetching warranties:', error.message || error);
      showToast('Erro ao carregar garantias.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!roleLoading && !canAccessWarranties) {
      router.push('/');
    } else if (canAccessWarranties) {
      fetchWarranties();
    }

    // Real-time subscription
    const channel = supabase
      .channel('public:warranties-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' }, () => {
        fetchWarranties();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roleLoading, canAccessWarranties, router, fetchWarranties]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      received_at: new Date().toISOString().split('T')[0],
      received_by: '',
      defect: '',
      fiscal_document_type: 'Cupom Fiscal',
      fiscal_document_number: '',
      fiscal_document_date: '',
      product: '',
      brand_supplier: '',
      observation: '',
      should_discard: 'Não',
      process_responsible: '',
      type: 'Peça',
      assistance_name: '',
      assistance_phone: '',
      assistance_address: '',
      sent_at: '',
      sent_by: '',
      reserved_in_system: 'Não',
      nfe_remessa: '',
      nfe_retorno: '',
      returned_at: '',
      returned_by: '',
      assistance_observation: '',
      status: 'Aberto'
    });
    setSelectedWarranty(null);
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (warranty: Warranty) => {
    setSelectedWarranty(warranty);
    setFormData({
      received_at: warranty.received_at,
      received_by: warranty.received_by,
      defect: warranty.defect,
      fiscal_document_type: warranty.fiscal_document_type,
      fiscal_document_number: warranty.fiscal_document_number,
      fiscal_document_date: warranty.fiscal_document_date,
      product: warranty.product,
      brand_supplier: warranty.brand_supplier,
      observation: warranty.observation || '',
      should_discard: warranty.should_discard,
      process_responsible: warranty.process_responsible,
      type: warranty.type,
      assistance_name: warranty.assistance_name || '',
      assistance_phone: warranty.assistance_phone || '',
      assistance_address: warranty.assistance_address || '',
      sent_at: warranty.sent_at || '',
      sent_by: warranty.sent_by || '',
      reserved_in_system: warranty.reserved_in_system || 'Não',
      nfe_remessa: warranty.nfe_remessa || '',
      nfe_retorno: warranty.nfe_retorno || '',
      returned_at: warranty.returned_at || '',
      returned_by: warranty.returned_by || '',
      assistance_observation: warranty.assistance_observation || '',
      status: warranty.status || 'Aberto'
    });
    setIsDetailOpen(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload = { ...formData };
      if (!payload.sent_at) payload.sent_at = null as any;
      if (!payload.returned_at) payload.returned_at = null as any;
      if (!payload.fiscal_document_date) payload.fiscal_document_date = null as any;

      if (selectedWarranty) {
        const { error } = await supabase
          .from('warranties')
          .update(payload)
          .eq('id', selectedWarranty.id);

        if (error) {
          const isColumnMissing = error.message?.includes('status') ||
                                  error.message?.includes('schema cache') ||
                                  error.message?.includes('column');
          if (isColumnMissing) {
            const retryPayload: any = { ...payload };
            delete retryPayload.status;
            const retryRes = await supabase.from('warranties').update(retryPayload).eq('id', selectedWarranty.id);
            if (retryRes.error) throw retryRes.error;
            setStatusColumnMissing(true);
            showToast('Garantia atualizada com sucesso! (Aviso: Coluna status ausente no Supabase)', 'success');
            setIsModalOpen(false);
            fetchWarranties();
            return;
          }
          throw error;
        }
        showToast('Garantia atualizada com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('warranties')
          .insert([{ ...payload, created_by: user?.id }]);

        if (error) {
          const isColumnMissing = error.message?.includes('status') ||
                                  error.message?.includes('schema cache') ||
                                  error.message?.includes('column');
          if (isColumnMissing) {
            const retryPayload: any = { ...payload };
            delete retryPayload.status;
            const retryRes = await supabase.from('warranties').insert([retryPayload]);
            if (retryRes.error) throw retryRes.error;
            setStatusColumnMissing(true);
            showToast('Garantia registrada com sucesso! (Aviso: Coluna status ausente no Supabase)', 'success');
            setIsModalOpen(false);
            fetchWarranties();
            return;
          }
          throw error;
        }
        showToast('Garantia registrada com sucesso!', 'success');
      }

      setIsModalOpen(false);
      fetchWarranties();
    } catch (error: any) {
      console.warn('Error saving warranty:', error.message || error);
      showToast(`Erro ao salvar garantia: ${error.message || 'Erro desconhecido'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatusUpdate = async (id: string, newStatus: string) => {
    console.log('Solicitando atualização de status:', { id, newStatus });
    
    const warranty = warranties.find(w => w.id === id);
    if (!canEditStatus(warranty || null)) {
      showToast('Você não tem permissão para alterar o status deste registro.', 'error');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('warranties')
        .update({ status: newStatus })
        .eq('id', id)
        .select();

      if (error) {
        const isColumnMissing = error.message?.includes('column') || 
                                error.message?.includes('schema cache') || 
                                error.message?.includes('status') ||
                                error.code === 'PGRST204';

        if (isColumnMissing) {
          setStatusColumnMissing(true);
          setWarranties(prev => prev.map(w => w.id === id ? { ...w, status: newStatus } : w));
          if (selectedWarranty && selectedWarranty.id === id) {
            setSelectedWarranty({ ...selectedWarranty, status: newStatus });
          }
          showToast(`Status alterado para ${newStatus} (Localmente - Coluna status ausente no Supabase)`, 'warning');
          return;
        }

        console.warn('Supabase update status warning:', error.message || error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        const retryRes = await supabase.from('warranties').update({ status: newStatus }).eq('id', id);
        if (retryRes.error) {
          const isColumnMissing = retryRes.error.message?.includes('column') || 
                                  retryRes.error.message?.includes('schema cache') || 
                                  retryRes.error.message?.includes('status') ||
                                  retryRes.error.code === 'PGRST204';
          if (isColumnMissing) {
            setStatusColumnMissing(true);
            setWarranties(prev => prev.map(w => w.id === id ? { ...w, status: newStatus } : w));
            if (selectedWarranty && selectedWarranty.id === id) {
              setSelectedWarranty({ ...selectedWarranty, status: newStatus });
            }
            showToast(`Status alterado para ${newStatus} (Localmente - Coluna status ausente no Supabase)`, 'warning');
            return;
          }
          console.warn('Retry status update warning:', retryRes.error.message || retryRes.error);
        }
      }

      const updatedWarranty = data && data[0] ? data[0] : null;
      console.log('Registro atualizado com sucesso:', updatedWarranty);

      // Atualizar o estado local
      setWarranties(prev => prev.map(w => w.id === id ? { ...w, status: newStatus } : w));
      
      if (selectedWarranty && selectedWarranty.id === id) {
        setSelectedWarranty({ ...selectedWarranty, status: newStatus });
      }
      
      showToast(`Status atualizado para: ${newStatus}`, 'success');
    } catch (error: any) {
      const isColumnMissing = error?.message?.includes('column') || 
                              error?.message?.includes('schema cache') || 
                              error?.message?.includes('status') ||
                              error?.code === 'PGRST204';

      // Always update state locally as a resilient fallback
      setWarranties(prev => prev.map(w => w.id === id ? { ...w, status: newStatus } : w));
      if (selectedWarranty && selectedWarranty.id === id) {
        setSelectedWarranty({ ...selectedWarranty, status: newStatus });
      }

      if (isColumnMissing) {
        setStatusColumnMissing(true);
        showToast(`Status alterado para ${newStatus} (Localmente - Coluna status ausente no Supabase)`, 'warning');
      } else {
        console.warn('Aviso na atualização de status:', error?.message || error);
        showToast(`Status alterado para ${newStatus}`, 'info');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      showToast('Apenas administradores podem excluir registros.', 'error');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta garantia?')) {
      try {
        const { error } = await supabase
          .from('warranties')
          .delete()
          .eq('id', id);

        if (error) throw error;
        showToast('Garantia excluída com sucesso!', 'success');
        setIsDetailOpen(false);
        fetchWarranties();
      } catch (error) {
        console.error('Error deleting warranty:', error);
        showToast('Erro ao excluir garantia.', 'error');
      }
    }
  };

  const safeWarranties = Array.isArray(warranties) ? warranties : [];
  const totalWarranties = safeWarranties.length;
  const totalPecas = safeWarranties.filter(w => w.type === 'Peça').length;
  const totalEquipamentos = safeWarranties.filter(w => w.type === 'Equipamento').length;
  const aguardandoRetorno = safeWarranties.filter(w => w.type === 'Equipamento' && w.sent_at && !w.returned_at).length;
  const paraDescarte = safeWarranties.filter(w => w.should_discard === 'Sim').length;
  const finalizados = safeWarranties.filter(w => w.status === 'Finalizado').length;

  const filteredWarranties = safeWarranties.filter(w => {
    const matchesSearch = w.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          w.protocol_number.toString().includes(searchQuery) ||
                          w.brand_supplier.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeFilter === 'pecas') return w.type === 'Peça';
    if (activeFilter === 'equipamentos') return w.type === 'Equipamento';
    if (activeFilter === 'aguardando') return w.type === 'Equipamento' && w.sent_at && !w.returned_at;
    if (activeFilter === 'descarte') return w.should_discard === 'Sim';
    if (activeFilter === 'finalizados') return w.status === 'Finalizado';
    
    return true;
  });

  if (roleLoading || !canAccessWarranties) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 px-6 py-4 backdrop-blur-md border-b ${isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-100'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Garantias</h1>
              <p className="text-sm text-slate-400 font-medium">Gestão de coberturas</p>
            </div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/warranties/assistances')}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-600 shadow-sm'
            }`}
          >
            <Wrench size={20} />
            <span className="text-sm font-bold">Assistências</span>
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por protocolo, produto ou marca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-12 pr-4 py-3 rounded-2xl border transition-all ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 focus:border-blue-500' 
                : 'bg-slate-50 border-slate-100 focus:border-blue-600'
            }`}
          />
        </div>
      </header>

      <main className="p-6 space-y-4">
        {(tableMissing || statusColumnMissing) && isAdmin && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-500">
                {tableMissing ? 'Banco de Dados não configurado' : 'Coluna "status" ausente no Supabase'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {tableMissing 
                  ? 'A tabela warranties não foi encontrada no banco de dados.'
                  : 'A coluna "status" ainda não existe na tabela "warranties" no Supabase ou o cache de esquema precisa ser recarregado.'}
              </p>
              <button 
                onClick={() => {
                  const sql = tableMissing
                    ? `-- 1. Create the warranties table\nCREATE TABLE IF NOT EXISTS warranties (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  protocol_number SERIAL,\n  received_at DATE NOT NULL,\n  received_by TEXT NOT NULL,\n  defect TEXT NOT NULL,\n  fiscal_document_type TEXT NOT NULL,\n  fiscal_document_number TEXT NOT NULL,\n  fiscal_document_date DATE NOT NULL,\n  product TEXT NOT NULL,\n  brand_supplier TEXT NOT NULL,\n  observation TEXT,\n  should_discard TEXT NOT NULL,\n  process_responsible TEXT NOT NULL,\n  type TEXT NOT NULL,\n  assistance_name TEXT,\n  assistance_phone TEXT,\n  assistance_address TEXT,\n  sent_at DATE,\n  sent_by TEXT,\n  reserved_in_system TEXT,\n  nfe_remessa TEXT,\n  nfe_retorno TEXT,\n  returned_at DATE,\n  returned_by TEXT,\n  assistance_observation TEXT,\n  status TEXT NOT NULL DEFAULT 'Aberto',\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,\n  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL\n);\n\n-- 2. Enable Row Level Security\nALTER TABLE warranties ENABLE ROW LEVEL SECURITY;\n\n-- 3. Create a permissive policy for the demo\nCREATE POLICY "Allow all on warranties" ON warranties FOR ALL USING (true) WITH CHECK (true);`
                    : `-- Adicionar coluna status na tabela warranties e recarregar cache de esquema\nALTER TABLE warranties ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Aberto';\nNOTIFY pgrst, 'reload schema';`;
                  navigator.clipboard.writeText(sql);
                  showToast('SQL copiado para a área de transferência!', 'success');
                }}
                className="text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:underline"
              >
                {tableMissing ? 'Copiar SQL para criar tabela' : 'Copiar SQL para adicionar coluna status'}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Carregando garantias...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <motion.button
                onClick={() => setActiveFilter('all')}
                className={`flex-1 min-w-[110px] flex flex-col gap-1 rounded-2xl p-4 border transition-all text-left active:scale-95 ${
                  activeFilter === 'all' 
                    ? (isDarkMode ? 'bg-blue-900/40 border-blue-500 ring-1 ring-blue-500' : 'bg-blue-50 border-blue-200 ring-1 ring-blue-200')
                    : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                }`}
              >
                <div className="text-blue-600 mb-1"><ShieldCheck size={18} /></div>
                <p className="text-xl font-black leading-none">{totalWarranties}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Total</p>
              </motion.button>

              <motion.button
                onClick={() => setActiveFilter('pecas')}
                className={`flex-1 min-w-[110px] flex flex-col gap-1 rounded-2xl p-4 border transition-all text-left active:scale-95 ${
                  activeFilter === 'pecas' 
                    ? (isDarkMode ? 'bg-indigo-900/40 border-indigo-500 ring-1 ring-indigo-500' : 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200')
                    : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                }`}
              >
                <div className="text-indigo-500 mb-1"><Package size={18} /></div>
                <p className="text-xl font-black leading-none">{totalPecas}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Peças</p>
              </motion.button>

              <motion.button
                onClick={() => setActiveFilter('equipamentos')}
                className={`flex-1 min-w-[110px] flex flex-col gap-1 rounded-2xl p-4 border transition-all text-left active:scale-95 ${
                  activeFilter === 'equipamentos' 
                    ? (isDarkMode ? 'bg-blue-900/40 border-blue-500 ring-1 ring-blue-500' : 'bg-blue-50 border-blue-200 ring-1 ring-blue-200')
                    : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                }`}
              >
                <div className="text-blue-500 mb-1"><Wrench size={18} /></div>
                <p className="text-xl font-black leading-none">{totalEquipamentos}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Equipamentos</p>
              </motion.button>

              <motion.button
                onClick={() => setActiveFilter('aguardando')}
                className={`flex-1 min-w-[110px] flex flex-col gap-1 rounded-2xl p-4 border transition-all text-left active:scale-95 ${
                  activeFilter === 'aguardando' 
                    ? (isDarkMode ? 'bg-amber-900/40 border-amber-500 ring-1 ring-amber-500' : 'bg-amber-50 border-amber-200 ring-1 ring-amber-200')
                    : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                }`}
              >
                <div className="text-amber-500 mb-1"><Clock size={18} /></div>
                <p className="text-xl font-black leading-none">{aguardandoRetorno}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Aguardando</p>
              </motion.button>

              <motion.button
                onClick={() => setActiveFilter('descarte')}
                className={`flex-1 min-w-[110px] flex flex-col gap-1 rounded-2xl p-4 border transition-all text-left active:scale-95 ${
                  activeFilter === 'descarte' 
                    ? (isDarkMode ? 'bg-rose-900/40 border-rose-500 ring-1 ring-rose-500' : 'bg-rose-50 border-rose-200 ring-1 ring-rose-200')
                    : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                }`}
              >
                <div className="text-rose-500 mb-1"><Trash2 size={18} /></div>
                <p className="text-xl font-black leading-none">{paraDescarte}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Descarte</p>
              </motion.button>

              <motion.button
                onClick={() => setActiveFilter('finalizados')}
                className={`flex-1 min-w-[110px] flex flex-col gap-1 rounded-2xl p-4 border transition-all text-left active:scale-95 ${
                  activeFilter === 'finalizados' 
                    ? (isDarkMode ? 'bg-emerald-900/40 border-emerald-500 ring-1 ring-emerald-500' : 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200')
                    : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                }`}
              >
                <div className="text-emerald-500 mb-1"><CheckCircle2 size={18} /></div>
                <p className="text-xl font-black leading-none">{finalizados}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Finalizados</p>
              </motion.button>
            </div>

            {filteredWarranties.length > 0 ? (
              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {activeFilter === 'all' ? 'Registros Recentes' : 
                     activeFilter === 'pecas' ? 'Peças' :
                     activeFilter === 'equipamentos' ? 'Equipamentos' :
                     activeFilter === 'aguardando' ? 'Aguardando Retorno' : 'Para Descarte'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">{filteredWarranties.length} registros</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredWarranties.map((warranty) => (
                    <motion.div
                      key={warranty.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setSelectedWarranty(warranty);
                        setIsDetailOpen(true);
                      }}
                      className={`p-3 rounded-2xl border transition-all active:scale-[0.98] cursor-pointer ${
                        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${
                            warranty.type === 'Equipamento' ? 'bg-blue-500/10 text-blue-500' : 'bg-indigo-500/10 text-indigo-500'
                          }`}>
                            {warranty.type === 'Equipamento' ? <Wrench size={16} /> : <Package size={16} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1 py-0.5 rounded uppercase">
                                #{warranty.protocol_number}
                              </span>
                              <h3 className="font-bold text-xs truncate max-w-[160px]">{warranty.product}</h3>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">{warranty.brand_supplier}</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                      
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {warranty.received_by}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            warranty.status === 'Aberto' ? 'bg-blue-500/10 text-blue-600' :
                            warranty.status === 'Assistência' ? 'bg-indigo-500/10 text-indigo-600' :
                            warranty.status === 'Em andamento' ? 'bg-amber-500/10 text-amber-600' :
                            warranty.status === 'Esperando peça' ? 'bg-orange-500/10 text-orange-600' :
                            'bg-emerald-500/10 text-emerald-600'
                          }`}>
                            {warranty.status}
                          </span>
                          {warranty.type === 'Equipamento' && warranty.sent_at && !warranty.returned_at && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600">
                              Aguardando
                            </span>
                          )}
                          {warranty.should_discard === 'Sim' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600">
                              Descarte
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">
                          {new Date(warranty.received_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className={`p-6 rounded-full ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                  <ShieldCheck size={48} className="text-slate-300" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-500">Nenhuma garantia encontrada</p>
                  <p className="text-sm text-slate-400">Tente mudar os filtros ou registre uma nova.</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={openNewModal}
        className="fixed bottom-28 md:bottom-8 right-6 z-50 flex items-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-full shadow-2xl shadow-blue-600/40 active:scale-95 transition-all group"
      >
        <Plus size={24} />
        <span className="font-bold text-sm">Nova Garantia</span>
      </button>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-[40px] sm:rounded-[40px] p-8 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-2xl text-white">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">{selectedWarranty ? 'Editar Garantia' : 'Nova Garantia'}</h2>
                    <p className="text-sm text-slate-400 font-medium">Preencha os dados do registro</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Info Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Info size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Informações Básicas</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data que recebeu</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="date"
                          name="received_at"
                          required
                          value={formData.received_at}
                          onChange={handleInputChange}
                          className={`w-full pl-12 pr-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quem recebeu</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text"
                          name="received_by"
                          required
                          placeholder="Nome do colaborador"
                          value={formData.received_by}
                          onChange={handleInputChange}
                          className={`w-full pl-12 pr-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Qual o defeito</label>
                    
                    {errorCodes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {errorCodes.map(code => (
                          <button
                            key={code.id}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, defect: code.label }))}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                              formData.defect === code.label
                                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                                : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                            }`}
                          >
                            {code.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <textarea 
                      name="defect"
                      required
                      placeholder="Descreva o problema relatado..."
                      rows={3}
                      value={formData.defect}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-4 rounded-2xl border font-bold resize-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                    />
                  </div>
                </div>

                {/* Fiscal Info Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-blue-600">
                    <FileText size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Documento Fiscal</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tipo de Documento</label>
                      <select 
                        name="fiscal_document_type"
                        value={formData.fiscal_document_type}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold appearance-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      >
                        <option value="Cupom Fiscal">Cupom Fiscal</option>
                        <option value="Nota Fiscal">Nota Fiscal</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nº Documento Fiscal</label>
                      <input 
                        type="text"
                        name="fiscal_document_number"
                        required
                        placeholder="000.000.000"
                        value={formData.fiscal_document_number}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data Documento Fiscal</label>
                      <input 
                        type="date"
                        name="fiscal_document_date"
                        required
                        value={formData.fiscal_document_date}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Product Info Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Package size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Dados do Produto</h3>
                  </div>

                  {canEditStatus(selectedWarranty || { created_by: user?.id } as any) && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status da Garantia</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {['Aberto', 'Assistência', 'Em andamento', 'Esperando peça', 'Finalizado'].map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, status }))}
                            className={`py-2 px-1 rounded-xl border text-[10px] font-bold transition-all ${
                              formData.status === status 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20' 
                                : (isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-500')
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Qual o produto</label>
                      <input 
                        type="text"
                        name="product"
                        required
                        placeholder="Ex: iPhone 15 Pro"
                        value={formData.product}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Marca/Fornecedor</label>
                      <input 
                        type="text"
                        name="brand_supplier"
                        required
                        placeholder="Ex: Apple / Allied"
                        value={formData.brand_supplier}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">É para descartar?</label>
                      <select 
                        name="should_discard"
                        value={formData.should_discard}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold appearance-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      >
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Responsável pelo processo</label>
                      <input 
                        type="text"
                        name="process_responsible"
                        required
                        placeholder="Nome do responsável"
                        value={formData.process_responsible}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Observação</label>
                    <textarea 
                      name="observation"
                      placeholder="Observações adicionais..."
                      rows={2}
                      value={formData.observation}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-4 rounded-2xl border font-bold resize-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                    />
                  </div>
                </div>

                {/* Type Selection */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Wrench size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Tipo de Garantia</h3>
                  </div>

                  <div className="flex gap-4">
                    {['Peça', 'Equipamento'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type }))}
                        className={`flex-1 py-4 rounded-2xl border font-bold transition-all ${
                          formData.type === type 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' 
                            : (isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500')
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equipment Specific Fields */}
                {formData.type === 'Equipamento' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2 text-blue-600">
                      <MapPin size={18} />
                      <h3 className="text-xs font-black uppercase tracking-widest">Dados da Assistência</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assistência</label>
                        <input 
                          type="text"
                          name="assistance_name"
                          placeholder="Nome da assistência"
                          value={formData.assistance_name}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone</label>
                        <input 
                          type="text"
                          name="assistance_phone"
                          placeholder="(00) 0000-0000"
                          value={formData.assistance_phone}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Endereço</label>
                      <input 
                        type="text"
                        name="assistance_address"
                        placeholder="Endereço completo"
                        value={formData.assistance_address}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data de Envio</label>
                        <input 
                          type="date"
                          name="sent_at"
                          value={formData.sent_at}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quem Levou</label>
                        <input 
                          type="text"
                          name="sent_by"
                          placeholder="Nome do colaborador"
                          value={formData.sent_by}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Reservado no Sistema?</label>
                        <select 
                          name="reserved_in_system"
                          value={formData.reserved_in_system}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-4 rounded-2xl border font-bold appearance-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        >
                          <option value="Não">Não</option>
                          <option value="Sim">Sim</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">NFe Remessa Conserto</label>
                        <input 
                          type="text"
                          name="nfe_remessa"
                          placeholder="Número da NFe"
                          value={formData.nfe_remessa}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">NFe Retorno Assistência</label>
                        <input 
                          type="text"
                          name="nfe_retorno"
                          placeholder="Número da NFe"
                          value={formData.nfe_retorno}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data de Retorno</label>
                        <input 
                          type="date"
                          name="returned_at"
                          value={formData.returned_at}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Quem Recebeu</label>
                      <input 
                        type="text"
                        name="returned_by"
                        placeholder="Nome do colaborador"
                        value={formData.returned_by}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Obs. Assistência</label>
                      <textarea 
                        name="assistance_observation"
                        placeholder="Observações da assistência..."
                        rows={2}
                        value={formData.assistance_observation}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-4 rounded-2xl border font-bold resize-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      />
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={`flex-1 py-4 rounded-2xl font-bold ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
                    {selectedWarranty ? 'Salvar Alterações' : 'Registrar Garantia'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail View Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedWarranty && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-[40px] sm:rounded-[40px] p-8 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl text-white ${selectedWarranty.type === 'Equipamento' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                    {selectedWarranty.type === 'Equipamento' ? <Wrench size={24} /> : <Package size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded uppercase">
                        #{selectedWarranty.protocol_number}
                      </span>
                      <h2 className="text-2xl font-black">{selectedWarranty.product}</h2>
                    </div>
                    <p className="text-sm text-slate-400 font-medium">{selectedWarranty.brand_supplier}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Quick Status Update */}
                  {canEditStatus(selectedWarranty) && (
                    <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Mudar Status</p>
                      <div className="grid grid-cols-2 gap-2">
                        {['Aberto', 'Assistência', 'Em andamento', 'Esperando peça', 'Finalizado'].map((status) => (
                          <button
                            key={status}
                            onClick={() => handleQuickStatusUpdate(selectedWarranty.id, status)}
                            className={`py-3 px-2 rounded-2xl border text-xs font-bold transition-all ${
                              selectedWarranty.status === status 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300')
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button 
                    onClick={() => openEditModal(selectedWarranty)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600/10 text-blue-600 font-bold border border-blue-600/20"
                  >
                    <Edit2 size={18} /> Editar
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => handleDelete(selectedWarranty.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-600/10 text-rose-600 font-bold border border-rose-600/20"
                    >
                      <Trash2 size={18} /> Excluir
                    </button>
                  )}
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <DetailItem 
                    icon={<Clock />} 
                    label="Status" 
                    value={selectedWarranty.status}
                    customColor={
                      selectedWarranty.status === 'Aberto' ? 'text-blue-600' :
                      selectedWarranty.status === 'Assistência' ? 'text-indigo-600' :
                      selectedWarranty.status === 'Em andamento' ? 'text-amber-600' :
                      selectedWarranty.status === 'Esperando peça' ? 'text-orange-600' :
                      'text-emerald-600'
                    }
                  />
                  <DetailItem icon={<Calendar />} label="Data Recebimento" value={new Date(selectedWarranty.received_at).toLocaleDateString('pt-BR')} />
                  <DetailItem icon={<User />} label="Quem Recebeu" value={selectedWarranty.received_by} />
                  <DetailItem icon={<FileText />} label="Doc. Fiscal" value={`${selectedWarranty.fiscal_document_type} - ${selectedWarranty.fiscal_document_number}`} />
                  <DetailItem icon={<Calendar />} label="Data Doc. Fiscal" value={new Date(selectedWarranty.fiscal_document_date).toLocaleDateString('pt-BR')} />
                  <DetailItem icon={<User />} label="Responsável" value={selectedWarranty.process_responsible} />
                  <DetailItem icon={<AlertCircle />} label="Descartar?" value={selectedWarranty.should_discard} />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Defeito Relatado</p>
                  <p className={`p-4 rounded-2xl font-medium ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    {selectedWarranty.defect}
                  </p>
                </div>

                {selectedWarranty.observation && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações</p>
                    <p className={`p-4 rounded-2xl font-medium ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                      {selectedWarranty.observation}
                    </p>
                  </div>
                )}

                {/* Equipment Details */}
                {selectedWarranty.type === 'Equipamento' && (
                  <div className="space-y-6 pt-8 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-black uppercase tracking-widest text-blue-600">Dados da Assistência</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <DetailItem icon={<Building2 size={18} />} label="Assistência" value={selectedWarranty.assistance_name || '-'} />
                      <DetailItem icon={<Phone size={18} />} label="Telefone" value={selectedWarranty.assistance_phone || '-'} />
                      <DetailItem icon={<MapPin size={18} />} label="Endereço" value={selectedWarranty.assistance_address || '-'} />
                      <DetailItem icon={<Calendar size={18} />} label="Data Envio" value={selectedWarranty.sent_at ? new Date(selectedWarranty.sent_at).toLocaleDateString('pt-BR') : '-'} />
                      <DetailItem icon={<User size={18} />} label="Quem Levou" value={selectedWarranty.sent_by || '-'} />
                      <DetailItem icon={<ShieldCheck size={18} />} label="Reservado no Sistema" value={selectedWarranty.reserved_in_system || 'Não'} />
                      <DetailItem icon={<FileText size={18} />} label="NFe Remessa" value={selectedWarranty.nfe_remessa || '-'} />
                      <DetailItem icon={<FileText size={18} />} label="NFe Retorno" value={selectedWarranty.nfe_retorno || '-'} />
                      <DetailItem icon={<Calendar size={18} />} label="Data Retorno" value={selectedWarranty.returned_at ? new Date(selectedWarranty.returned_at).toLocaleDateString('pt-BR') : '-'} />
                      <DetailItem icon={<User size={18} />} label="Quem Recebeu" value={selectedWarranty.returned_by || '-'} />
                    </div>
                    {selectedWarranty.assistance_observation && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Obs. Assistência</p>
                        <p className={`p-4 rounded-2xl font-medium ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                          {selectedWarranty.assistance_observation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailItem({ icon, label, value, customColor }: { icon: React.ReactNode, label: string, value: string, customColor?: string }) {
  const { isDarkMode } = useTheme();
  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 16 }) : icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className={`font-bold text-sm ${customColor || ''}`}>{value}</p>
      </div>
    </div>
  );
}

function Building2({ size }: { size: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
      <path d="M10 6h4"/>
      <path d="M10 10h4"/>
      <path d="M10 14h4"/>
      <path d="M10 18h4"/>
    </svg>
  );
}
