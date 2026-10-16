'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, 
  Plus, 
  Search, 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Building2, 
  X,
  Save,
  Smartphone,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  Map as MapIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import { useUI } from '@/hooks/useUI';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Geocoding can be heavy, so we import the Map dynamically
const AssistanceMap = dynamic(() => import('@/components/warranties/AssistanceMap'), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
});

interface Assistance {
  id: string;
  fabricante: string;
  nome: string;
  telefone: string;
  celular: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  observacoes?: string;
}

const MOCK_ASSISTANCES: Assistance[] = [
  {
    id: '1',
    fabricante: 'Samsung',
    nome: 'Centro de Serviço Samsung - SP',
    telefone: '(11) 4004-0000',
    celular: '(11) 99999-8888',
    endereco: 'Av. Paulista, 1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP',
    observacoes: 'Horário: 09h às 18h'
  },
  {
    id: '2',
    fabricante: 'Apple',
    nome: 'Apple Support Center - RJ',
    telefone: '0800-761-0880',
    celular: '',
    endereco: 'Rua Lauro Müller, 116',
    bairro: 'Botafogo',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    observacoes: 'Agendamento prévio necessário'
  }
];

export default function AssistancesPage() {
  const { isDarkMode } = useTheme();
  const { isAdmin } = useRole();
  const { showToast } = useUI();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);
  
  const [assistances, setAssistances] = useState<Assistance[]>([]);

  const [formData, setFormData] = useState({
    fabricante: '',
    nome: '',
    telefone: '',
    celular: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    observacoes: ''
  });

  useEffect(() => {
    setMounted(true);
    fetchAssistances();
  }, []);

  const fetchAssistances = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('assistances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        const isTableMissing = error.code === '42P01' || 
                               error.message?.includes('relation "assistances" does not exist') ||
                               error.message?.includes('Could not find the table \'public.assistances\' in the schema cache');
        
        if (isTableMissing) {
          setTableMissing(true);
          setAssistances(MOCK_ASSISTANCES);
          return;
        }
        throw error;
      }
      setAssistances(data || []);
    } catch (error: any) {
      console.error('Error fetching assistances:', error);
      if (error.message) {
        console.error('Error message:', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openModal = (assistance?: Assistance) => {
    if (assistance) {
      setEditingId(assistance.id);
      setFormData({
        fabricante: assistance.fabricante,
        nome: assistance.nome,
        telefone: assistance.telefone || '',
        celular: assistance.celular || '',
        endereco: assistance.endereco || '',
        bairro: assistance.bairro || '',
        cidade: assistance.cidade || '',
        estado: assistance.estado || '',
        observacoes: assistance.observacoes || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        fabricante: '',
        nome: '',
        telefone: '',
        celular: '',
        endereco: '',
        bairro: '',
        cidade: '',
        estado: '',
        observacoes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from('assistances')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('assistances')
          .insert([formData]);

        if (error) throw error;
      }
      
      await fetchAssistances();
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error: any) {
      console.error('Error saving assistance:', error.message || error);
      alert(`Erro ao salvar assistência: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta assistência?')) {
      try {
        const { error } = await supabase
          .from('assistances')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setAssistances(prev => prev.filter(a => a.id !== id));
      } catch (error) {
        console.error('Error deleting assistance:', error);
        alert('Erro ao excluir assistência.');
      }
    }
  };

  const filteredAssistances = assistances.filter(a => 
    a.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.fabricante.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.cidade.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Table Missing Warning */}
      {tableMissing && isAdmin && (
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-500">Banco de Dados não configurado</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              A tabela <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">assistances</code> não foi encontrada no Supabase. 
              Exibindo dados de demonstração.
            </p>
            <button 
              onClick={() => {
                const sql = `-- 1. Create the assistances table\nCREATE TABLE IF NOT EXISTS assistances (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  fabricante TEXT NOT NULL,\n  nome TEXT NOT NULL,\n  telefone TEXT,\n  celular TEXT,\n  endereco TEXT,\n  bairro TEXT,\n  cidade TEXT,\n  estado TEXT,\n  observacoes TEXT,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL\n);\n\n-- 2. Enable Row Level Security\nALTER TABLE assistances ENABLE ROW LEVEL SECURITY;\n\n-- 3. Create a permissive policy for the demo\nCREATE POLICY "Allow all on assistances" ON assistances FOR ALL USING (true) WITH CHECK (true);`;
                navigator.clipboard.writeText(sql);
                showToast('SQL copiado para a área de transferência! Cole no SQL Editor do Supabase.', 'success');
              }}
              className="text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:underline"
            >
              Copiar SQL para criar tabela
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-40 px-6 py-4 backdrop-blur-md border-b ${isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-100'}`}>
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => router.back()}
            className={`p-2 rounded-xl transition-all active:scale-95 ${
              isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">Assistências</h1>
            <p className="text-sm text-slate-400 font-medium">Rede autorizada</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nome, fabricante ou cidade..."
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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-400 font-medium">Carregando assistências...</p>
          </div>
        ) : (
          <>
            {filteredAssistances.map((assistance) => (
              <motion.div
                key={assistance.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-3xl border ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">{assistance.nome}</h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-600/10 text-blue-600 rounded-full uppercase">
                        {assistance.fabricante}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openModal(assistance)}
                      className={`p-2 rounded-xl transition-all active:scale-95 ${
                        isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-blue-400' : 'bg-slate-50 text-slate-400 hover:text-blue-600'
                      }`}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(assistance.id)}
                      className={`p-2 rounded-xl transition-all active:scale-95 ${
                        isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-rose-400' : 'bg-slate-50 text-slate-400 hover:text-rose-600'
                      }`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-blue-600" />
                    <span>{assistance.telefone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone size={14} className="text-blue-600" />
                    <span>{assistance.celular}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-blue-600 mt-1 shrink-0" />
                    <div className="flex-1">
                      <span className="leading-relaxed">
                        {assistance.endereco}, {assistance.bairro}<br />
                        {assistance.cidade} - {assistance.estado}
                      </span>
                      <button 
                        onClick={() => setExpandedMapId(expandedMapId === assistance.id ? null : assistance.id)}
                        className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:underline"
                      >
                        <MapIcon size={12} />
                        {expandedMapId === assistance.id ? 'Fechar Mapa' : 'Ver no Mapa'}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedMapId === assistance.id && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <AssistanceMap 
                          address={`${assistance.endereco}, ${assistance.cidade}, ${assistance.estado}, Brasil`}
                          name={assistance.nome}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {assistance.observacoes && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs italic border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 mb-1 font-bold uppercase text-[10px]">Observações:</p>
                      {assistance.observacoes}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {filteredAssistances.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex p-4 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-400 mb-4">
                  <Wrench size={32} />
                </div>
                <p className="text-slate-500 font-medium">Nenhuma assistência encontrada</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* FAB */}
      <button 
        onClick={() => openModal()}
        className="fixed bottom-28 md:bottom-8 right-6 p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-600/30 active:scale-95 transition-all z-50 flex items-center gap-2"
      >
        <Plus size={24} />
        <span className="font-bold pr-2">Nova Assistência</span>
      </button>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className={`fixed inset-x-4 bottom-8 top-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] z-[70] rounded-[40px] border overflow-hidden flex flex-col ${
                isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'
              }`}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">{editingId ? 'Editar Assistência' : 'Nova Assistência'}</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Fabricante</label>
                  <input 
                    required
                    name="fabricante"
                    value={formData.fabricante}
                    onChange={handleInputChange}
                    placeholder="Ex: Samsung, Apple, Motorola"
                    className={`w-full px-4 py-3 rounded-2xl border transition-all ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Nome da Assistência</label>
                  <input 
                    required
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    placeholder="Nome do estabelecimento"
                    className={`w-full px-4 py-3 rounded-2xl border transition-all ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Telefone</label>
                    <input 
                      name="telefone"
                      value={formData.telefone}
                      onChange={handleInputChange}
                      placeholder="(00) 0000-0000"
                      className={`w-full px-4 py-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Celular</label>
                    <input 
                      name="celular"
                      value={formData.celular}
                      onChange={handleInputChange}
                      placeholder="(00) 00000-0000"
                      className={`w-full px-4 py-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Endereço</label>
                  <input 
                    name="endereco"
                    value={formData.endereco}
                    onChange={handleInputChange}
                    placeholder="Rua, número, complemento"
                    className={`w-full px-4 py-3 rounded-2xl border transition-all ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Bairro</label>
                    <input 
                      name="bairro"
                      value={formData.bairro}
                      onChange={handleInputChange}
                      placeholder="Nome do bairro"
                      className={`w-full px-4 py-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Cidade</label>
                    <input 
                      name="cidade"
                      value={formData.cidade}
                      onChange={handleInputChange}
                      placeholder="Cidade"
                      className={`w-full px-4 py-3 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Estado</label>
                  <input 
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    placeholder="UF"
                    maxLength={2}
                    className={`w-full px-4 py-3 rounded-2xl border transition-all ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Observações</label>
                  <textarea 
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleInputChange}
                    placeholder="Informações adicionais, horários, etc."
                    rows={3}
                    className={`w-full px-4 py-3 rounded-2xl border transition-all resize-none ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save size={20} />
                    )}
                    {isSaving ? 'Salvando...' : (editingId ? 'Atualizar Assistência' : 'Salvar Assistência')}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
