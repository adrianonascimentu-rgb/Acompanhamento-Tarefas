'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Calendar, CheckCircle2, User, Clock, Filter, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { LoginForm } from '@/components/auth/LoginForm';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TaskHistoryPage() {
  const { isAdmin, user, isAuthenticated, isLoading: roleLoading, login } = useRole();
  const { isDarkMode } = useTheme();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchHistory() {
      if (!user?.id) return;
      try {
        let userTaskIds: string[] = [];
        if (!isAdmin) {
          const { data: userAssignments } = await supabase
            .from('task_assignees')
            .select('task_id')
            .eq('profile_id', user.id);
          userTaskIds = (userAssignments || []).map((a: any) => a.task_id);
        }

        let query = supabase
          .from('tasks')
          .select(`
            *,
            profiles!collaborator_id (
              id,
              name
            ),
            task_assignees (
              profile_id,
              profiles!profile_id (
                id,
                name
              )
            )
          `)
          .eq('status', 'Concluída')
          .order('created_at', { ascending: false });

        if (!isAdmin) {
          if (userTaskIds.length > 0) {
            query = query.or(`collaborator_id.eq.${user.id},created_by.eq.${user.id},id.in.(${userTaskIds.join(',')})`);
          } else {
            query = query.or(`collaborator_id.eq.${user.id},created_by.eq.${user.id}`);
          }
        }

        let { data, error } = await query;

        if (error) {
          const isColumnMissing = error.message?.includes("column tasks.created_by does not exist") || 
                                 error.message?.includes("Could not find the 'created_by' column");
          
          if (isColumnMissing) {
            let retryQuery = supabase
              .from('tasks')
              .select(`
                id, title, description, due_date, priority, progress, status, collaborator_id, created_at,
                profiles!collaborator_id (
                  id,
                  name
                )
              `)
              .eq('status', 'Concluída')
              .order('created_at', { ascending: false });

            if (!isAdmin) {
              if (userTaskIds.length > 0) {
                retryQuery = retryQuery.or(`collaborator_id.eq.${user.id},id.in.(${userTaskIds.join(',')})`);
              } else {
                retryQuery = retryQuery.eq('collaborator_id', user.id);
              }
            }

            const { data: retryData, error: retryError } = await retryQuery;
            if (retryError) throw retryError;
            data = retryData;
          } else {
            throw error;
          }
        }

        let finalTasks = data || [];
        if (!isAdmin) {
          finalTasks = finalTasks.filter((t: any) => 
            t.collaborator_id === user.id ||
            t.created_by === user.id ||
            (t.task_assignees && t.task_assignees.some((ta: any) => ta.profile_id === user.id))
          );
        }

        setTasks(finalTasks);
      } catch (err) {
        console.error('Error fetching task history:', err);
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated, isAdmin, user?.id]);

  if (roleLoading || (loading && isAuthenticated)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const filteredTasks = safeTasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.profiles?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: safeTasks.length,
    thisMonth: safeTasks.filter(t => {
      const date = new Date(t.created_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length
  };

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`sticky top-0 z-10 backdrop-blur-md border-b transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center p-4 justify-between w-full">
          <Link href="/tasks" className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">
            {isAdmin ? 'Histórico Geral de Tarefas' : 'Meu Histórico de Tarefas'}
          </h2>
          <div className="size-10" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="p-4 space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-2 text-emerald-500 mb-1">
                <CheckCircle2 size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {isAdmin ? 'Total Concluído (Geral)' : 'Minhas Concluídas'}
                </span>
              </div>
              <p className="text-2xl font-black">{stats.total}</p>
            </div>
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-2 text-blue-500 mb-1">
                <BarChart3 size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {isAdmin ? 'Concluídas Este Mês (Geral)' : 'Minhas Este Mês'}
                </span>
              </div>
              <p className="text-2xl font-black">{stats.thisMonth}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar no histórico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-12 pl-10 pr-4 rounded-xl border outline-none transition-all ${
                isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-blue-600' : 'bg-white border-slate-200 focus:border-blue-600'
              }`}
            />
          </div>

          {/* History List */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold uppercase tracking-widest px-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Tarefas Finalizadas
            </h3>
            
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task, idx) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-4 rounded-2xl border transition-all ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sm flex-1 pr-4">{task.title}</h4>
                    <div className="flex items-center gap-1 text-emerald-500">
                      <CheckCircle2 size={14} />
                      <span className="text-[10px] font-bold uppercase">Concluída</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                    {task.description || 'Sem descrição adicional.'}
                  </p>

                  <div className={`flex items-center justify-between pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <User size={12} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {task.profiles?.name || 'Sistema'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold">
                        {format(new Date(task.created_at), "dd 'de' MMM", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500">
                <p className="text-sm">Nenhuma tarefa concluída encontrada.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
