'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Flag, Send, Bell, Check, ChevronDown, ChevronRight, Users, AlertCircle, X, Plus, Package, MessageSquare, Bookmark, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ProgressBar } from '@/components/tasks/ProgressBar';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';
import { useUI } from '@/hooks/useUI';
import { useNotifications } from '@/hooks/useNotifications';
import { applyStatusToProfiles } from '@/lib/collaboratorStatus';
import TaskComments from '@/components/tasks/TaskComments';
import { TaskTemplateModal } from '@/components/tasks/TaskTemplateModal';
import { TaskTemplate } from '@/lib/taskTemplates';

export const dynamic = 'force-dynamic';

export default function EditTaskPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params?.id;
  const { isDarkMode } = useTheme();
  const { user: currentUser, isAdmin, isLoading: roleLoading } = useRole();
  const { showToast } = useUI();
  const { createNotification } = useNotifications();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('Outros');
  const [dueDate, setDueDate] = useState('');
  const [dateError, setDateError] = useState('');
  const [priority, setPriority] = useState('Média');
  const [status, setStatus] = useState('Pendente');
  const [progress, setProgress] = useState(0);
  const [initialStatus, setInitialStatus] = useState('');
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [initialAssigneeIds, setInitialAssigneeIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [collabsLoading, setCollabsLoading] = useState(true);
  const [isCollabsExpanded, setIsCollabsExpanded] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [taskTypeMissing, setTaskTypeMissing] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const handleApplyTemplate = (template: TaskTemplate) => {
    if (template.title) setTitle(template.title);
    if (template.description) setDescription(template.description);
    if (template.priority) setPriority(template.priority);
    if (template.taskType) setTaskType(template.taskType);

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
      setCollabsLoading(true);
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
          }
          console.error('Error fetching collaborators:', error.message, error.code, error.details);
          return;
        }
        setCollaborators(applyStatusToProfiles(data || []));
      } catch (err) {
        console.error('Unexpected error fetching collaborators:', err);
      } finally {
        setCollabsLoading(false);
      }
    }
    fetchCollaborators();
  }, []);

  useEffect(() => {
    async function fetchTaskData() {
      if (!taskId) return;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!taskId || !uuidRegex.test(taskId as string)) {
        console.error('Invalid UUID format:', taskId);
        showToast('ID da tarefa inválido.', 'error');
        router.push('/tasks');
        return;
      }
      
      try {
        let { data: task, error: taskError } = (await supabase
          .from('tasks')
          .select(`
            id, 
            title, 
            description, 
            due_date, 
            priority, 
            progress, 
            status, 
            collaborator_id, 
            created_at,
            task_assignees(profile_id)
          `)
          .eq('id', taskId)
          .single()) as any;

        if (taskError && (taskError.message?.includes('Could not find a relationship') || taskError.message?.includes("column tasks.created_by does not exist") || taskError.message?.includes("Could not find the 'created_by' column"))) {
          const { data: fallbackTask, error: fallbackTaskError } = await supabase
            .from('tasks')
            .select('id, title, description, due_date, priority, progress, status, collaborator_id, created_at')
            .eq('id', taskId)
            .single();
          
          if (fallbackTaskError) throw fallbackTaskError;
          task = fallbackTask;
          taskError = null;
        }

        if (taskError) throw taskError;
        if (!task) throw new Error('Tarefa não encontrada');

        setTitle(task.title || '');
        setDescription(task.description || '');
        setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
        setPriority(task.priority || 'medium');
        setStatus(task.status || 'Pendente');
        setProgress(task.progress || 0);
        setInitialStatus(task.status || 'Pendente');
        setTaskType(task.task_type || 'Outros');
        
        // Load assignees from task_assignees table if available, otherwise fallback to collaborator_id
        let assigneeIds = task.task_assignees?.map((ta: any) => ta.profile_id) || [];
        if (assigneeIds.length === 0 && task.collaborator_id) {
          assigneeIds = [task.collaborator_id];
        }
        
        setSelectedCollaborators(assigneeIds);
        setInitialAssigneeIds(assigneeIds);
      } catch (error: any) {
        console.error('Error fetching task:', error?.message || error);
      }
    }
    fetchTaskData();
  }, [taskId, router, showToast]);

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
    if (!title || !description) {
      showToast('Preencha o título e a descrição da tarefa primeiro.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('demands').insert([
        {
          user_id: currentUser?.id,
          user_name: currentUser?.name || 'Colaborador',
          content: `Demanda de Estoque gerada a partir da tarefa: ${title}\n\nDescrição: ${description}`,
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
            `${currentUser?.name || 'Um colaborador'} gerou uma demanda de estoque: "${title}".`,
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

    if (!dueDate) {
      setDateError('A data de entrega é obrigatória.');
      return;
    }

    const selectedDate = new Date(dueDate + 'T00:00:00');
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
      // 1. Update task with primary collaborator_id (for backward compatibility)
      let { error: taskError } = await supabase
        .from('tasks')
        .update({
          title,
          description,
          due_date: dueDate,
          priority,
          status,
          progress,
          task_type: taskType,
          collaborator_id: selectedCollaborators[0]
        })
        .eq('id', taskId);

      if (taskError) {
        const isMissingTaskType = taskError.message?.includes("column \"task_type\" of relation \"tasks\" does not exist") || 
            taskError.message?.includes("Could not find the 'task_type' column");

        if (isMissingTaskType) {
          setTaskTypeMissing(true);
          console.warn('Aviso: A coluna "task_type" não foi encontrada na tabela "tasks". O tipo de tarefa não foi salvo.');
          // Retry without task_type
          const { error: retryError } = await supabase
            .from('tasks')
            .update({
              title,
              description,
              due_date: dueDate,
              priority,
              status,
              progress,
              collaborator_id: selectedCollaborators[0]
            })
            .eq('id', taskId);
          
          if (retryError) {
            taskError = retryError;
          } else {
            taskError = null;
          }
        }
      }

      if (taskError) {
        console.error('Task update error:', taskError);
        if (taskError.code === '42P01') {
          throw new Error('A tabela "tasks" não foi encontrada no banco de dados.');
        }
        if (taskError.message?.includes('check constraint')) {
          throw new Error('Erro de validação: Verifique se a prioridade selecionada é válida no banco de dados.');
        }
        throw taskError;
      }

      // 2. Update task_assignees table
      // First, remove existing ones
      const { error: deleteError } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId);
      
      const isMissingTableDelete = deleteError && (
        deleteError.code === '42P01' || 
        deleteError.message?.includes('task_assignees') ||
        deleteError.message?.includes('schema cache')
      );

      if (deleteError && !isMissingTableDelete) {
        console.error('Error deleting old assignees:', deleteError.message || deleteError);
      }
      
      // Then, insert new ones
      const assigneesToInsert = selectedCollaborators.map(profileId => ({
        task_id: taskId,
        profile_id: profileId
      }));
      
      const { error: assigneesError } = await supabase.from('task_assignees').insert(assigneesToInsert);
      if (assigneesError) {
        const isMissingTableInsert = assigneesError.code === '42P01' || 
                                    assigneesError.message?.includes('task_assignees') ||
                                    assigneesError.message?.includes('schema cache');

        if (isMissingTableInsert) {
          console.warn('Aviso: A tabela "task_assignees" não foi encontrada.');
          setTableMissing(true);
        } else {
          console.error('Error updating task assignees:', assigneesError);
          // Don't throw here to allow the main task update to be considered "saved" 
          // but maybe notify the user
          showToast('Tarefa salva, mas houve um erro ao atualizar os responsáveis.', 'warning');
        }
      }

      // 3. Trigger notifications for new assignees
      const newAssignees = selectedCollaborators.filter(id => !initialAssigneeIds.includes(id));
      for (const assigneeId of newAssignees) {
        await createNotification(
          assigneeId,
          'Nova Tarefa Atribuída',
          `${currentUser?.name || 'Um administrador'} incluiu você na tarefa: "${title}".`,
          'new_task',
          taskId as string,
          `new_task_${taskId}`
        );
      }

      // 4. Trigger notifications if status changed
      if (status !== initialStatus) {
        const otherAssignees = selectedCollaborators.filter(id => id !== currentUser?.id);
        for (const assigneeId of otherAssignees) {
          await createNotification(
            assigneeId,
            'Status de Tarefa Alterado',
            `${currentUser?.name || 'Alguém'} alterou o status da tarefa "${title}" para "${status}".`,
            'status_change',
            taskId as string,
            `status_change_${taskId}_${status}`
          );
        }
      }

      setShowSuccess(true);
      showToast('Tarefa atualizada com sucesso!', 'success');
      setTimeout(() => {
        router.push('/tasks');
      }, 1500);
    } catch (error: any) {
      console.error('Error updating task:', error);
      showToast(error.message || 'Erro ao atualizar tarefa.', 'error');
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
        <h2 className="ml-2 text-xl font-bold tracking-tight">Editar Tarefa</h2>
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
                Usar / Salvar Modelo
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold uppercase">
                  Agilidade
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aplique uma estrutura pronta ou salve esta tarefa como modelo reutilizável
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
                setDescription(description + sampleTable);
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onPaste={(e) => {
              const clipboardData = e.clipboardData.getData('text');
              if (clipboardData && (clipboardData.includes('\t') || clipboardData.includes('\n'))) {
                const rows = clipboardData.split(/\r\n|\n/).filter(r => r.trim().length > 0);
                if (rows.length > 1 && rows.some(r => r.includes('\t'))) {
                  e.preventDefault();
                  const markdownRows = rows.map((row) => {
                    const cells = row.split('\t');
                    return '| ' + cells.join(' | ') + ' |';
                  });
                  if (markdownRows.length > 0) {
                    const headerColCount = markdownRows[0].split('|').length - 2;
                    const separator = '| ' + Array(headerColCount).fill('---').join(' | ') + ' |';
                    markdownRows.splice(1, 0, separator);
                    const tableMarkdown = '\n' + markdownRows.join('\n') + '\n';
                    
                    setDescription(prev => prev + tableMarkdown);
                    showToast('Tabela do Excel colada e formatada com sucesso!', 'success');
                  }
                }
              }
            }}
            className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium resize-y ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`} 
            placeholder="Descreva os objetivos ou cole células do Excel..." 
            rows={5}
          />
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
                  {collabsLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div className="size-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carregando colaboradores...</p>
                    </div>
                  ) : (
                    <>
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
                </>
              )}
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
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
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
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Tipo de Tarefa</label>
              <div className="relative">
                <select 
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
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
                disabled={taskType !== 'Estoque' || isSubmitting}
                className={`w-full h-14 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg ${
                  taskType === 'Estoque'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                    : (isDarkMode ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-100 text-slate-400 border-slate-200')
                }`}
              >
                <MessageSquare size={18} />
                <span>Criar Demanda</span>
              </button>
            </div>
          </div>
          {taskType === 'Estoque' && (
            <p className={`text-[10px] font-medium uppercase tracking-wider ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
              * Ao clicar em &quot;Criar Demanda&quot;, uma solicitação de estoque será enviada aos administradores.
            </p>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              Progresso da Tarefa ({progress}%)
            </label>
          </div>
          <div className="relative pt-1">
            <input 
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => {
                const newProgress = parseInt(e.target.value);
                setProgress(newProgress);
                if (newProgress === 100) {
                  setStatus('Concluída');
                } else if (newProgress < 100 && status === 'Concluída') {
                  setStatus('Em Andamento');
                }
              }}
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">
              <span>Início</span>
              <span>Em Andamento</span>
              <span>Concluído</span>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Status da Tarefa</label>
          <div className="relative">
            <select 
              value={status}
              onChange={(e) => {
                const newStatus = e.target.value;
                setStatus(newStatus);
                if (newStatus === 'Concluída') {
                  setProgress(100);
                }
              }}
              className={`w-full h-14 pl-4 pr-10 border rounded-xl appearance-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <option value="Pendente">Pendente</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Revisão">Revisão</option>
              <option value="Concluída">Concluída</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown size={18} />
            </div>
          </div>
        </div>
      </form>

      {/* Task Comments */}
      {taskId && (
        <div className="px-6 pb-6">
          <div className={`border-t pt-6 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <TaskComments taskId={taskId as string} isDarkMode={isDarkMode} />
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className={`p-6 border-t sticky bottom-0 z-10 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
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
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </div>

      <TaskTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onApplyTemplate={handleApplyTemplate}
        currentFormData={{
          title,
          description,
          priority,
          taskType,
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
            Tarefa Atualizada com Sucesso!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
