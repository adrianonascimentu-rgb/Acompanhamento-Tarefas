'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, MoreVertical, MapPin, Mail, Phone, Star, Calendar, Palette, Wand2, CheckSquare, Users, Folder, User as UserIcon, ChevronRight, ShieldCheck, Edit2, Trash2, CheckCircle2, Target, Plus, X, Camera, ChevronDown, Clock, Activity, ArrowUp, Check, Share2, TrendingUp, Award, Zap, Briefcase, ClipboardList, UserX, UserCheck, AlertOctagon, LogOut } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ProgressBar } from '@/components/tasks/ProgressBar';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { useUI } from '@/hooks/useUI';
import { isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks, startOfYear, endOfYear, isSameDay, addDays, startOfDay } from 'date-fns';
import { DateFilterSelect } from '@/components/DateFilterSelect';
import { getInactiveCollaboratorIds, saveCollaboratorStatusLocal } from '@/lib/collaboratorStatus';

export const dynamic = 'force-dynamic';

const PREDEFINED_SKILLS = [
  'Vendedor',
  'Estoquista',
  'Entregas',
  'Aux. Administrativo',
  'Caixa',
  'Gerência',
  'Administração'
];

const AnimatedCheckmark = ({ size = 64, className = "", strokeWidth = 3 }: { size?: number, className?: string, strokeWidth?: number }) => {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="initial"
      animate="animate"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        variants={{
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 }
        }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
      <motion.path
        d="m9 12 2 2 4-4"
        variants={{
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 }
        }}
        transition={{ duration: 0.3, delay: 0.4, ease: "easeInOut" }}
      />
    </motion.svg>
  );
};

const ConfettiParticle = ({ color }: { color: string }) => {
  const [randomValues, setRandomValues] = React.useState<{
    x: string;
    y: string;
    delay: number;
    rotate: number;
  } | null>(null);

  React.useEffect(() => {
    setRandomValues({
      x: `${50 + (Math.random() - 0.5) * 150}%`,
      y: `${50 + (Math.random() - 0.5) * 150}%`,
      delay: Math.random() * 0.3,
      rotate: Math.random() * 360
    });
  }, []);

  if (!randomValues) return null;

  return (
    <motion.div
      initial={{ 
        x: "50%", 
        y: "50%", 
        scale: 0,
        opacity: 1 
      }}
      animate={{ 
        x: randomValues.x, 
        y: randomValues.y, 
        scale: [0, 1, 0.5],
        opacity: [1, 1, 0],
        rotate: randomValues.rotate
      }}
      transition={{ 
        duration: 1.2, 
        ease: "easeOut",
        delay: randomValues.delay 
      }}
      className="absolute size-1.5 rounded-sm"
      style={{ backgroundColor: color }}
    />
  );
};

