import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { useRole } from '@/hooks/useRole';
import { differenceInHours, isPast, parseISO } from 'date-fns';

export function useDeadlineChecker() {
  const { user, isAuthenticated } = useRole();
  const { createNotification } = useNotifications();
  const [error, setError] = useState<string | null>(null);
  const [isRecursionError, setIsRecursionError] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Check if Supabase is configured
    const isConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';
      
    if (!isConfigured) return;

    const processTasks = async (tasks: any[]) => {
      const now = new Date();

      for (const task of tasks) {
        if (!task.due_date) continue;

        // Get all unique assignee IDs
        const assigneeIds = new Set<string>();
        if (task.collaborator_id) assigneeIds.add(task.collaborator_id);
        if (task.task_assignees) {
          task.task_assignees.forEach((ta: any) => {
            if (ta.profile_id) assigneeIds.add(ta.profile_id);
          });
        }

        if (assigneeIds.size === 0) continue;

        // Handle different date formats (e.g., "15 Out", "Hoje", or ISO)
        let dueDate: Date;
        if (task.due_date === 'Hoje') {
          dueDate = new Date();
          dueDate.setHours(23, 59, 59);
        } else if (task.due_date.includes('-')) {
          dueDate = parseISO(task.due_date);
        } else {
          // For formats like "15 Out", we might need more complex parsing or just skip
          // For now, let's try to parse it or skip if invalid
          continue; 
        }
        
        // Check if overdue
        if (isPast(dueDate)) {
          for (const assigneeId of Array.from(assigneeIds)) {
            await createNotification(
              assigneeId,
              'Tarefa Atrasada!',
              `A tarefa "${task.title}" está atrasada. Por favor, verifique o status.`,
              'overdue',
              task.id,
              'overdue_alert'
            );
          }
        } 
        // Check if due soon with multiple thresholds
        else {
          const hoursLeft = differenceInHours(dueDate, now);
          
          // Define thresholds for reminders
          const thresholds = [
            { hours: 1, label: '1 hora', key: 'due_soon_1h' },
            { hours: 12, label: '12 horas', key: 'due_soon_12h' },
            { hours: 24, label: '24 horas', key: 'due_soon_24h' },
            { hours: 48, label: '48 horas', key: 'due_soon_48h' }
          ];

          // Find the most urgent threshold that applies
          const activeThreshold = thresholds.find(t => hoursLeft <= t.hours && hoursLeft > 0);

          if (activeThreshold) {
            for (const assigneeId of Array.from(assigneeIds)) {
              await createNotification(
                assigneeId,
                'Prazo Próximo!',
                `A tarefa "${task.title}" vence em aproximadamente ${activeThreshold.label}.`,
                'due_soon',
                task.id,
                activeThreshold.key
              );
            }
          }
        }
      }
    };

    const checkDeadlines = async () => {
      // Check if online
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('Sem conexão com a internet.');
        return;
      }

      try {
        // 1. Fetch all pending/in-progress tasks with their assignees
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id, title, due_date, status, collaborator_id, task_assignees(profile_id)')
          .neq('status', 'Concluída');

        if (tasksError) {
          // Check for recursion error
          if (tasksError.message?.includes('infinite recursion')) {
            setIsRecursionError(true);
            setError('Erro de recursão infinita detectado nas políticas do Supabase.');
            return;
          }

          // Handle "Failed to fetch" (network error)
          if (tasksError.message?.includes('Failed to fetch') || tasksError.code === 'FETCH_ERROR') {
            setError('Erro de conexão com o Supabase. Verifique sua rede.');
            return;
          }

          // If task_assignees table doesn't exist or relationship is not found, fallback to just collaborator_id
          const isMissingRelation = 
            tasksError.code === '42P01' || 
            tasksError.message?.includes('relation "task_assignees" does not exist') ||
            tasksError.message?.includes('Could not find a relationship');

          if (isMissingRelation) {
            const { data: fallbackTasks, error: fallbackError } = await supabase
              .from('tasks')
              .select('id, title, due_date, status, collaborator_id')
              .neq('status', 'Concluída');
            
            if (fallbackError) throw fallbackError;
            processTasks(fallbackTasks || []);
            return;
          }
          throw tasksError;
        }
        
        processTasks(tasks || []);
        setError(null);
        setIsRecursionError(false);
      } catch (error: any) {
        const msg = error?.message || String(error);
        
        // Don't log "Failed to fetch" as a scary error if it's just a network issue
        if (msg.includes('Failed to fetch')) {
          setError('Erro de conexão. Tentando novamente em breve...');
          return;
        }

        console.error('Error checking task deadlines:', msg);
        setError(msg);
        
        if (msg.includes('infinite recursion')) {
          setIsRecursionError(true);
        }
      }
    };

    // Run check once on load
    checkDeadlines();

    // Optionally run periodically (e.g., every hour)
    const interval = setInterval(checkDeadlines, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, user?.id, createNotification]);

  return { error, isRecursionError };
}
