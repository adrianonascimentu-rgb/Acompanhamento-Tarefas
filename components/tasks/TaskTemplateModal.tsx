'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Bookmark, 
  Check, 
  Trash2, 
  Plus, 
  Package, 
  Flag, 
  Users, 
  Sparkles, 
  FileText,
  AlertCircle,
  Copy
} from 'lucide-react';
import { TaskTemplate } from '@/lib/taskTemplates';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { useUI } from '@/hooks/useUI';

interface TaskTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: TaskTemplate) => void;
  // Current form values to allow saving as new template
  currentFormData?: {
    title: string;
    description: string;
    priority: string;
    taskType: string;
    selectedCollaboratorIds: string[];
    collaboratorsList?: { id: string; name: string }[];
  };
  isDarkMode?: boolean;
}

export function TaskTemplateModal({
  isOpen,
  onClose,
  onApplyTemplate,
  currentFormData,
  isDarkMode = false
}: TaskTemplateModalProps) {
  const { templates, isLoading, addTemplate, removeTemplate } = useTaskTemplates();
  const { showToast } = useUI();

  const [activeTab, setActiveTab] = useState<'select' | 'save'>('select');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for saving a new template
  const [newTemplateName, setNewTemplateName] = useState(
    currentFormData?.title ? `Modelo: ${currentFormData.title}` : ''
  );
  const [newTitle, setNewTitle] = useState(currentFormData?.title || '');
  const [newDescription, setNewDescription] = useState(currentFormData?.description || '');
  const [newPriority, setNewPriority] = useState(currentFormData?.priority || 'Média');
  const [newTaskType, setNewTaskType] = useState(currentFormData?.taskType || 'Outros');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  // Filter templates
  const filteredTemplates = templates.filter(t => 
    (t.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (t.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (t.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (t.taskType?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (t.priority?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const selectedCollabNames = currentFormData?.collaboratorsList
    ? currentFormData.collaboratorsList
        .filter(c => currentFormData.selectedCollaboratorIds.includes(c.id))
        .map(c => c.name)
    : [];

  const handleSaveNewTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) {
      showToast('Digite um nome para o modelo.', 'warning');
      return;
    }
    if (!newTitle.trim()) {
      showToast('O modelo precisa ter um título de tarefa.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const created = await addTemplate({
        name: newTemplateName.trim(),
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        taskType: newTaskType,
        assigneeIds: currentFormData?.selectedCollaboratorIds || [],
        assigneeNames: selectedCollabNames
      });

      showToast(`Modelo "${created.name}" salvo com sucesso!`, 'success');
      setActiveTab('select');
      setNewTemplateName('');
    } catch (err) {
      console.error('Error saving template:', err);
      showToast('Erro ao salvar modelo.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (confirm(`Tem certeza que deseja excluir o modelo "${name}"?`)) {
      const success = await removeTemplate(id);
      if (success) {
        showToast('Modelo excluído.', 'info');
      } else {
        showToast('Modelos padrão do sistema não podem ser excluídos.', 'warning');
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-colors border ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-800 text-slate-100' 
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-5 border-b ${
            isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
          }`}>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-600 flex items-center justify-center">
                <Bookmark size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg tracking-tight flex items-center gap-2">
                  Modelos de Tarefa
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-semibold">
                    Template System
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Economize tempo reutilizando estruturas preenchidas de tarefas
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className={`flex border-b px-5 gap-4 ${
            isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'
          }`}>
            <button
              onClick={() => setActiveTab('select')}
              className={`py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'select'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FileText size={16} />
              <span>Usar Modelo Salvo ({templates.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('save');
                if (currentFormData?.title && !newTemplateName) {
                  setNewTemplateName(`Modelo: ${currentFormData.title}`);
                }
              }}
              className={`py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'save'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Plus size={16} />
              <span>Salvar Formulário Atual como Modelo</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeTab === 'select' ? (
              <>
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar modelo (ex: 'Inventory Check', 'Estoque', 'Relatório')..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full h-11 pl-10 pr-4 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-600 ${
                      isDarkMode 
                        ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' 
                        : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                {/* Templates List */}
                {isLoading ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="size-8 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-500">Carregando modelos...</p>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <Bookmark size={24} />
                    </div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Nenhum modelo encontrado</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {searchTerm ? 'Tente buscar com outro termo ou limpe o filtro.' : 'Crie um novo modelo a partir do seu formulário de tarefa.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredTemplates.map((template) => {
                      const isDefault = template.isDefault || template.id.startsWith('tpl-weekly') || template.id.startsWith('tpl-monthly') || template.id.startsWith('tpl-preventive') || template.id.startsWith('tpl-stock');
                      return (
                        <div
                          key={template.id}
                          onClick={() => {
                            onApplyTemplate(template);
                            onClose();
                          }}
                          className={`group p-4 rounded-xl border transition-all cursor-pointer relative hover:shadow-md hover:scale-[1.01] ${
                            isDarkMode
                              ? 'bg-slate-950/60 border-slate-800 hover:border-blue-500/50 hover:bg-slate-900'
                              : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1.5">
                                <Sparkles size={14} className="text-amber-500 shrink-0" />
                                {template.name}
                              </span>
                              {isDefault && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Padrão
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {!isDefault && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteTemplate(e, template.id, template.name)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                  title="Excluir Modelo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                              <span className="text-xs font-bold px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-sm">
                                <Check size={12} /> Aplicar
                              </span>
                            </div>
                          </div>

                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Título: {template.title}
                          </p>

                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                            {template.description}
                          </p>

                          {/* Attributes Badges */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                            {template.priority && (
                              <span className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                                template.priority === 'Urgente' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' :
                                template.priority === 'Alta' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' :
                                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                <Flag size={10} /> {template.priority}
                              </span>
                            )}

                            {template.taskType && (
                              <span className="px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 flex items-center gap-1">
                                <Package size={10} /> {template.taskType}
                              </span>
                            )}

                            {(template.assigneeIds?.length || 0) > 0 && (
                              <span className="px-2 py-0.5 rounded font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 flex items-center gap-1">
                                <Users size={10} /> {template.assigneeIds?.length} responsável(is)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Save Current Form as Template */
              <form onSubmit={handleSaveNewTemplate} className="space-y-4">
                <div className={`p-4 rounded-xl border ${
                  isDarkMode ? 'bg-blue-950/20 border-blue-900/50 text-blue-200' : 'bg-blue-50/60 border-blue-100 text-blue-900'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <Sparkles size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-bold">Criar um novo modelo de tarefa reutilizável</p>
                      <p className="opacity-80">
                        O título, descrição, prioridade, tipo e responsáveis atuais do seu formulário serão salvos no modelo para preenchimento automático futuro.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Nome do Modelo
                  </label>
                  <input
                    required
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="ex: Conferência Semanal de Estoque"
                    className={`w-full h-12 px-4 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Título Padrão da Tarefa
                  </label>
                  <input
                    required
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className={`w-full h-11 px-4 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Descrição Padrão
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 resize-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Prioridade</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className={`w-full h-11 px-3 rounded-xl border text-sm font-medium outline-none ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tipo de Tarefa</label>
                    <select
                      value={newTaskType}
                      onChange={(e) => setNewTaskType(e.target.value)}
                      className={`w-full h-11 px-3 rounded-xl border text-sm font-medium outline-none ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <option value="Outros">Outros</option>
                      <option value="Rotina">Rotina</option>
                      <option value="Estoque">Estoque</option>
                    </select>
                  </div>
                </div>

                {selectedCollabNames.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Users size={12} /> Responsáveis salvos junto ao modelo ({selectedCollabNames.length}):
                    </p>
                    <p className="text-xs text-blue-600 font-medium">
                      {selectedCollabNames.join(', ')}
                    </p>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('select')}
                    className={`px-4 h-11 rounded-xl font-bold text-xs ${
                      isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/20 flex items-center gap-2"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Modelo'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
