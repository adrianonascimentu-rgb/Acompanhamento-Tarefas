'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, Car, ClipboardList, Package, HelpCircle, ListChecks, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUI } from '@/hooks/useUI';
import { useNotifications } from '@/hooks/useNotifications';
import { useTheme } from '@/hooks/useTheme';

interface DemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

const CATEGORIES = [
  { id: 'sugestão', label: 'Sugestão', icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50', darkBg: 'bg-blue-500/20' },
  { id: 'veiculo', label: 'Veículo', icon: Car, color: 'text-amber-500', bg: 'bg-amber-50', darkBg: 'bg-amber-500/20' },
  { id: 'rotinas', label: 'Rotinas', icon: ClipboardList, color: 'text-emerald-500', bg: 'bg-emerald-50', darkBg: 'bg-emerald-500/20' },
  { id: 'pedido de material', label: 'Pedido de Material', icon: Package, color: 'text-purple-500', bg: 'bg-purple-50', darkBg: 'bg-purple-500/20' },
  { id: 'contagem', label: 'Contagem de Estoque', icon: ListChecks, color: 'text-rose-500', bg: 'bg-rose-50', darkBg: 'bg-rose-500/20' },
  { id: 'outros', label: 'Outros', icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-50', darkBg: 'bg-slate-500/20' },
];

interface MaterialItem {
  code: string;
  name: string;
  quantity: string;
}

export function DemandModal({ isOpen, onClose, user }: DemandModalProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  
  // 6 blank rows initially for "pedido de material"
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([
    { code: '', name: '', quantity: '' },
    { code: '', name: '', quantity: '' },
    { code: '', name: '', quantity: '' },
    { code: '', name: '', quantity: '' },
    { code: '', name: '', quantity: '' },
    { code: '', name: '', quantity: '' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useUI();
  const { createNotification } = useNotifications();
  const { isDarkMode } = useTheme();

  const handleItemChange = (index: number, field: keyof MaterialItem, value: string) => {
    const updated = [...materialItems];
    updated[index][field] = value;
    setMaterialItems(updated);

    // If typing in the last row and it's not empty, add a new blank row automatically
    if (index === materialItems.length - 1 && (value.trim() !== '')) {
      setMaterialItems(prev => [...prev, { code: '', name: '', quantity: '' }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      showToast('Por favor, selecione a categoria da demanda.', 'warning');
      return;
    }

    let finalContent = content;

    // If "pedido de material", compile the table into content if description is empty or alongside it
    if (category === 'pedido de material') {
      const validItems = materialItems.filter(item => item.code.trim() || item.name.trim() || item.quantity.trim());
      if (validItems.length === 0 && !content.trim()) {
        showToast('Adicione pelo menos um item na tabela de materiais ou preencha a descrição.', 'warning');
        return;
      }

      if (validItems.length > 0) {
        const tableRows = validItems.map(i => `| ${i.code || '-'} | ${i.name || '-'} | ${i.quantity || '-'} |`).join('\n');
        const tableMarkdown = `\n\n**Lista de Materiais Solicitados:**\n| Código | Nome do Material | Quantidade |\n|---|---|---|\n${tableRows}\n`;
        finalContent = (content ? content + '\n' : '') + tableMarkdown;
      }
    } else {
      if (!content.trim()) {
        showToast('Por favor, preencha a descrição da demanda.', 'warning');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('demands').insert([
        {
          user_id: user?.id,
          user_name: user?.name || 'Colaborador Desconhecido',
          content: finalContent,
          category,
          status: category === 'pedido de material' ? 'a solicitar' : 'Pendente',
          created_at: new Date().toISOString(),
        },
      ]).select();

      if (error) throw error;

      // Notify admins and managers
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .or('role.eq.admin,role.eq.gerente');

      if (admins) {
        for (const admin of admins) {
          await createNotification(
            admin.id,
            'Nova Demanda Recebida',
            `${user?.name || 'Um colaborador'} enviou um pedido de material (${category}).`,
            'warning'
          );
        }
      }

      showToast('Demanda enviada com sucesso!', 'success');
      setContent('');
      setCategory('');
      setMaterialItems([
        { code: '', name: '', quantity: '' },
        { code: '', name: '', quantity: '' },
        { code: '', name: '', quantity: '' },
        { code: '', name: '', quantity: '' },
        { code: '', name: '', quantity: '' },
        { code: '', name: '', quantity: '' },
      ]);
      onClose();
    } catch (error: any) {
      console.error('Error submitting demand:', error?.message || JSON.stringify(error));
      if (error?.code === '42P01' || error?.message?.includes('relation "demands" does not exist') || JSON.stringify(error).includes('42P01')) {
        showToast('Tabela de demandas não encontrada. Contate o administrador.', 'error');
      } else {
        showToast('Erro ao enviar demanda.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border my-8 ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
            }`}
          >
            <div className={`p-6 border-b flex items-center justify-between ${
              isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-50 bg-slate-50/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Nova Demanda</h2>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Enviado por: <span className="text-blue-600">{user?.name || 'Colaborador'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Categoria da Demanda</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                        category === cat.id
                          ? `border-blue-600 ring-2 ring-blue-600/20 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`
                          : `${isDarkMode ? 'border-slate-800 hover:border-slate-700' : 'border-slate-100 hover:border-blue-200'}`
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${isDarkMode ? cat.darkBg : cat.bg} ${cat.color}`}>
                        <cat.icon size={18} />
                      </div>
                      <span className={`text-[10px] font-bold text-center leading-tight ${
                        isDarkMode ? 'text-slate-300' : 'text-slate-700'
                      }`}>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Material Items Table when category is 'pedido de material' */}
              {category === 'pedido de material' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tabela de Materiais (Adiciona linha automática)</label>
                    <span className="text-[10px] text-blue-500 font-bold">{materialItems.filter(i => i.code || i.name || i.quantity).length} itens preenchidos</span>
                  </div>

                  <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/50'}`}>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className={`border-b font-bold uppercase tracking-wider text-[10px] ${
                          isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}>
                          <th className="py-2.5 px-3 w-1/4">Código</th>
                          <th className="py-2.5 px-3 w-2/4">Nome do Material</th>
                          <th className="py-2.5 px-3 w-1/4">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {materialItems.map((item, index) => (
                          <tr key={index} className="transition-colors group/row">
                            <td className="p-2 w-28">
                              <input
                                type="text"
                                placeholder={`Cód #${index + 1}`}
                                value={item.code}
                                onChange={(e) => handleItemChange(index, 'code', e.target.value)}
                                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-medium text-center outline-none transition-all ${
                                  isDarkMode 
                                    ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30' 
                                    : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'
                                }`}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="Nome do produto ou material..."
                                value={item.name}
                                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                className={`w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none transition-all ${
                                  isDarkMode 
                                    ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30' 
                                    : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'
                                }`}
                              />
                            </td>
                            <td className="p-2 w-24">
                              <input
                                type="text"
                                placeholder="Qtd"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                className={`w-full px-3 py-2 rounded-xl border text-xs font-bold text-center outline-none transition-all ${
                                  isDarkMode 
                                    ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30' 
                                    : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'
                                }`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Dica: Preencha a última linha da tabela e uma nova linha em branco será gerada automaticamente abaixo.</p>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {category === 'pedido de material' ? 'Observações Adicionais (Opcional)' : 'Descrição da Demanda'}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={category === 'pedido de material' ? 'Alguma observação sobre o pedido...' : 'Descreva detalhadamente sua demanda...'}
                  className={`w-full h-24 p-4 rounded-2xl border focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all resize-none text-sm outline-none ${
                    isDarkMode 
                      ? 'border-slate-800 bg-slate-800/50 text-white placeholder:text-slate-600' 
                      : 'border-slate-100 bg-slate-50 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-blue-600/20"
              >
                {isSubmitting ? (
                  <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    <span>Enviar Demanda</span>
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
