import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Clock, ClipboardList, Package, HelpCircle, Send, CheckCircle2, Trash2, ListChecks } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';
import { useUI } from '@/hooks/useUI';

interface DemandDetailsModalProps {
  demand: any;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onUpdateStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}

export default function DemandDetailsModal({ demand, isOpen, onClose, isDarkMode, onUpdateStatus, onDelete }: DemandDetailsModalProps) {
  const { user } = useRole();
  const { showToast } = useUI();
  const [updates, setUpdates] = useState<any[]>([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSqlPrompt, setShowSqlPrompt] = useState(false);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  const fetchUpdates = React.useCallback(async () => {
    setLoadingUpdates(true);
    try {
      const { data, error } = await supabase
        .from('demand_updates')
        .select(`
          id,
          content,
          created_at,
          profile_id,
          profiles:profile_id (name, avatar_url)
        `)
        .eq('demand_id', demand.id)
        .order('created_at', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          setShowSqlPrompt(true);
        } else {
          throw error;
        }
      } else {
        setUpdates(data || []);
        setShowSqlPrompt(false);
      }
    } catch (error: any) {
      console.error('Error fetching demand updates:', error?.message || error);
    } finally {
      setLoadingUpdates(false);
    }
  }, [demand?.id]);

  useEffect(() => {
    if (isOpen && demand) {
      fetchUpdates();
    }
  }, [isOpen, demand, fetchUpdates]);

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUpdate.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // Ensure user exists in profiles to satisfy foreign key constraint
      const userId = user.id || '77777777-7777-7777-7777-777777777777';
      try {
        const { data: existingProf } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (!existingProf) {
          await supabase.from('profiles').insert({
            id: userId,
            name: user.name || 'Usuário',
            type: user.role === 'admin' ? 'admin' : 'user'
          });
        }
      } catch (e) {
        console.warn('Could not verify profile:', e);
      }

      const { error } = await supabase
        .from('demand_updates')
        .insert([
          {
            demand_id: demand.id,
            profile_id: userId,
            content: newUpdate.trim()
          }
        ]);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          setShowSqlPrompt(true);
        } else {
          throw error;
        }
      } else {
        setNewUpdate('');
        fetchUpdates();
        showToast('Atualização adicionada com sucesso!', 'success');
      }
    } catch (error: any) {
      console.error('Error adding demand update:', error);
      showToast('Erro ao adicionar atualização: ' + (error?.message || JSON.stringify(error)), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !demand) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl shadow-2xl ${
            isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${
                demand.category === 'sugestão' ? 'bg-blue-100 text-blue-600' :
                demand.category === 'veiculo' ? 'bg-amber-100 text-amber-600' :
                demand.category === 'rotinas' ? 'bg-emerald-100 text-emerald-600' :
                demand.category === 'pedido de material' ? 'bg-purple-100 text-purple-600' :
                demand.category === 'contagem' ? 'bg-rose-100 text-rose-600' :
                'bg-slate-100 text-slate-600'
              }`}>
                {demand.category === 'sugestão' ? <MessageSquare size={20} /> :
                 demand.category === 'veiculo' ? <Clock size={20} /> :
                 demand.category === 'rotinas' ? <ClipboardList size={20} /> :
                 demand.category === 'pedido de material' ? <Package size={20} /> :
                 demand.category === 'contagem' ? <ListChecks size={20} /> :
                 <HelpCircle size={20} />}
              </div>
              <div>
                <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Detalhes da Demanda
                </h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {demand.category}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Colaborador</p>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{demand.user_name}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                <div className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                  demand.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {demand.status === 'pending' ? 'Pendente' : 'Revisado'}
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Data de Criação</p>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  {new Date(demand.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Conteúdo</p>
                <div className={`p-4 rounded-xl text-sm leading-relaxed italic ${
                  isDarkMode ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-50 text-slate-900'
                }`}>
                  &quot;{demand.content}&quot;
                </div>
              </div>
            </div>

            {/* Updates History */}
            <div className={`border-t pt-6 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                <ClipboardList size={16} className="text-blue-600" />
                Histórico de Atualizações
              </h3>

              <div className="space-y-4 mb-4">
                {loadingUpdates ? (
                  <div className="flex justify-center py-4">
                    <div className="size-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                  </div>
                ) : updates.length > 0 ? (
                  updates.map((update) => (
                    <div key={update.id} className="flex gap-3">
                      <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {update.profiles?.name ? String(update.profiles.name).charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className={`flex-1 p-3 rounded-2xl rounded-tl-none ${
                        isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'
                      }`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            {update.profiles?.name || 'Usuário'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(update.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-900'}`}>
                          {update.content}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-4">Nenhuma atualização registrada.</p>
                )}
              </div>

              {/* Add Update Form */}
              <form onSubmit={handleAddUpdate} className="relative mt-4">
                <input
                  type="text"
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  placeholder="Adicionar atualização..."
                  className={`w-full h-10 pl-4 pr-10 rounded-xl text-xs outline-none border transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-blue-600' 
                      : 'bg-white border-slate-200 text-slate-700 focus:border-blue-600 shadow-sm'
                  }`}
                />
                <button
                  disabled={isSubmitting || !newUpdate.trim()}
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 disabled:opacity-50 hover:scale-110 transition-transform"
                >
                  {isSubmitting ? (
                    <div className="size-4 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </form>

              {showSqlPrompt && (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-600 font-medium mb-2">
                    A tabela de atualizações não existe no banco de dados.
                  </p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const sql = `CREATE TABLE IF NOT EXISTS demand_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE demand_updates ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on demand_updates') THEN
        CREATE POLICY "Allow all on demand_updates" ON demand_updates FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;`;
                      navigator.clipboard.writeText(sql);
                      alert('SQL copiado! Cole no SQL Editor do Supabase.');
                    }}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 underline"
                  >
                    Copiar SQL para criar tabela
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className={`p-4 border-t flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
            <div className="flex items-center gap-2">
              {demand.status === 'pending' ? (
                <button
                  onClick={() => {
                    onUpdateStatus(demand.id, 'reviewed');
                    onClose();
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Marcar como Revisado
                </button>
              ) : (
                <button
                  onClick={() => {
                    onUpdateStatus(demand.id, 'pending');
                    onClose();
                  }}
                  className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center gap-2"
                >
                  <Clock size={16} />
                  Marcar como Pendente
                </button>
              )}
            </div>
            <button
              onClick={() => {
                onDelete(demand.id);
                onClose();
              }}
              className="px-4 py-2 bg-rose-100 text-rose-600 text-xs font-bold rounded-xl hover:bg-rose-200 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              Excluir
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
