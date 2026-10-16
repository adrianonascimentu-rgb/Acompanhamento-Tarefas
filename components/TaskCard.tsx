'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flag, 
  Edit2, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  Package, 
  Send,
  Clock,
  AlertCircle,
  ChevronDown,
  MapPin,
  Navigation
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ProgressBar } from '@/components/tasks/ProgressBar';
import { CompletionFeedback } from '@/components/CompletionFeedback';
import { openInNativeGPS } from '@/lib/navigation';

interface Assignee {
  name: string;
  avatarUrl?: string;
}

interface Task {
  id: string | number;
  title: string;
  description?: string;
  due: string;
  due_date: string;
  priority: string;
  progress: number;
  status: string;
  assignees: Assignee[];
  category?: string;
  task_type?: string;
  isDueSoon?: boolean;
  location?: string;
  destination_address?: string;
  destination_lat?: number;
  destination_lng?: number;
  checkin_lat?: number;
  checkin_lng?: number;
  checkin_at?: string;
  distanceFormatted?: string;
  distanceKm?: number;
}

interface TaskCardProps {
  task: Task;
  idx: number;
  viewMode: 'list' | 'grid' | 'calendar' | 'kanban';
  isDarkMode: boolean;
  completedTaskIds: string[];
  isAdmin: boolean;
  handlePriorityUpdate: (id: string | number, priority: string) => void;
  handleStatusUpdate: (id: string | number, status: string) => void;
  handleProgressUpdate: (id: string | number, progress: number) => void;
  handleDueDateUpdate: (id: string | number, dueDate: string) => void;
  handleDelete: (id: string | number) => void;
  handleCreateDemand?: (task: Task) => void;
  creatingDemandId?: string | null;
  priorityMeanings: Record<string, string>;
  AnimatedCheckmark: React.FC<{ size?: number; className?: string; strokeWidth?: number }>;
  TaskComments: React.FC<{ taskId: string | number; isDarkMode: boolean }>;
  expandedTaskIds: string[];
  toggleTaskExpansion: (e: React.MouseEvent, taskId: string) => void;
  onSelectTask?: (taskId: string | number) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  idx,
  viewMode,
  isDarkMode,
  completedTaskIds,
  isAdmin,
  handlePriorityUpdate,
  handleStatusUpdate,
  handleProgressUpdate,
  handleDueDateUpdate,
  handleDelete,
  handleCreateDemand,
  creatingDemandId,
  priorityMeanings,
  AnimatedCheckmark,
  TaskComments,
  expandedTaskIds,
  toggleTaskExpansion,
  onSelectTask
}) => {
  const isCompleted = completedTaskIds.includes(task.id.toString()) || task.status === 'Concluída';
  const isExpanded = expandedTaskIds.includes(task.id.toString());

  const isOverdue = React.useMemo(() => {
    if (task.status === 'Concluída') return false;
    if (!task.due_date) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dueDate = null;
    if (task.due_date.includes('-')) {
      const [y, m, d_] = task.due_date.split('-').map(Number);
      dueDate = new Date(y, m - 1, d_);
    } else if (task.due_date.toLowerCase().includes('hoje')) {
      dueDate = new Date(today);
    } else {
      dueDate = new Date(task.due_date);
    }
    
    return dueDate ? dueDate < today : false;
  }, [task.due_date, task.status]);

  const isDueTodayOrTomorrow = React.useMemo(() => {
    if (task.status === 'Concluída') return false;
    if (!task.due_date) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dueDate = null;
    if (task.due_date.includes('-')) {
      const [y, m, d_] = task.due_date.split('-').map(Number);
      dueDate = new Date(y, m - 1, d_);
    } else if (task.due_date.toLowerCase().includes('hoje')) {
      dueDate = new Date(today);
    } else if (task.due_date.toLowerCase().includes('amanhã')) {
      dueDate = new Date(tomorrow);
    } else {
      dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
    }
    
    if (!dueDate) return false;
    return dueDate.getTime() === today.getTime() || dueDate.getTime() === tomorrow.getTime();
  }, [task.due_date, task.status]);

  // Dynamic color-coded priority badge configuration
  const getPriorityConfig = React.useCallback((priority?: string) => {
    const p = (priority || '').toLowerCase().trim();
    if (p.includes('urgente') || p.includes('urgent')) {
      return {
        label: 'Urgente',
        color: 'bg-rose-500',
        badge: 'text-rose-700 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-950/70 border-rose-300/80 dark:border-rose-800 shadow-xs',
        dot: 'bg-rose-500 animate-pulse',
        fillIcon: true,
      };
    }
    if (p.includes('alta') || p.includes('high')) {
      return {
        label: 'Alta',
        color: 'bg-orange-500',
        badge: 'text-orange-700 dark:text-orange-300 bg-orange-100/90 dark:bg-orange-950/70 border-orange-300/80 dark:border-orange-800 shadow-xs',
        dot: 'bg-orange-500',
        fillIcon: true,
      };
    }
    if (p.includes('méd') || p.includes('med') || p.includes('médio') || p.includes('medium')) {
      return {
        label: 'Média',
        color: 'bg-amber-500',
        badge: 'text-amber-700 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/70 border-amber-300/80 dark:border-amber-800 shadow-xs',
        dot: 'bg-amber-500',
        fillIcon: false,
      };
    }
    // Default: Baixa / Low
    return {
      label: priority || 'Baixa',
      color: 'bg-blue-500',
      badge: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900/70',
      dot: 'bg-blue-500',
      fillIcon: false,
    };
  }, []);

  const priorityConfig = getPriorityConfig(task.priority);
  const priorityColor = priorityConfig.color;
  const priorityBadgeStyle = priorityConfig.badge;

  const statusBadgeStyle = 
    task.status === 'Concluída' ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/50' :
    task.status === 'Revisão' ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-900/50' :
    task.status === 'Em Andamento' ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-900/50' :
    'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
      onClick={(e) => {
        toggleTaskExpansion(e, task.id.toString());
        onSelectTask?.(task.id);
      }}
      className={`group relative flex flex-col rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${
        isDarkMode 
          ? 'bg-slate-900/90 hover:bg-slate-900 border-slate-800 hover:border-slate-700' 
          : 'bg-white hover:bg-slate-50/50 border-slate-200/90 hover:border-slate-300'
      } ${
        isExpanded 
          ? 'ring-2 ring-blue-500/30 border-blue-500/40 shadow-md' 
          : 'shadow-xs hover:shadow-sm'
      } ${
        viewMode === 'list' ? 'md:grid md:grid-cols-12 md:items-center' : ''
      }`}
    >
      {/* Subtle Priority Accent Line on left edge */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${priorityColor} transition-colors`} />

      {/* Completion feedback overlay */}
      <CompletionFeedback isVisible={isCompleted} />

      {/* Main Card Content */}
      <div className={`p-3.5 sm:p-4 pl-4 sm:pl-5 flex flex-col gap-2.5 flex-1 min-w-0 ${
        viewMode === 'list' ? 'md:col-span-12 md:grid md:grid-cols-12 md:items-center md:gap-4 md:py-3' : ''
      }`}>
        {/* Header / Title block */}
        <div className={`min-w-0 flex-1 ${viewMode === 'list' ? 'md:col-span-5' : ''}`}>
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-xs sm:text-sm tracking-tight truncate flex items-center gap-2 ${
              task.status === 'Concluída' 
                ? 'line-through text-slate-400 dark:text-slate-500' 
                : 'text-slate-900 dark:text-slate-100'
            }`}>
              <span className="truncate">{task.title}</span>
              {task.status === 'Concluída' && (
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
              )}
            </h3>
          </div>

          {/* Metadata line with typographic separators */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {/* Assignees */}
            {Array.isArray(task.assignees) && task.assignees.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {task.assignees.slice(0, 3).map((assignee: Assignee, i: number) => (
                    <div 
                      key={`${task.id}-assignee-${i}`}
                      title={assignee.name}
                      className="relative size-4.5 rounded-full bg-blue-600 border border-white dark:border-slate-900 flex items-center justify-center text-[7px] font-bold text-white shadow-xs overflow-hidden"
                    >
                      {assignee.avatarUrl ? (
                        <Image src={assignee.avatarUrl} alt={assignee.name || 'User'} fill sizes="18px" className="object-cover" />
                      ) : (
                        String(assignee.name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                  ))}
                  {task.assignees.length > 3 && (
                    <div className="size-4.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-white dark:border-slate-900 flex items-center justify-center text-[7px] font-bold text-slate-600 dark:text-slate-400">
                      +{task.assignees.length - 3}
                    </div>
                  )}
                </div>
                <span className="truncate max-w-[110px] text-slate-700 dark:text-slate-300 font-medium">
                  {task.assignees.map((a: Assignee) => a.name?.split(' ')[0]).join(', ')}
                </span>
                <span className="opacity-40">·</span>
              </div>
            )}

            {/* Category */}
            {task.category && (
              <>
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  {task.category}
                </span>
                <span className="opacity-40">·</span>
              </>
            )}

            {/* Task Type Tags */}
            {task.task_type === 'Estoque' && (
              <>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                  <Package size={10} />
                  Estoque
                </span>
                <span className="opacity-40">·</span>
              </>
            )}
            {task.task_type === 'Transferência' && (
              <>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                  <Send size={10} />
                  Transferência
                </span>
                <span className="opacity-40">·</span>
              </>
            )}

            {/* Distance Proximity Badge */}
            {task.distanceFormatted && (
              <>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded-full border border-blue-200/50 dark:border-blue-900/50">
                  <Navigation size={9} className="text-blue-500 fill-blue-500" />
                  <span>{task.distanceFormatted} de você</span>
                </span>
                <span className="opacity-40">·</span>
              </>
            )}

            {/* Location GPS action */}
            {(task.location || task.destination_address || (task.destination_lat && task.destination_lng)) && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openInNativeGPS(
                      task.destination_lat,
                      task.destination_lng,
                      'google',
                      task.destination_address || task.location
                    );
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  title="Abrir rota no GPS (Google Maps)"
                >
                  <MapPin size={10} className="text-emerald-500" />
                  <span className="truncate max-w-[120px]">{task.location || task.destination_address}</span>
                  <Navigation size={9} className="opacity-70" />
                </button>
                <span className="opacity-40">·</span>
              </>
            )}

            {/* Overdue / Due soon status */}
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                <AlertCircle size={10} />
                Atrasada
              </span>
            )}
            {task.isDueSoon && !isOverdue && task.status !== 'Concluída' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                <Clock size={10} />
                Prazo próximo
              </span>
            )}
          </div>
        </div>

        {/* Due Date Column in list view or compact */}
        <div className={`flex items-center gap-1.5 text-[11px] tabular-nums font-medium ${
          isOverdue 
            ? 'text-rose-600 dark:text-rose-400' 
            : isDueTodayOrTomorrow 
            ? 'text-amber-600 dark:text-amber-400' 
            : 'text-slate-500 dark:text-slate-400'
        } ${viewMode === 'list' ? 'md:col-span-2' : ''}`}>
          <Calendar size={12} className="shrink-0 opacity-70" />
          <span>{task.due || task.due_date || 'Sem data'}</span>
        </div>

        {/* Progress Column */}
        <div className={`space-y-1 ${viewMode === 'list' ? 'md:col-span-2' : ''}`}>
          <div className="flex justify-between items-center text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
            <span className="uppercase tracking-wider text-[9px]">Progresso</span>
            <span className={`font-semibold ${
              task.progress === 100 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-slate-700 dark:text-slate-300'
            }`}>
              {task.progress}%
            </span>
          </div>
          <ProgressBar 
            progress={task.progress || 0}
            onUpdate={(val) => handleProgressUpdate(task.id, val)}
            isDarkMode={isDarkMode}
            className="w-full h-1 rounded-full"
          />
        </div>

        {/* Priority & Status Badges + Quick Actions */}
        <div className={`flex items-center justify-between gap-2 pt-1 md:pt-0 ${
          viewMode === 'list' ? 'md:col-span-3 md:justify-end' : ''
        }`}>
          {/* Priority Badge */}
          <div className="relative group/priority" onClick={(e) => e.stopPropagation()}>
            <div 
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-tight uppercase cursor-pointer transition-all duration-150 hover:scale-105 ${priorityBadgeStyle}`}
              title={priorityMeanings?.[task.priority] || `Prioridade ${task.priority || 'Baixa'}`}
            >
              <span className={`size-1.5 rounded-full shrink-0 ${priorityConfig.dot}`} />
              <Flag size={10} fill={priorityConfig.fillIcon ? 'currentColor' : 'none'} className="shrink-0" />
              <select
                value={task.priority || 'Baixa'}
                onChange={(e) => handlePriorityUpdate(task.id, e.target.value)}
                className="bg-transparent border-none outline-none appearance-none cursor-pointer pr-0.5 text-[10px] font-bold text-current"
              >
                <option value="Baixa" className="text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100">Baixa</option>
                <option value="Média" className="text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100">Média</option>
                <option value="Alta" className="text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100">Alta</option>
                <option value="Urgente" className="text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100">Urgente</option>
              </select>
            </div>
          </div>

          {/* Status Badge */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <select
              value={task.status || 'Pendente'}
              onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
              className={`px-2 py-0.5 rounded-md border text-[10px] font-medium cursor-pointer transition-colors outline-none appearance-none ${statusBadgeStyle}`}
            >
              <option value="Pendente" className="text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100">Pendente</option>
              <option value="Em Andamento" className="text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100">Em Andamento</option>
              <option value="Revisão" className="text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100">Revisão</option>
              <option value="Concluída" className="text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100">Concluída</option>
            </select>
          </div>

          {/* Quick Action Icons */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {task.task_type === 'Estoque' && handleCreateDemand && (
              <button 
                onClick={() => handleCreateDemand(task)}
                disabled={creatingDemandId === task.id}
                className={`p-1.5 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors ${creatingDemandId === task.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Criar Demanda de Estoque"
              >
                <Package size={13} />
              </button>
            )}

            <button 
              onClick={() => handleStatusUpdate(task.id, task.status === 'Concluída' ? 'Pendente' : 'Concluída')}
              className={`p-1.5 rounded-md transition-colors ${
                task.status === 'Concluída' 
                  ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' 
                  : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={task.status === 'Concluída' ? 'Marcar como Pendente' : 'Concluir Tarefa'}
            >
              <CheckCircle2 size={13} />
            </button>

            {isAdmin && (
              <>
                <Link 
                  href={`/tasks/edit/${task.id}`}
                  className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Editar Tarefa"
                >
                  <Edit2 size={13} />
                </Link>
                <button 
                  onClick={() => handleDelete(task.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Excluir Tarefa"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}

            <button 
              onClick={(e) => toggleTaskExpansion(e, task.id.toString())}
              className={`p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              title={isExpanded ? 'Recolher' : 'Expandir'}
            >
              <ChevronDown size={13} />
            </button>
          </div>
        </div>

        {/* Expandable Details Drawer */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-slate-100 dark:border-slate-800 mt-2 pt-3 w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {task.description && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Descrição</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {task.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Status selector */}
                <div>
                  <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1">Status</label>
                  <select 
                    value={task.status || 'Pendente'}
                    onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                    className="w-full text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Revisão">Revisão</option>
                    <option value="Concluída">Concluída</option>
                  </select>
                </div>

                {/* Priority selector */}
                <div>
                  <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1">Prioridade</label>
                  <select 
                    value={task.priority || 'Média'}
                    onChange={(e) => handlePriorityUpdate(task.id, e.target.value)}
                    className="w-full text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>

                {/* Due Date Picker */}
                <div>
                  <label className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1">Data de Entrega</label>
                  <input 
                    type="date"
                    min={new Date().toLocaleDateString('en-CA')}
                    value={(task.due_date && task.due_date.includes('-') ? task.due_date : '') || ''}
                    onChange={(e) => handleDueDateUpdate(task.id, e.target.value)}
                    className="w-full text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 tabular-nums"
                  />
                </div>
              </div>

              {/* Progress Slider */}
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Ajustar Progresso</span>
                  <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">{task.progress}%</span>
                </div>
                <ProgressBar 
                  progress={task.progress || 0}
                  onUpdate={(val) => handleProgressUpdate(task.id, val)}
                  isDarkMode={isDarkMode}
                  className="w-full h-2 rounded-full cursor-pointer"
                />
              </div>

              {/* Assignees detail */}
              {Array.isArray(task.assignees) && task.assignees.length > 0 && (
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1.5">Responsáveis</span>
                  <div className="flex flex-wrap gap-1.5">
                    {task.assignees.map((assignee: Assignee, i: number) => (
                      <div 
                        key={`${task.id}-assignee-detail-${i}`}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300"
                      >
                        <div className="relative size-4 rounded-full bg-blue-600 flex items-center justify-center text-[8px] text-white overflow-hidden">
                          {assignee.avatarUrl ? (
                            <Image src={assignee.avatarUrl} alt={assignee.name || 'User'} fill sizes="16px" className="object-cover" />
                          ) : (
                            String(assignee.name || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        {assignee.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock Demand Action */}
              {task.task_type === 'Estoque' && handleCreateDemand && (
                <div className="mt-3">
                  <button
                    onClick={() => handleCreateDemand(task)}
                    disabled={creatingDemandId === task.id}
                    className={`w-full px-3 py-2 rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      isDarkMode 
                        ? 'bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/20' 
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100'
                    } ${creatingDemandId === task.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Package size={13} />
                    {creatingDemandId === task.id ? 'Criando Demanda...' : 'Criar Demanda de Estoque'}
                  </button>
                </div>
              )}

              {/* Comments section */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <TaskComments taskId={task.id} isDarkMode={isDarkMode} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