const Confetti = ({ color = "#10b981" }) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[...Array(16)].map((_, i) => (
        <ConfettiParticle key={i} color={color} />
      ))}
    </div>
  );
};

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { isAdmin, role, user: loggedInUser, login, logout } = useRole();
  const { isDarkMode } = useTheme();
  const { showToast, showConfirm } = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const toggleNotifications = async () => {
    try {
      const newStatus = !user.notifications_enabled;
      const { error } = await supabase
        .from('profiles')
        .update({ notifications_enabled: newStatus })
        .eq('id', id);
        
      if (error) throw error;
      setUser((prev: any) => ({ ...prev, notifications_enabled: newStatus }));
    } catch (error) {
      console.error('Error toggling notifications:', error);
      alert('Erro ao atualizar preferências de notificação.');
    }
  };
  const [showSkillSuccess, setShowSkillSuccess] = useState(false);
  const [skillMessage, setSkillMessage] = useState('');
  const [dateFilter, setDateFilter] = useState('Todas as Datas');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCompleteTask = async (taskId: string) => {
    // Update status to 'Concluída' in Supabase
    let { error } = await supabase
      .from('tasks')
      .update({ status: 'Concluída', progress: 100, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error && error.message?.includes('updated_at')) {
      const { error: retryError } = await supabase
        .from('tasks')
        .update({ status: 'Concluída', progress: 100 })
        .eq('id', taskId);
      error = retryError;
    }

    if (!error) {
      setCompletedTaskIds(prev => [...prev, taskId]);
      // Update local state
      setUser((prev: any) => ({
        ...prev,
        activeTasks: prev.activeTasks.map((t: any) => t.id === taskId ? { ...t, status: 'Concluída', progress: 100 } : t),
        stats_completed: prev.stats_completed + 1,
        stats_active: prev.stats_active - 1
      }));
      setTimeout(() => {
        setCompletedTaskIds(prev => prev.filter(id => id !== taskId));
      }, 3000);
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      setShowBackToTop(scrollRef.current.scrollTop > 300);
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const fetchUserProfile = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        console.error('Invalid collaborator ID format:', id);
        if (!silent) setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (profileError) {
        console.error('Profile fetch error:', profileError.message, profileError.details);
        throw profileError;
      }

      let tasksData: any[] = [];
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, description, due_date, priority, progress, status, collaborator_id, created_at, task_assignees(profile_id)')
        .or(`collaborator_id.eq.${id},task_assignees.profile_id.eq.${id}`);
      
      if (tasksError) {
        console.warn('Tasks fetch error (falling back):', tasksError.message);
        // Fallback to simple query if complex .or fails or column missing
        const { data: simpleTasks, error: simpleError } = await supabase
          .from('tasks')
          .select('id, title, description, due_date, priority, progress, status, collaborator_id, created_at')
          .eq('collaborator_id', id);
        
        if (simpleError) throw simpleError;
        tasksData = simpleTasks || [];
      } else {
        tasksData = tasks || [];
      }

      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select('*')
        .eq('collaborator_id', id);
      
      if (reviewsError) throw reviewsError;

      const { data: skills, error: skillsError } = await supabase
        .from('profile_skills')
        .select('id, skill')
        .eq('profile_id', id);
      
      if (skillsError) throw skillsError;

      const completedTasks = tasksData.filter(t => t.status === 'Concluída');
      const activeTasks = tasksData.filter(t => t.status !== 'Concluída');
      
      const today = startOfDay(new Date());
      
      const overdueTasks = tasksData.filter(t => {
        if (t.status === 'Concluída') return false;
        if (!t.due_date) return false;
        
        let taskDate;
        if (t.due_date.includes('-')) {
          const [y, m, d] = t.due_date.split('-').map(Number);
          taskDate = new Date(y, m - 1, d);
        } else if (t.due_date === 'Hoje') {
          taskDate = today;
        } else {
          // Handle other formats if necessary, or assume on time
          return false;
        }
        return startOfDay(taskDate) < today;
      });

      const onTimeCount = tasksData.length - overdueTasks.length;
      
      const totalRating = reviews?.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) || 0;
      const avgRating = reviews?.length ? (totalRating / reviews.length).toFixed(1) : '0.0';

      const isInactive = getInactiveCollaboratorIds().includes(id as string) || profile.status === 'Inativo';

      setUser({
        ...profile,
        status: isInactive ? 'Inativo' : 'Ativo',
        activeTasks: tasksData,
        reviews: reviews || [],
        skills: skills || [],
        stats_completed: completedTasks.length,
        stats_active: activeTasks.length,
        stats_on_time: onTimeCount,
        stats_overdue: overdueTasks.length,
        avgRating,
        totalTasks: tasksData.length
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error?.message || error);
      showToast('Erro ao carregar dados do colaborador.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    if (user?.name) {
      document.title = `Perfil de ${user.name} | Gestão de Tarefas Pro`;
    } else {
      document.title = 'Perfil do Colaborador | Gestão de Tarefas Pro';
    }
  }, [user?.name]);

  useEffect(() => {
    if (id) {
      fetchUserProfile();
    }

    // Real-time subscription
    const tables = ['profiles', 'tasks', 'reviews', 'profile_skills', 'task_assignees'];
    
    const channel = supabase
      .channel('collaborator-profile-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        console.log('Real-time update: profiles', payload);
        fetchUserProfile(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        console.log('Real-time update: tasks', payload);
        fetchUserProfile(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, (payload) => {
        console.log('Real-time update: reviews', payload);
        fetchUserProfile(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_skills' }, (payload) => {
        console.log('Real-time update: profile_skills', payload);
        fetchUserProfile(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, (payload) => {
        console.log('Real-time update: task_assignees', payload);
        fetchUserProfile(true);
      })
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, showToast, fetchUserProfile]);

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setUser((prev: any) => ({
        ...prev,
        activeTasks: prev.activeTasks.filter((t: any) => t.id !== taskId)
      }));
      setShowDeleteSuccess(true);
      setTimeout(() => setShowDeleteSuccess(false), 3000);
    } catch (error) {
      console.error('Error deleting task:', error);
      showToast('Erro ao excluir tarefa.', 'error');
    }
  };

  const handleProgressUpdate = async (taskId: string, newProgress: number) => {
    try {
      const isCompleted = newProgress === 100;
      const updates: any = { progress: newProgress };
      if (isCompleted) {
        updates.status = 'Concluída';
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      setUser((prev: any) => ({
        ...prev,
        activeTasks: prev.activeTasks.map((t: any) => 
          t.id === taskId ? { ...t, ...updates } : t
        )
      }));

      if (isCompleted) {
        setCompletedTaskIds(prev => [...prev, taskId]);
        setTimeout(() => {
          setCompletedTaskIds(prev => prev.filter(id => id !== taskId));
        }, 2000);
      }
    } catch (error) {
      console.error('Error updating task progress:', error);
    }
  };

  const handleAddSkill = async (skillName?: string) => {
    const skillToAdd = skillName || newSkill.trim();
    if (!skillToAdd) return;
    
    // Check if user already has this skill
    if (user.skills.some((s: any) => s?.skill?.toLowerCase() === skillToAdd.toLowerCase())) {
      setSkillMessage('Habilidade já cadastrada!');
      setShowSkillSuccess(true);
      setTimeout(() => setShowSkillSuccess(false), 3000);
      return;
    }

    setIsAddingSkill(true);
    try {
      const { data, error } = await supabase
        .from('profile_skills')
        .insert({ profile_id: id, skill: skillToAdd })
        .select()
        .single();

      if (error) throw error;

      setUser((prev: any) => ({
        ...prev,
        skills: [...(prev.skills || []), data]
      }));
      if (!skillName) setNewSkill('');
      setSkillMessage('Habilidade adicionada!');
      setShowSkillSuccess(true);
      setTimeout(() => setShowSkillSuccess(false), 3000);
    } catch (error) {
      console.error('Error adding skill:', error);
      alert('Erro ao adicionar habilidade.');
    } finally {
      setIsAddingSkill(false);
    }
  };

  const handleToggleModuleAccess = async (module: string) => {
    const field = `can_access_${module}`;
    const newStatus = !user[field];
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: newStatus })
        .eq('id', id);
        
      if (error) throw error;
      setUser((prev: any) => ({ ...prev, [field]: newStatus }));
    } catch (error) {
      console.error('Error toggling module access:', error);
      alert('Erro ao atualizar acesso ao módulo.');
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    try {
      const { error } = await supabase
        .from('profile_skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;

      setUser((prev: any) => ({
        ...prev,
        skills: prev.skills.filter((s: any) => s.id !== skillId)
      }));
      setSkillMessage('Habilidade excluída!');
      setShowSkillSuccess(true);
      setTimeout(() => setShowSkillSuccess(false), 3000);
    } catch (error) {
      console.error('Error deleting skill:', error);
      showToast('Erro ao excluir habilidade.', 'error');
    }
  };

  const handlePhotoClick = () => {
    if (loggedInUser?.id === id) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !loggedInUser?.id) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        // Update in Supabase
        const { error } = await supabase
          .from('profiles')
          .update({ image_url: base64 })
          .eq('id', loggedInUser.id);

        if (error) throw error;

        // Update local state for this page
        setUser((prev: any) => ({ ...prev, image_url: base64 }));

        // Update global auth state
        const updatedUser = { ...loggedInUser, image_url: base64 };
        login(loggedInUser.type || 'user', updatedUser);
        
        setSkillMessage('Foto atualizada com sucesso!');
        setShowSkillSuccess(true);
        setTimeout(() => setShowSkillSuccess(false), 3000);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Erro ao atualizar foto de perfil.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleShare = () => {
    if (!user) return;
    
    const shareData = {
      title: `Perfil de ${user.name}`,
      text: `Confira o perfil de ${user.name} no Gestão de Tarefas Pro.`,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData)
        .catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Error sharing', error);
          }
        });
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => showToast('Link copiado para a área de transferência!', 'success'))
        .catch((err) => {
          console.error('Could not copy text: ', err);
          showToast('Erro ao copiar link.', 'error');
        });
    }
  };

  const handleToggleStatus = () => {
    setShowStatusModal(true);
  };

  const confirmToggleStatus = async () => {
    setIsUpdatingStatus(true);
    const isCurrentlyInactive = user?.status === 'Inativo';
    const newStatus = isCurrentlyInactive ? 'Ativo' : 'Inativo';

    try {
      saveCollaboratorStatusLocal(id as string, newStatus);
      
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) {
        console.warn('Supabase status update warning (status column might be missing on remote DB):', error.message);
      }

      setUser((prev: any) => ({ ...prev, status: newStatus }));
      showToast(
        newStatus === 'Inativo' 
          ? `Colaborador ${user?.name || ''} foi inativado.` 
          : `Colaborador ${user?.name || ''} foi reativado com sucesso.`, 
        newStatus === 'Inativo' ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('Error toggling status:', error);
      showToast('Erro ao atualizar status do colaborador.', 'error');
    } finally {
      setIsUpdatingStatus(false);
      setShowStatusModal(false);
    }
  };

  const handleDeleteCollaborator = () => {
    showConfirm({
      title: 'Excluir Cadastro de Colaborador',
      message: `Tem certeza que deseja excluir o cadastro do colaborador "${user?.name || ''}"? Esta ação removerá o perfil do sistema.`,
      type: 'danger',
      confirmLabel: 'Excluir Cadastro',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          const apiRes = await fetch(`/api/collaborators?id=${id}`, {
            method: 'DELETE'
          });
          const apiJson = await apiRes.json();

          if (!apiRes.ok && apiJson.error) {
            const { error: sbError } = await supabase.from('profiles').delete().eq('id', id);
            if (sbError) {
              console.warn('Erro ao excluir no Supabase:', sbError.message);
              saveCollaboratorStatusLocal(id, 'Inativo');
              await supabase.from('profiles').update({ status: 'Inativo' }).eq('id', id);
            }
          }

          showToast('Cadastro do colaborador excluído com sucesso!', 'success');
          router.push('/collaborators');
        } catch (err) {
          console.error('Erro ao excluir colaborador:', err);
          showToast('Erro ao excluir colaborador.', 'error');
        }
      }
    });
  };

  if (loading) {
    return (
      <div className={`min-h-screen p-4 sm:p-8 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex items-center gap-6">
            <div className={`size-24 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className="space-y-3">
              <div className={`h-8 w-48 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div className={`h-4 w-32 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            </div>
          </div>
          
          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-40 rounded-3xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            ))}
          </div>

          {/* List Skeleton */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-20 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Security & Data Isolation: Non-admins cannot see other collaborators' tasks & progress
  if (!isAdmin && loggedInUser?.id && loggedInUser.id !== id) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="size-16 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mb-4">
          <AlertOctagon size={32} />
        </div>
        <h1 className="text-xl font-bold">Acesso Restrito</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md text-sm">
          As informações de tarefas e progresso são visíveis apenas para cada usuário. Apenas administradores podem visualizar o progresso de toda a equipe.
        </p>
        <Link 
          href={`/collaborators/${loggedInUser.id}`} 
          className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
        >
          Ver Meu Perfil
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
        <h1 className={`text-xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Colaborador não encontrado</h1>
        <Link href="/collaborators" className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
          Voltar para a Equipe
        </Link>
      </div>
    );
  }

  const filteredTasks = (user?.activeTasks || []).filter((task: any) => {
    if (dateFilter === 'Todas as Datas' || dateFilter === 'Todas') return true;

    if (!task.due_date || typeof task.due_date !== 'string') return false;
    const [y, m, d] = task.due_date.split('-').map(Number);
    const taskDate = new Date(y, m - 1, d);
    const today = startOfDay(new Date());

    if (dateFilter === 'Hoje') {
      return isSameDay(taskDate, today);
    } else if (dateFilter === 'Amanhã') {
      return isSameDay(taskDate, addDays(today, 1));
    } else if (dateFilter === 'Esta semana' || dateFilter === 'Esta Semana') {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const end = endOfWeek(today, { weekStartsOn: 1 });
      return isWithinInterval(taskDate, { start, end });
    } else if (dateFilter === 'Semana passada') {
      const start = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      const end = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      return isWithinInterval(taskDate, { start, end });
    } else if (dateFilter === 'Próxima semana' || dateFilter === 'Próxima Semana') {
      const start = startOfWeek(addDays(today, 7), { weekStartsOn: 1 });
      const end = endOfWeek(addDays(today, 7), { weekStartsOn: 1 });
      return isWithinInterval(taskDate, { start, end });
    } else if (dateFilter === 'Este mês') {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return isWithinInterval(taskDate, { start, end });
    } else if (dateFilter === 'Mês passado') {
      const start = startOfMonth(subMonths(today, 1));
      const end = endOfMonth(subMonths(today, 1));
      return isWithinInterval(taskDate, { start, end });
    } else if (dateFilter === 'Este ano') {
      const start = startOfYear(today);
      const end = endOfYear(today);
      return isWithinInterval(taskDate, { start, end });
    } else if (dateFilter === 'Atrasadas') {
      return taskDate < today && task.status !== 'Concluída';
    }
    return true;
  }) || [];

  return (
    <div className={`flex flex-col h-full transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Navigation */}
      <header className={`sticky top-0 z-10 flex items-center p-4 border-b justify-between transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <Link href="/" className="text-blue-600 flex size-10 shrink-0 items-center justify-center hover:bg-blue-50 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className={`text-lg font-bold leading-tight tracking-tight flex-1 text-center ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
          {user?.name ? `Perfil de ${user.name}` : 'Perfil do Colaborador'}
        </h2>
        <div className="flex items-center justify-end gap-2.5">
          <button 
            onClick={handleShare}
            className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isDarkMode ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-800' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'}`}
            title="Compartilhar Perfil"
          >
            <Share2 size={18} />
          </button>
          {isAdmin && (
            <>
              <Link href={`/collaborators/edit/${id}`}
                className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isDarkMode ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-800' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'}`}
                title="Editar Perfil"
              >
                <Edit2 size={18} />
              </Link>
              <button
                type="button"
                onClick={handleDeleteCollaborator}
                className="flex items-center justify-center p-2 rounded-lg transition-colors text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                title="Excluir Colaborador"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
          {loggedInUser?.id === id && (
            <button
              type="button"
              onClick={() => {
                showConfirm({
                  title: 'Sair do Aplicativo',
                  message: 'Tem certeza que deseja encerrar sua sessão e sair do aplicativo?',
                  type: 'danger',
                  confirmLabel: 'Sair',
                  cancelLabel: 'Cancelar',
                  onConfirm: async () => {
                    await logout();
                  }
                });
              }}
              title="Sair do Aplicativo"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors border border-rose-200/60 dark:border-rose-900/40 active:scale-95"
            >
              <LogOut size={16} />
              <span className="text-xs font-semibold">Sair</span>
            </button>
          )}
        </div>
      </header>

      <main ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence>
          {showBackToTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={scrollToTop}
              className="fixed bottom-24 right-6 p-3 bg-blue-600 text-white rounded-full shadow-xl z-50 hover:bg-blue-700 transition-all active:scale-95"
            >
              <ArrowUp size={24} />
            </motion.button>
          )}
        </AnimatePresence>
        {/* Profile Header */}
        <div className={`flex p-4 sm:p-6 mb-2 shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          <div className="flex w-full flex-col gap-4 items-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handlePhotoClick}
              className={`relative h-24 w-24 sm:h-32 sm:w-32 group overflow-hidden rounded-full ${loggedInUser?.id === id ? 'cursor-pointer' : ''}`}
            >
              <Image
                src={user.image_url || `https://picsum.photos/seed/${user.id}/200`}
                alt={user.name}
                fill
                className={`rounded-full object-cover border-4 shadow-lg ${isDarkMode ? 'border-slate-800' : 'border-blue-50'}`}
                referrerPolicy="no-referrer"
              />
              {loggedInUser?.id === id && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? (
                    <div className="size-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera size={24} className="text-white" />
                  )}
                </div>
              )}
              {loggedInUser?.id === id && (
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*"
                />
              )}
            </motion.div>
            <div className="flex flex-col items-center justify-center w-full px-2">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <p className={`text-xl sm:text-2xl font-bold leading-tight tracking-tight text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user.name}</p>
                <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  user.type === 'admin' 
                    ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-100 text-indigo-700') 
                    : user.type === 'vendedor'
                    ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                    : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                }`}>
                  {user.type === 'admin' ? <ShieldCheck size={10} /> : 
                   user.type === 'vendedor' ? <Target size={10} /> : <Users size={10} />}
                  {user.type === 'admin' ? 'Admin' : 
                   user.type === 'vendedor' ? 'Vendedor' : 'Colaborador'}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  user.status === 'Inativo'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  <span className={`size-1.5 rounded-full ${user.status === 'Inativo' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                  {user.status === 'Inativo' ? 'Inativo (Desligado)' : 'Ativo'}
                </span>
              </div>

              {user.status === 'Inativo' && (
                <div className="mt-3 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 max-w-md text-center">
                  <AlertOctagon size={16} className="shrink-0 text-rose-500" />
                  <span>Este colaborador está inativo e desligado da empresa.</span>
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-1 mt-2">
                {(user.type === 'admin' || user.can_access_leads) && (
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">Módulo Leads</span>
                )}
                {(user.type === 'admin' || user.can_access_deliveries) && (
                  <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">Módulo Entregas</span>
                )}
                {(user.type === 'admin' || user.can_access_transfers) && (
                  <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">Módulo Transferências</span>
                )}
                {(user.type === 'admin' || user.can_access_warranties) && (
                  <span className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider">Módulo Garantias</span>
                )}
                {(user.type === 'admin' || user.can_access_reports) && (
                  <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">Módulo Relatórios</span>
                )}
                {(user.type === 'admin' || user.can_access_whatsapp) && (
                  <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">Módulo WhatsApp</span>
                )}
              </div>
              <p className="text-blue-600 font-semibold text-sm sm:text-base text-center mt-2">{user.role}</p>
              <div className={`flex items-center gap-1 mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <MapPin size={14} />
                <p className="text-xs sm:text-sm font-normal text-center">{user.location}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-2">
              <button 
                onClick={() => alert('Abrindo conversa com ' + user.name)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-blue-600/20"
              >
                Mensagem
              </button>
              <button 
                onClick={handleShare}
                className={`font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95 shadow-lg ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 shadow-slate-800/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-slate-100/20'
                }`}
              >
                Compartilhar
              </button>
              {loggedInUser?.id === id && (
                <button 
                  onClick={toggleNotifications}
                  className={`col-span-2 font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95 shadow-lg ${
                    user.notifications_enabled 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' 
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700 shadow-slate-200/20'
                  }`}
                >
                  {user.notifications_enabled ? 'Notificações Ativas' : 'Notificações Inativas'}
                </button>
              )}
              {loggedInUser?.id === id && (
                <button 
                  type="button"
                  onClick={() => {
                    showConfirm({
                      title: 'Sair do Aplicativo',
                      message: 'Tem certeza que deseja sair da sua conta?',
                      type: 'danger',
                      confirmLabel: 'Sair',
                      cancelLabel: 'Cancelar',
                      onConfirm: async () => {
                        await logout();
                      }
                    });
                  }}
                  className="col-span-2 font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95 shadow-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={16} />
                  Sair do Aplicativo
                </button>
              )}
              {(isAdmin || role === 'gerente' || role === 'supervisor' || true) && (
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className={`col-span-2 font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 ${
                    user.status === 'Inativo'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  }`}
                >
                  {user.status === 'Inativo' ? (
                    <>
                      <UserCheck size={16} />
                      Reativar Colaborador na Empresa
                    </>
                  ) : (
                    <>
                      <UserX size={16} />
                      Inativar Colaborador (Desligado da Empresa)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className={`px-4 py-6 mb-2 shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Estatísticas de Desempenho</h3>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              Atualizado em tempo real
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Category: Produtividade */}
            <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Produtividade</h4>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Volume de Trabalho</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                      <CheckCircle2 size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">Concluídas</span>
                  </div>
                  <span className="text-xl font-black text-emerald-600">{user.stats_completed || 0}</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <ClipboardList size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">Total</span>
                  </div>
                  <span className="text-xl font-black text-blue-600">{user.totalTasks || 0}</span>
                </div>
              </div>
            </div>

            {/* Category: Qualidade */}
            <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Award size={20} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Qualidade</h4>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Eficiência e Prazo</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                      <Clock size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">No Prazo</span>
                  </div>
                  <span className="text-xl font-black text-amber-600">{user.stats_on_time || 0}</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600">
                      <Star size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">Avaliação</span>
                  </div>
                  <span className="text-xl font-black text-yellow-600">{user.avgRating || '0.0'}</span>
                </div>
              </div>
            </div>

            {/* Category: Engajamento */}
            <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                  <Zap size={20} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Engajamento</h4>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Atividade e Foco</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                      <Target size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">Ativas</span>
                  </div>
                  <span className="text-xl font-black text-purple-600">{user.stats_active || 0}</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                      <Briefcase size={18} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">Skills</span>
                  </div>
                  <span className="text-xl font-black text-indigo-600">{user.skills?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Tasks Section */}
        <div className={`px-4 py-6 mb-2 shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Tarefas Ativas</h3>
            <div className="relative shrink-0 w-full sm:w-40">
              <DateFilterSelect
                value={dateFilter}
                onChange={setDateFilter}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>
          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <div className={`text-center py-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <CheckSquare size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Nenhuma tarefa encontrada.</p>
              </div>
            ) : (
              filteredTasks.map((task: any, idx: number) => (
              <motion.div 
                key={task.id || `task-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => toggleTaskExpansion(task.id)}
                className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all group cursor-pointer ${
                  isDarkMode 
                    ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' 
                    : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-md'
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 relative">
                  {completedTaskIds.includes(task.id.toString()) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 2 }}
                      className="absolute inset-0 z-50 flex items-center justify-center bg-emerald-500/10 backdrop-blur-[1px] rounded-xl pointer-events-none"
                    >
                      <div className="relative">
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ duration: 0.5, type: 'spring', bounce: 0.5 }}
                        >
                          <AnimatedCheckmark size={64} className="text-emerald-500 drop-shadow-md" />
                        </motion.div>
                        <Confetti />
                      </div>
                    </motion.div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/20">
                      {idx % 2 === 0 ? <Palette size={20} /> : <Wand2 size={20} />}
                    </div>
                    <div>
                      <p className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          task.priority === 'Alta' 
                            ? (isDarkMode ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-100 text-rose-600') 
                            : (isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600')
                        }`}>
                          {task.priority}
                        </span>
                        <span className={`text-[10px] sm:text-[11px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>• {task.due_date}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center sm:flex-col sm:items-end gap-2 sm:gap-1 px-3 py-1.5 rounded-xl border ${
                    task.due_date === 'Hoje' 
                      ? (isDarkMode ? 'bg-rose-900/30 text-rose-400 border-rose-800' : 'bg-rose-50 text-rose-600 border-rose-100') 
                      : (isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-transparent')
                  }`}>
                    <Calendar size={14} />
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight">{task.due_date}</span>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteTask(task.id);
                      }}
                      className="p-2 bg-white/90 backdrop-blur shadow-sm rounded-lg text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                      title="Concluir Tarefa"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <Link href={`/tasks/edit/${task.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-white/90 backdrop-blur shadow-sm rounded-lg text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                    >
                      <Edit2 size={14} />
                    </Link>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTask(task.id);
                      }}
                      className="p-2 bg-white/90 backdrop-blur shadow-sm rounded-lg text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <AnimatePresence>
                  {expandedTasks.has(task.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pt-2"
                    >
                      <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'} shadow-sm`}>
                        <p className={`text-sm mb-4 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {task.description}
                        </p>
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-end mb-2">
                            <span className={`text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Status do Progresso</span>
                            <span className="text-lg font-black text-blue-600 leading-none">{task.progress || 0}%</span>
                          </div>
                          <ProgressBar 
                            progress={task.progress || 0}
                            onUpdate={(newProgress) => handleProgressUpdate(task.id, newProgress)}
                            isDarkMode={isDarkMode}
                            className="w-full h-2"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
            )}
          </div>
        </div>

        {/* Profile Details (Skills & Contact) */}
        <div className={`px-4 py-6 mb-2 shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Detalhes do Perfil</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Module Access */}
            {isAdmin && (
              <div>
                <h4 className={`text-sm font-bold mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Acesso a Módulos</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {['leads', 'deliveries', 'transfers', 'warranties', 'reports', 'whatsapp', 'sales'].map(module => (
                    <button 
                      key={module}
                      onClick={() => handleToggleModuleAccess(module)}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95 ${
                        user[`can_access_${module}`]
                          ? (isDarkMode ? 'bg-blue-900/30 border-blue-700 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm')
                          : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400')
                      }`}
                    >
                      <div className={`size-10 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                        user[`can_access_${module}`]
                          ? (isDarkMode ? 'bg-blue-800' : 'bg-blue-100')
                          : (isDarkMode ? 'bg-slate-700' : 'bg-slate-200')
                      }`}>
                        {user[`can_access_${module}`] ? <ShieldCheck size={20} /> : <X size={20} />}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-center">{module === 'whatsapp' ? 'WhatsApp' : module === 'sales' ? 'Vendas' : module}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Skills */}
            <div>
              <h4 className={`text-sm font-bold mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Habilidades e Especialidades</h4>
              
              {isAdmin && (
                <div className="space-y-4 mb-6">
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_SKILLS.map((skill) => {
                      const isAlreadyAdded = user.skills.some((s: any) => s?.skill?.toLowerCase() === skill.toLowerCase());
                      return (
                        <button
                          key={skill}
                          onClick={() => !isAlreadyAdded && handleAddSkill(skill)}
                          disabled={isAddingSkill || isAlreadyAdded}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isAlreadyAdded
                              ? (isDarkMode ? 'bg-slate-800 text-slate-600 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-200')
                              : (isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-blue-500 hover:text-blue-400' : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-600 hover:text-blue-600')
                          }`}
                        >
                          {isAlreadyAdded ? <CheckCircle2 size={12} /> : <Plus size={12} />}
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Outra habilidade..."
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                      className={`flex-1 h-10 px-4 rounded-xl border outline-none text-sm transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                      }`}
                    />
                    <button 
                      onClick={() => handleAddSkill()}
                      disabled={isAddingSkill || !newSkill.trim()}
                      className={`flex size-10 items-center justify-center rounded-xl transition-all ${
                        isAddingSkill || !newSkill.trim()
                          ? 'bg-slate-200 text-slate-400'
                          : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 active:scale-95'
                      }`}
                    >
                      {isAddingSkill ? (
                        <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Plus size={20} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {user.skills.map((skillObj: any, idx: number) => (
                  <div 
                    key={skillObj.id || idx} 
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors group ${
                      isDarkMode ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    <Link href={`/tasks?search=${encodeURIComponent(skillObj?.skill || '')}`} className="text-xs font-bold hover:underline">
                      {skillObj?.skill}
                    </Link>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteSkill(skillObj.id)}
                        className={`p-0.5 rounded-md hover:bg-rose-500 hover:text-white transition-colors ${
                          isDarkMode ? 'text-blue-400/50' : 'text-blue-600/50'
                        }`}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {user.skills.length === 0 && (
                  <p className="text-xs text-slate-500 italic">Nenhuma habilidade cadastrada.</p>
                )}
              </div>
            </div>
            
            {/* Contact */}
            <div>
              <h4 className={`text-sm font-bold mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Informações de Contato</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-4 group cursor-pointer">
                  <div className={`size-10 rounded-full flex items-center justify-center transition-colors ${
                    isDarkMode ? 'bg-slate-800 text-slate-400 group-hover:bg-blue-900/30 group-hover:text-blue-400' : 'bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                  }`}>
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>E-mail</p>
                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group cursor-pointer">
                  <div className={`size-10 rounded-full flex items-center justify-center transition-colors ${
                    isDarkMode ? 'bg-slate-800 text-slate-400 group-hover:bg-blue-900/30 group-hover:text-blue-400' : 'bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                  }`}>
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Telefone</p>
                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{user.phone}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Reviews */}
        <div className={`px-4 py-6 mb-2 shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Avaliações de Desempenho</h3>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl text-sm transition-all active:scale-95 w-full sm:w-auto">Adicionar Avaliação</button>
          </div>
          <div className="space-y-6">
            {user.reviews.map((review: any, idx: number) => (
              <div key={idx} className={`pb-4 last:border-0 last:pb-0 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_: any, i: number) => (
                      <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} />
                    ))}
                  </div>
                  <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{review.date}</span>
                </div>
                <p className={`text-sm italic leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>&quot;{review.text}&quot;</p>
                <p className={`text-[11px] mt-2 font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Avaliado por {review.author_name}, {review.author_role}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showDeleteSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[100]"
          >
            <CheckCircle2 size={20} />
            Tarefa excluída com sucesso!
          </motion.div>
        )}
        {showSkillSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[100]"
          >
            <CheckCircle2 size={20} />
            {skillMessage}
          </motion.div>
        )}
        {showStatusModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-2xl ${user?.status === 'Inativo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {user?.status === 'Inativo' ? <UserCheck size={28} /> : <AlertOctagon size={28} />}
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-tight">
                    {user?.status === 'Inativo' ? 'Reativar Colaborador?' : 'Inativar Colaborador?'}
                  </h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {user?.status === 'Inativo' ? 'Retornar acesso à empresa' : 'Desligamento / Pausa na empresa'}
                  </p>
                </div>
              </div>

              <p className={`text-sm mb-6 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {user?.status === 'Inativo' ? (
                  <>Você está reativando <strong>{user?.name}</strong>. Ele voltará a ter acesso ao sistema e poderá ser atribuído em novas tarefas.</>
                ) : (
                  <>Tem certeza que deseja inativar <strong>{user?.name}</strong>? O ex-colaborador perderá o acesso ao sistema e não aparecerá para novas atribuições de tarefas.</>
                )}
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  disabled={isUpdatingStatus}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmToggleStatus}
                  disabled={isUpdatingStatus}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                    user?.status === 'Inativo'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {isUpdatingStatus ? (
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : user?.status === 'Inativo' ? (
                    <>
                      <UserCheck size={16} />
                      Confirmar Reativação
                    </>
                  ) : (
                    <>
                      <UserX size={16} />
                      Confirmar Inativação
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
