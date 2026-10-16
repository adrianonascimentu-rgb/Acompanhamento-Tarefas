'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Flag, Send, Bell, Check, ChevronDown, ChevronRight, Users, AlertCircle, X, Plus, Package, MessageSquare, Bookmark, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';
import { useUI } from '@/hooks/useUI';
import { useNotifications } from '@/hooks/useNotifications';
import { applyStatusToProfiles } from '@/lib/collaboratorStatus';
import { TaskTemplateModal } from '@/components/tasks/TaskTemplateModal';
import { TaskTemplate } from '@/lib/taskTemplates';

export default function CreateTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedId = searchParams?.get('collaboratorId');
  const preTitle = searchParams?.get('title');
  const preDescription = searchParams?.get('description');
  const preTaskType = searchParams?.get('taskType');
  const originDemandId = searchParams?.get('origin_demand_id');
  const { isAdmin, user, isAuthenticated, isLoading: roleLoading } = useRole();
  const { isDarkMode } = useTheme();
  const { showToast } = useUI();
  const { createNotification } = useNotifications();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>(preSelectedId ? [preSelectedId] : []);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollabsExpanded, setIsCollabsExpanded] = useState(true);
  const [formData, setFormData] = useState({
    title: preTitle || '',
    description: preDescription || '',
    dueDate: '',
    priority: 'Média',
    taskType: preTaskType || 'Outros',
    notifySlack: true,
    notifyPush: true
  });
  const [dateError, setDateError] = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [taskTypeMissing, setTaskTypeMissing] = useState(false);
  const [originDemandMissing, setOriginDemandMissing] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const handleApplyTemplate = (template: TaskTemplate) => {
    setFormData(prev => ({
      ...prev,
      title: template.title || prev.title,
      description: template.description || prev.description,
      priority: template.priority || prev.priority,
      taskType: template.taskType || prev.taskType
    }));

    if (template.assigneeIds && template.assigneeIds.length > 0) {
      const validIds = collaborators
        .filter(c => template.assigneeIds?.includes(c.id) || (template.assigneeNames && template.assigneeNames.includes(c.name)))
        .map(c => c.id);
      if (validIds.length > 0) {
        setSelectedCollaborators(validIds);
      }
    }

    showToast(`Modelo "${template.name}" aplicado!`, 'success');
  };

  const filteredCollaborators = collaborators.filter(c => 
    (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.location?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const selectedCollabs = collaborators.filter(c => selectedCollaborators.includes(c.id));
  const unselectedCollabs = filteredCollaborators.filter(c => !selectedCollaborators.includes(c.id) && c.status !== 'Inativo');

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.push('/tasks');
    }
  }, [isAdmin, roleLoading, router]);

  useEffect(() => {
    async function fetchCollaborators() {
      try {
        let { data, error } = await supabase
          .from('profiles')
          .select('id, name, location')
          .order('name');
        
        if (error) {
          if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
            console.warn('Política recursiva (42P17) em profiles detectada. Ativando rota de contingência /api/collaborators...');
            try {
              const res = await fetch('/api/collaborators');
              const json = await res.json();
              if (json?.collaborators?.length) {
                setCollaborators(applyStatusToProfiles(json.collaborators));
                return;
              }
            } catch (apiErr) {
              console.warn('Falha no fallback de colaboradores:', apiErr);
            }
            setCollaborators([]);
            return;
          }
          if (error.code === '42P01' || error.code === 'PGRST205') {
            console.warn('Aviso: A tabela "profiles" não foi encontrada no Supabase.');
            setCollaborators([]);
            return;
          }
          if (error.message === 'Failed to fetch' || error.message?.includes('Failed to fetch') || error.message?.includes('TypeError')) {
            setCollaborators([]);
            return;
          }
          console.error('Supabase error fetching collaborators:', error.message, error.code);
          return;
        }
        setCollaborators(applyStatusToProfiles(data || []));
      } catch (err: any) {
        if (err?.message === 'Failed to fetch' || err?.message?.includes('Failed to fetch') || err instanceof TypeError) {
          return;
        }
        console.error('Unexpected error fetching collaborators:', err?.message || err);
      }
    }
    fetchCollaborators();
  }, []);

  useEffect(() => {
    if (preSelectedId && !selectedCollaborators.includes(preSelectedId)) {
      setSelectedCollaborators(prev => [...prev, preSelectedId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectedId]);

  const toggleCollaborator = (id: string) => {
    setSelectedCollaborators(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        if (prev.length >= 10) {
          showToast('Limite máximo de 10 responsáveis atingido.', 'warning');
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleCreateDemand = async () => {
    if (!formData.title || !formData.description) {
      showToast('Preencha o título e a descrição da tarefa primeiro.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('demands').insert([
        {
          user_id: user?.id,
          user_name: user?.name || 'Colaborador',
          content: `Demanda de Estoque gerada a partir da tarefa: ${formData.title}\n\nDescrição: ${formData.description}`,
          category: 'pedido de material',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ]);

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
            'Nova Demanda de Estoque',
            `${user?.name || 'Um colaborador'} gerou uma demanda de estoque: "${formData.title}".`,
            'warning'
          );
        }
      }

      showToast('Demanda de estoque criada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Error creating demand:', error);
      showToast('Erro ao criar demanda.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setDateError('');

    if (!formData.dueDate) {
      setDateError('A data de entrega é obrigatória.');
      return;
    }

    const selectedDate = new Date(formData.dueDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(selectedDate.getTime())) {
      setDateError('Data inválida.');
      return;
    }

    if (selectedCollaborators.length === 0) {
      showToast('Selecione pelo menos um responsável.', 'warning');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // 1. Create the task with primary collaborator_id (for backward compatibility)
      const taskData: any = {
        title: formData.title,
        description: formData.description,
        due_date: formData.dueDate,
        priority: formData.priority,
        task_type: formData.taskType,
        origin_demand_id: originDemandId,
        status: 'Pendente',
        progress: 0,
        collaborator_id: selectedCollaborators[0],
        created_at: new Date().toISOString()
      };

      // Add created_by if user is logged in
      if (user?.id) {
        taskData.created_by = user.id;
      }

      let { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (taskError) {
        // Check if the error is due to missing created_by or task_type or origin_demand_id column
        const isMissingCreatedBy = taskError.message?.includes("column \"created_by\" of relation \"tasks\" does not exist") || 
            taskError.message?.includes("Could not find the 'created_by' column");
        const isMissingTaskType = taskError.message?.includes("column \"task_type\" of relation \"tasks\" does not exist") || 
            taskError.message?.includes("Could not find the 'task_type' column");
        const isMissingOriginDemand = taskError.message?.includes("column \"origin_demand_id\" of relation \"tasks\" does not exist") || 
            taskError.message?.includes("Could not find the 'origin_demand_id' column") ||
            taskError.code === 'PGRST204';

        if (isMissingCreatedBy || isMissingTaskType || isMissingOriginDemand) {
          if (isMissingTaskType) {
            setTaskTypeMissing(true);
            console.warn('Aviso: A coluna "task_type" não foi encontrada na tabela "tasks". O tipo de tarefa não foi salvo.');
          }
          if (isMissingOriginDemand) {
            setOriginDemandMissing(true);
            console.warn('Aviso: A coluna "origin_demand_id" não foi encontrada na tabela "tasks". O vínculo com a demanda não foi salvo.');
          }
          
          // Retry without problematic columns
          const { created_by, task_type, origin_demand_id, ...retryData } = taskData;
          
          // Re-add them conditionally if they weren't the cause
          if (!isMissingCreatedBy && taskData.created_by) (retryData as any).created_by = taskData.created_by;
          if (!isMissingTaskType) (retryData as any).task_type = taskData.task_type;
          if (!isMissingOriginDemand) (retryData as any).origin_demand_id = taskData.origin_demand_id;

          const { data: retryTask, error: retryError } = await supabase
            .from('tasks')
            .insert(retryData)
            .select()
            .single();
          
          if (retryError) {
            if (retryError.message?.includes('tasks_priority_check') && retryData.priority === 'Urgente') {
              console.warn('Aviso: A prioridade "Urgente" não é suportada pelo banco de dados. Salvando como "Alta".');
              const { data: fallbackTask, error: fallbackError } = await supabase
                .from('tasks')
                .insert({ ...retryData, priority: 'Alta' })
                .select()
                .single();
              if (fallbackError) throw fallbackError;
              task = fallbackTask;
              taskError = null;
            } else {
              throw retryError;
            }
          } else {
            task = retryTask;
            taskError = null;
          }
        } else if (taskError.message?.includes('tasks_priority_check') && taskData.priority === 'Urgente') {
          console.warn('Aviso: A prioridade "Urgente" não é suportada pelo banco de dados. Salvando como "Alta".');
          const { data: fallbackTask, error: fallbackError } = await supabase
            .from('tasks')
            .insert({ ...taskData, priority: 'Alta' })
            .select()
            .single();
          if (fallbackError) throw fallbackError;
          task = fallbackTask;
          taskError = null;
        } else {
          throw taskError;
        }
      }

      if (!task) throw new Error('Erro ao criar tarefa: Nenhum dado retornado.');

      // 2. Create entries in task_assignees table
      const assigneesToInsert = selectedCollaborators.map(profileId => ({
        task_id: task.id,
        profile_id: profileId
      }));
      
      const { error: assigneesError } = await supabase.from('task_assignees').insert(assigneesToInsert);
      if (assigneesError) {
        const isMissingTable = assigneesError.code === '42P01' || 
                              assigneesError.message?.includes('task_assignees') ||
                              assigneesError.message?.includes('schema cache');
        
        if (isMissingTable) {
          console.warn('Aviso: A tabela "task_assignees" não foi encontrada. A tarefa foi criada, mas sem múltiplos responsáveis.');
          setTableMissing(true);
        } else {
          console.error('Error creating task assignees:', assigneesError);
          showToast('Tarefa criada, mas houve um erro ao vincular os responsáveis.', 'warning');
        }
      }

      // 3. Create notifications and trigger multi-device push alerts for all assignees
      const isRoutine = formData.taskType?.toLowerCase() === 'rotina' || formData.taskType?.toLowerCase() === 'routine';
      const notifTitle = isRoutine ? '📋 Nova Rotina Atribuída!' : '📌 Nova Tarefa Atribuída!';
      const notifMessage = isRoutine
        ? `${user?.name || 'A coordenação'} adicionou uma nova rotina para você: "${formData.title}".`
        : `${user?.name || 'Um administrador'} atribuiu uma nova tarefa a você: "${formData.title}".`;

      for (const profileId of selectedCollaborators) {
        await createNotification(
          profileId,
          notifTitle,
          notifMessage,
          isRoutine ? 'routine' : 'new_task',
          task.id,
          `${isRoutine ? 'routine' : 'new_task'}_${task.id}`,
          formData.notifyPush
        );
      }

      setShowSuccess(true);
      showToast('Tarefa delegada com sucesso!', 'success');
      setTimeout(() => {
        router.push('/tasks');
      }, 1500);
    } catch (error: any) {
      console.error('Error creating task:', error);
      if (typeof error === 'object' && error !== null) {
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      }
      showToast(error?.message || error?.details || error?.hint || 'Erro ao criar tarefa. Verifique a conexão e tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex flex-col h-full transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 flex items-center px-4 py-6 border-b transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <Link href="/tasks" className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
          <ArrowLeft size={20} />
        </Link>
        <h2 className="ml-2 text-xl font-bold tracking-tight">Criar Nova Tarefa</h2>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Task Template System Banner */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
          isDarkMode 
            ? 'bg-slate-900 border-slate-800' 
            : 'bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border-blue-100 shadow-sm'
        }`}>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <Bookmark size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Usar Modelo de Tarefa
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold uppercase">
                  Agilidade
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preencha título, descrição e responsáveis automaticamente (ex: Conferência de Estoque)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className="px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Sparkles size={14} className="text-amber-300" />
            <span>Modelos</span>
          </button>
        </div>

        {/* Task Title */}
        <div className="space-y-2">
          <label className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Título da Tarefa</label>
          <input 
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={`w-full h-14 px-4 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`} 
            placeholder="ex: Conferência de Estoque Semanal" 
            type="text"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Descrição</label>
            <button
              type="button"
              onClick={() => {
                const sampleTable = "\n| Produto | Qtd | Valor |\n|---|---|---|\n| Item Exemplo 1 | 10 | R$ 100,00 |\n| Item Exemplo 2 | 5 | R$ 50,00 |";
                setFormData({ ...formData, description: formData.description + sampleTable });
                showToast('Modelo de tabela inserido!', 'success');
              }}
              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider hover:underline flex items-center gap-1"
              title="Inserir modelo de tabela ou colar do Excel"
            >
              <span>+ Inserir Tabela / Colar do Excel</span>
            </button>
          </div>
          <textarea 
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            onPaste={(e) => {
              const clipboardData = e.clipboardData.getData('text');
              if (clipboardData && (clipboardData.includes('\t') || clipboardData.includes('\n'))) {
                // Check if it looks like tabular data (tabs or multiple lines with tabs)
                const rows = clipboardData.split(/\r\n|\n/).filter(r => r.trim().length > 0);
                if (rows.length > 1 && rows.some(r => r.includes('\t'))) {
                  e.preventDefault();
                  // Convert TSV (Excel copy) into Markdown table format
                  const markdownRows = rows.map((row, idx) => {
                    const cells = row.split('\t');
                    return '| ' + cells.join(' | ') + ' |';
                  });
                  if (markdownRows.length > 0) {
                    const headerColCount = markdownRows[0].split('|').length - 2;
                    const separator = '| ' + Array(headerColCount).fill('---').join(' | ') + ' |';
                    markdownRows.splice(1, 0, separator);
                    const tableMarkdown = '\n' + markdownRows.join('\n') + '\n';
                    
                    setFormData(prev => ({
                      ...prev,
                      description: prev.description + tableMarkdown
                    }));
                    showToast('Tabela do Excel colada e formatada com sucesso!', 'success');
                  }
                }
              }
            }}
            className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium resize-y ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`} 
            placeholder="Digite normalmente ou cole células do Excel/Planilhas diretamente aqui..." 
            rows={5}
          />
          <p className="text-[10px] text-slate-400 italic">Dica: Você pode digitar normalmente ou copiar linhas e colunas de uma planilha do Excel e colar diretamente aqui (serão convertidas em tabela).</p>
        </div>

        {/* Assignee Selection - Multi-select */}
        <div className="space-y-4">
          {tableMissing && (
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-amber-900/20 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">Tabela de múltiplos responsáveis não encontrada</h4>
                  <p className="text-xs opacity-90 mb-3">
                    Para habilitar múltiplos responsáveis, você precisa criar a tabela <code>task_assignees</code> no Supabase.
                  </p>
                  <div className={`p-3 rounded-lg text-[10px] font-mono overflow-x-auto ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700'}`}>
                    <pre>
{`CREATE TABLE IF NOT EXISTS task_assignees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(task_id, profile_id)
);
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on task_assignees" ON task_assignees FOR ALL USING (true) WITH CHECK (true);`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setIsCollabsExpanded(!isCollabsExpanded)}
            >
              <Users size={16} className="text-blue-600" />
              <label className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                Responsáveis ({selectedCollaborators.length}/10)
              </label>
              {isCollabsExpanded ? (
                <ChevronDown size={14} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
              ) : (
                <ChevronRight size={14} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
              )}
            </div>
            {selectedCollaborators.length > 0 && (
              <button 
                type="button"
                onClick={() => setSelectedCollaborators([])}
                className="text-[10px] font-bold text-rose-500 uppercase hover:underline"
              >
                Limpar Todos
              </button>
            )}
          </div>

          <AnimatePresence>
            {isCollabsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                {/* Search Bar */}
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Buscar colaborador ou setor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full h-11 px-4 border rounded-xl focus:ring-2 focus:ring-blue-600 transition-all outline-none text-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                  {/* Selected Section */}
                  {selectedCollabs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Selecionados</p>
                      <div className="grid grid-cols-1 gap-2">
                        {selectedCollabs.map((collab) => (
                          <div 
                            key={collab.id}
                            onClick={() => toggleCollaborator(collab.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isDarkMode ? 'bg-blue-900/30 border-blue-800 ring-1 ring-blue-800' : 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="size-5 rounded-md bg-blue-600 flex items-center justify-center">
                                <Check size={14} className="text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-blue-600">{collab.name}</p>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">{collab.location}</p>
                              </div>
                            </div>
                            <X size={14} className="text-blue-600" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available Section */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {searchTerm ? 'Resultados da Busca' : 'Disponíveis'}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {unselectedCollabs.length > 0 ? (
                        unselectedCollabs.map((collab) => {
                          const isLimitReached = selectedCollaborators.length >= 10;
                          return (
                            <div 
                              key={collab.id}
                              onClick={() => {
                                if (isLimitReached) {
                                  showToast('Limite máximo de 10 responsáveis atingido.', 'warning');
                                } else {
                                  toggleCollaborator(collab.id);
                                }
                              }}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                isLimitReached 
                                  ? 'opacity-50 cursor-not-allowed ' + (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200')
                                  : 'cursor-pointer ' + (isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300')
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`size-5 rounded-md border flex items-center justify-center transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`} />
                                <div>
                                  <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{collab.name}</p>
                                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">{collab.location}</p>
                                </div>
                              </div>
                              <Plus size={14} className="text-slate-400" />
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 text-center py-4">Nenhum colaborador encontrado.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Due Date */}
          <div className="space-y-2">
            <label className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Data de Entrega</label>
            <div className="relative">
              <input 
                required
                value={formData.dueDate}
                onChange={(e) => {
                  setFormData({ ...formData, dueDate: e.target.value });
                  setDateError('');
                }}
                className={`w-full h-14 pl-4 pr-10 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium ${
                  dateError ? 'border-rose-500 ring-1 ring-rose-500' : (isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900')
                }`} 
                type="date"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Calendar size={18} />
              </div>
            </div>
            {dateError && (
              <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-1">
                <AlertCircle size={10} /> {dateError}
              </p>
            )}
          </div>

          {/* Priority Level */}
          <div className="space-y-2">
            <label className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Prioridade</label>
            <div className="relative">
              <select 
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className={`w-full h-14 pl-4 pr-10 border rounded-xl appearance-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Flag size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* Task Type and Demand Button */}
        <div className="space-y-4 pt-2">
          {taskTypeMissing && (
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-amber-900/20 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">Coluna de Tipo de Tarefa não encontrada</h4>
                  <p className="text-xs opacity-90 mb-3">
                    Para salvar o tipo de tarefa, você precisa adicionar a coluna <code>task_type</code> na tabela <code>tasks</code> do Supabase.
                  </p>
                  <div className={`p-3 rounded-lg text-[10px] font-mono overflow-x-auto ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700'}`}>
                    <pre>
{`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'Outros';`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {originDemandMissing && (
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-amber-900/20 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">Coluna de Vínculo com Demanda não encontrada</h4>
                  <p className="text-xs opacity-90 mb-3">
                    Para vincular tarefas a demandas de estoque, você precisa adicionar a coluna <code>origin_demand_id</code> na tabela <code>tasks</code> do Supabase.
                  </p>
                  <div className={`p-3 rounded-lg text-[10px] font-mono overflow-x-auto ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700'}`}>
                    <pre>
{`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS origin_demand_id UUID REFERENCES demands(id) ON DELETE SET NULL;`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Tipo de Tarefa</label>
              <div className="relative">
                <select 
                  value={formData.taskType}
                  onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
                  className={`w-full h-14 pl-4 pr-10 border rounded-xl appearance-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  <option value="Outros">Outros</option>
                  <option value="Estoque">Estoque</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Package size={18} />
                </div>
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCreateDemand}
                disabled={formData.taskType !== 'Estoque' || isSubmitting}
                className={`w-full h-14 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg ${
                  formData.taskType === 'Estoque'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                    : (isDarkMode ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-100 text-slate-400 border-slate-200')
                }`}
              >
                <MessageSquare size={18} />
                <span>Criar Demanda</span>
              </button>
            </div>
          </div>
          {formData.taskType === 'Estoque' && (
            <p className={`text-[10px] font-medium uppercase tracking-wider ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
              * Ao clicar em &quot;Criar Demanda&quot;, uma solicitação de estoque será enviada aos administradores.
            </p>
          )}
        </div>

          {/* Additional Options */}
        <div className="pt-2 space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Bell size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Notificar via Slack</p>
                <p className="text-xs text-slate-500">Alertar equipe ao criar</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={formData.notifySlack}
                onChange={(e) => setFormData({ ...formData, notifySlack: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-purple-50/50 border border-purple-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                <Bell size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Notificar via Push</p>
                <p className="text-xs text-slate-500">Alertar responsáveis</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={formData.notifyPush}
                onChange={(e) => setFormData({ ...formData, notifyPush: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>
      </form>

      {/* Bottom Action Bar */}
      <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className={`h-14 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              isDarkMode 
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Bookmark size={16} className="text-blue-600" />
            <span>Salvar / Gerenciar Modelos</span>
          </button>

          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || showSuccess || selectedCollaborators.length === 0}
            className={`sm:col-span-2 h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 ${isSubmitting || selectedCollaborators.length === 0 ? 'cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : showSuccess ? (
              <Check size={24} className="animate-bounce" />
            ) : (
              <>
                <Send size={20} />
                Delegar Tarefa
              </>
            )}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">A tarefa ficará visível para todos os envolvidos</p>
      </div>

      <TaskTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onApplyTemplate={handleApplyTemplate}
        currentFormData={{
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          taskType: formData.taskType,
          selectedCollaboratorIds: selectedCollaborators,
          collaboratorsList: collaborators
        }}
        isDarkMode={isDarkMode}
      />

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[100]"
          >
            <Check size={20} />
            Tarefa Delegada com Sucesso!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
