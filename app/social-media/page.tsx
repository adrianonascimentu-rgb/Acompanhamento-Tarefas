'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Users, Calendar, Layout, List, TrendingUp, Search, Plus, Filter, MessageSquare, Share2, Camera, Briefcase, Send, ClipboardList, Clock, CheckCircle2, AlertCircle, ExternalLink, FileText, MoreHorizontal, Trash2, Pencil, Database } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { useUI } from '@/hooks/useUI';
import { supabase } from '@/lib/supabase';
import { LoginForm } from '@/components/auth/LoginForm';
import { BottomNav } from '@/components/BottomNav';

// Components
const StatusBadge = ({ status, isDarkMode }: { status: SocialTaskStatus, isDarkMode: boolean }) => {
  const configs = {
    'Ideia': { color: 'bg-slate-500', label: 'Ideia/Pendente' },
    'Em Produção': { color: 'bg-amber-500', label: 'Em Produção' },
    'Aguardando Aprovação': { color: 'bg-blue-500', label: 'Aguardando Aprovação' },
    'Agendado/Publicado': { color: 'bg-emerald-500', label: 'Agendado/Publicado' },
  };

  const config = configs[status] || configs['Ideia'];

  return (
    <motion.span 
      key={status}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`px-2 py-1 rounded text-[10px] font-bold text-white shadow-sm transition-all ${config.color}`}
    >
      {config.label}
    </motion.span>
  );
};

const ChannelIcon = ({ channel }: { channel: SocialChannel }) => {
  switch (channel) {
    case 'Instagram': return <Camera size={14} className="text-pink-500" />;
    case 'Facebook': return <MessageSquare size={14} className="text-blue-600" />;
    case 'Twitter': return <Send size={14} className="text-sky-400" />;
    case 'Linkedin': return <Briefcase size={14} className="text-blue-700" />;
    case 'Google': return <Search size={14} className="text-red-500" />;
    case 'E-commerce': return <Share2 size={14} className="text-indigo-500" />;
    default: return <Share2 size={14} />;
  }
};

const TaskProgressBar = ({ checklist, isDarkMode }: { checklist: any, isDarkMode: boolean }) => {
  const checklistItems = [
    checklist.hashtags,
    checklist.localKeywords,
    checklist.taggedAccounts,
    checklist.qualityChecked
  ];
  const completedCount = checklistItems.filter(Boolean).length;
  const progressPercent = (completedCount / checklistItems.length) * 100;

  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter opacity-50">
        <span>Checklist</span>
        <span>{Math.round(progressPercent)}%</span>
      </div>
      <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          className={`h-full transition-all duration-500 ${
            progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'
          }`}
        />
      </div>
    </div>
  );
};

type TabId = 'overview' | 'calendar' | 'analytics' | 'tasks';

type SocialTaskStatus = 'Ideia' | 'Em Produção' | 'Aguardando Aprovação' | 'Agendado/Publicado';
type SocialChannel = 'Instagram' | 'Facebook' | 'Google' | 'E-commerce' | 'Twitter' | 'Linkedin';

interface SocialTask {
  id: string;
  title: string;
  formats: string[]; // Changed to array
  responsibleId: string;
  responsibleName: string;
  supervisorId?: string;
  supervisorName?: string;
  deadlineSLA: string; // Date for creation
  publicationDate: string; // Date for posting
  status: SocialTaskStatus;
  channels: SocialChannel[]; // Changed to array
  links: {
    canva?: string;
    drive?: string;
    caption?: string;
  };
  checklist: {
    hashtags: boolean;
    localKeywords: boolean;
    taggedAccounts: boolean;
    qualityChecked: boolean;
  };
  feedback?: string;
  comments?: { id: string; text: string; author: string; date: string }[];
  createdAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string;
  avatar: string;
  platforms: string[];
  tasks: number;
}

export default function SocialMediaPage() {
  const { isDarkMode } = useTheme();
  const { role, isAdmin, canAccessSocialMedia, isAuthenticated, isLoading: roleLoading, login, user } = useRole();
  const { showToast, showConfirm } = useUI();
  const [activeTab, setActiveTab] = useState<TabId>('overview'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<SocialTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<SocialChannel | 'Todos'>('Todos');
  const [selectedResponsible, setSelectedResponsible] = useState<string | 'Todos'>('Todos');
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  // Form State for new task
  const [newTask, setNewTask] = useState<Partial<SocialTask>>({
    status: 'Ideia',
    channels: [],
    formats: [],
    links: { canva: '', drive: '', caption: '' },
    checklist: { hashtags: false, localKeywords: false, taggedAccounts: false, qualityChecked: false }
  });

  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [isCommentsColumnMissing, setIsCommentsColumnMissing] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      if (!isAuthenticated) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsTableMissing(false);
    try {
      console.log('Fetching social media tasks for user:', user?.id);

      // Try with joins first
      let { data, error } = await supabase
        .from('social_media_tasks')
        .select(`
          *,
          profiles!responsible_id(name),
          supervisor:profiles!supervisor_id(name)
        `)
        .order('created_at', { ascending: false });

      // If join fails, try a simple select as fallback to diagnose if table exists
      if (error) {
        if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
          setIsTableMissing(true);
          throw new Error('Tabela social_media_tasks não foi encontrada. Clique no botão de aviso acima para criar.');
        }
        
        console.warn('Advanced fetch failed, trying simple fetch:', error.message);
        const simpleResult = await supabase
          .from('social_media_tasks')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (simpleResult.error) {
          if (simpleResult.error.code === '42P01' || (simpleResult.error.message && simpleResult.error.message.includes('does not exist'))) {
            setIsTableMissing(true);
            throw new Error('Tabela social_media_tasks não foi encontrada.');
          }
          console.error('Simple fetch also failed:', simpleResult.error);
          throw new Error(simpleResult.error.message || 'Erro de permissão ou de conexão com o banco de dados');
        }
        
        data = simpleResult.data;
      }

      if (data) {
        // Detectar se a coluna comments está faltando
        if (data.length > 0 && !('comments' in data[0])) {
          setIsCommentsColumnMissing(true);
        }

        const mappedTasks: SocialTask[] = data.map((t: any) => {
          // Special case for checking what's coming back for joint profile data
          // Supabase JS sometimes returns the joined table as an object or just values
          const responsibleName = 
            t.profiles?.name || 
            t.responsible?.name || 
            team.find(m => m.id === t.responsible_id)?.name || 
            (isLoadingTeam ? 'Carregando...' : 'Desconhecido');

          return {
            id: t.id,
            title: t.title,
            formats: t.formats || [],
            responsibleId: t.responsible_id,
            responsibleName: responsibleName,
            supervisorId: t.supervisor_id,
            supervisorName: t.supervisor?.name || team.find(m => m.id === t.supervisor_id)?.name || '',
            deadlineSLA: t.deadline_sla,
            publicationDate: t.publication_date,
            status: t.status,
            channels: t.channels || [],
            links: t.links || {},
            checklist: t.checklist || { hashtags: false, localKeywords: false, taggedAccounts: false, qualityChecked: false },
            feedback: t.feedback,
            comments: t.comments || [],
            createdAt: t.created_at
          };
        });
        setTasks(mappedTasks);
      }
    } catch (err: any) {
      console.error('Error fetching tasks details:', err);
      // Only alert if it's not the missing table error which we show in UI
      if (!isTableMissing) {
        alert('Erro ao carregar tarefas: ' + (err.message || 'Verifique as permissões de acesso ao banco de dados.'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, team, isLoadingTeam, isTableMissing]); // Added dependencies

  const fetchTeam = useCallback(async () => {
    setIsLoadingTeam(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const mappedTeam: TeamMember[] = data.map((p: any) => ({
          id: p.id,
          name: p.name || 'Sem nome',
          role: p.role || 'Colaborador',
          status: p.status || 'Ativo',
          avatar: p.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`,
          platforms: p.can_access_social_media ? ['Instagram', 'Facebook', 'Twitter'] : ['-'], 
          tasks: Math.floor(Math.random() * 5)
        }));
        setTeam(mappedTeam);
      }
    } catch (err) {
      console.warn('Error fetching team:', err);
    } finally {
      setIsLoadingTeam(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && canAccessSocialMedia) {
      fetchTeam();
    }
  }, [isAuthenticated, canAccessSocialMedia, fetchTeam]);

  useEffect(() => {
    if (isAuthenticated && canAccessSocialMedia) {
      fetchTasks();
    }
  }, [isAuthenticated, canAccessSocialMedia, fetchTasks]);

  const tabs = [
    { id: 'overview', label: 'Painel Gestor', icon: Layout },
    { id: 'tasks', label: 'Tarefas', icon: ClipboardList },
    { id: 'calendar', label: 'Editorial', icon: Calendar },
    { id: 'analytics', label: 'Métricas', icon: TrendingUp },
  ];

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         task.formats?.some(f => f.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         task.responsibleName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = selectedChannel === 'Todos' || task.channels?.includes(selectedChannel as SocialChannel);
    const matchesResponsible = selectedResponsible === 'Todos' || task.responsibleId === selectedResponsible;
    
    return matchesSearch && matchesChannel && matchesResponsible;
  });

  const channels: SocialChannel[] = ['Instagram', 'Facebook', 'Google', 'E-commerce', 'Twitter', 'Linkedin'];

  const stats = [
    { label: 'Total Membros', value: team.length, icon: Users, color: 'bg-blue-500' },
    { label: 'Tarefas Ativas', value: tasks.length, icon: ClipboardList, color: 'bg-emerald-500' },
    { label: 'Aguardando Aprovação', value: tasks.filter(t => t.status === 'Aguardando Aprovação').length, icon: Clock, color: 'bg-amber-500' },
    { label: 'Publicados (Mês)', value: tasks.filter(t => t.status === 'Agendado/Publicado').length, icon: CheckCircle2, color: 'bg-indigo-500' },
  ];

  const handleDeleteTask = (id: string) => {
    showConfirm({
      title: 'Excluir Tarefa',
      message: 'Tem certeza que deseja excluir esta tarefa de redes sociais? Esta ação não pode ser desfeita.',
      type: 'danger',
      confirmLabel: 'Excluir Tarefa',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('social_media_tasks')
            .delete()
            .eq('id', id);
          
          if (error) throw error;
          setTasks(prev => prev.filter(t => t.id !== id));
          showToast('Tarefa excluída com sucesso!', 'success');
        } catch (err: any) {
          console.error('Error deleting task:', err);
          showToast('Erro ao excluir tarefa: ' + (err.message || 'Falha na conexão'), 'error');
        }
      }
    });
  };

  const handleUpdateStatus = async (taskId: string, newStatus: SocialTaskStatus) => {
    console.log('Atualizando status da tarefa social:', { taskId, newStatus });
    try {
      const { data, error } = await supabase
        .from('social_media_tasks')
        .update({ status: newStatus })
        .eq('id', taskId)
        .select();
      
      if (error) {
        const errDetails = {
          message: error.message || 'Sem mensagem',
          details: error.details || 'Sem detalhes',
          hint: error.hint || 'Sem dica',
          code: error.code || 'Sem código',
          stack: error.stack
        };
        console.error('Erro detalhado do Supabase (Status Social):', errDetails);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Nenhuma tarefa atualizada no banco.');
      }

      console.log('Status da tarefa social atualizado com sucesso');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err: any) {
      console.error('Error updating task status:', err);
      const errorMessage = err.message || (err.code ? `Código: ${err.code}` : '') || err.toString() || 'Erro desconhecido';
      alert(`Erro ao atualizar status: ${errorMessage}`);
    }
  };

  const handleAddComment = async (taskId: string) => {
    if (!commentText.trim()) return;

    try {
      console.log('Adicionando comentário à tarefa:', taskId);
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
      const newComment = {
        id: newId,
        text: commentText.trim(),
        author: user?.name || 'Administrador',
        date: new Date().toISOString()
      };

      const updatedComments = [...(task.comments || []), newComment];

      const { data, error } = await supabase
        .from('social_media_tasks')
        .update({ comments: updatedComments })
        .eq('id', taskId)
        .select();
      
      if (error) {
        const errDetails = {
          message: error.message || 'Sem mensagem',
          details: error.details || 'Sem detalhes',
          hint: error.hint || 'Sem dica',
          code: error.code || 'Sem código',
          stack: error.stack
        };
        console.error('Erro detalhado do Supabase (Comentários):', errDetails);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Nenhum registro atualizado ao adicionar comentário.');
      }

      console.log('Comentário adicionado com sucesso localmente e no banco');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: updatedComments } : t));
      setCommentingTaskId(null);
      setCommentText('');
    } catch (err: any) {
      console.error('Error in handleAddComment:', err);
      const errorMessage = err.message || 
                          (err.error_description) || 
                          (err.code ? `Código: ${err.code}` : '') || 
                          (typeof err === 'string' ? err : JSON.stringify(err)) || 
                          err.toString() || 
                          'Erro desconhecido';
      alert(`Erro ao adicionar comentário: ${errorMessage}.`);
      
      if (errorMessage.toLowerCase().includes('column "comments" does not exist') || 
          (err.code === '42703')) { // 42703 is Postgres code for undefined_column
        setIsCommentsColumnMissing(true);
      }
    }
  };

  const handleEditTask = (task: SocialTask) => {
    setNewTask({
      title: task.title,
      formats: task.formats,
      channels: task.channels,
      responsibleId: task.responsibleId,
      responsibleName: task.responsibleName,
      supervisorId: task.supervisorId,
      supervisorName: task.supervisorName,
      deadlineSLA: task.deadlineSLA,
      publicationDate: task.publicationDate,
      status: task.status,
      links: task.links,
      checklist: task.checklist,
    });
    setEditingTaskId(task.id);
    setIsEditing(true);
    setIsTaskModalOpen(true);
  };

  const isSupervisorOrAdmin = isAdmin || role === 'gerente' || role === 'supervisor';
  const [commentingTaskId, setCommentingTaskId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  if (!canAccessSocialMedia) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-6 text-center">
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-full text-rose-600 mb-4">
          <Share2 size={48} />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Acesso Restrito</h1>
        <p className="text-slate-500 mt-2">Você não tem permissão para acessar o módulo de Redes Sociais.</p>
        <Link href="/" className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
          Voltar para o Início
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`sticky top-0 z-20 backdrop-blur-md border-b transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center p-4 justify-between w-full">
          <Link href="/" className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">Redes Sociais</h2>
          <div className="size-10 flex items-center justify-center text-blue-600">
            <Share2 size={20} />
          </div>
        </div>

        <div className="flex px-4 overflow-x-auto no-scrollbar gap-2 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : (isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100')
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32 p-4">
        {isTableMissing && (
          <div className={`mb-6 p-6 rounded-3xl border-2 border-dashed ${isDarkMode ? 'bg-rose-500/10 border-rose-500/50 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-500 text-white rounded-2xl shrink-0">
                <AlertCircle size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-1">Mesa de Redes Sociais Indisponível</h3>
                <p className="text-sm opacity-90 mb-4 leading-relaxed">
                  A tabela <code>social_media_tasks</code> não foi encontrada no seu banco de dados Supabase. 
                  Você precisa criar a tabela para que este módulo funcione corretamente.
                </p>
                <div className="flex flex-col gap-3">
                  <div className={`p-4 rounded-2xl font-mono text-xs overflow-x-auto whitespace-pre ${isDarkMode ? 'bg-slate-950/50' : 'bg-white'}`}>
                    {`-- Primeiro, vamos garantir que a tabela existe com as colunas corretas
CREATE TABLE IF NOT EXISTS social_media_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    formats TEXT[] NOT NULL DEFAULT '{}',
    channels TEXT[] NOT NULL DEFAULT '{}',
    responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deadline_sla DATE NOT NULL,
    publication_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Ideia', 'Em Produção', 'Aguardando Aprovação', 'Agendado/Publicado')),
    links JSONB NOT NULL DEFAULT '{}',
    checklist JSONB NOT NULL DEFAULT '{"hashtags": false, "localKeywords": false, "taggedAccounts": false, "qualityChecked": false}',
    feedback TEXT,
    comments JSONB NOT NULL DEFAULT '[]',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ATENÇÃO: Se você usa login personalizado sem o Auth do Supabase, use estas políticas:
ALTER TABLE social_media_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for all users" ON social_media_tasks;
CREATE POLICY "Enable all for all users" ON social_media_tasks FOR ALL TO public USING (true) WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE social_media_tasks;`}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS social_media_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    formats TEXT[] NOT NULL DEFAULT '{}',
    channels TEXT[] NOT NULL DEFAULT '{}',
    responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    deadline_sla DATE NOT NULL,
    publication_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Ideia', 'Em Produção', 'Aguardando Aprovação', 'Agendado/Publicado')),
    links JSONB NOT NULL DEFAULT '{}',
    checklist JSONB NOT NULL DEFAULT '{"hashtags": false, "localKeywords": false, "taggedAccounts": false, "qualityChecked": false}',
    feedback TEXT,
    comments JSONB NOT NULL DEFAULT '[]',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE social_media_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for all users" ON social_media_tasks;
CREATE POLICY "Enable all for all users" ON social_media_tasks FOR ALL TO public USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE social_media_tasks;`);
                      alert('SQL copiado para a área de transferência!');
                    }}
                    className="self-start px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-colors"
                  >
                    Copiar SQL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isTableMissing && isCommentsColumnMissing && (
          <div className={`mb-6 p-6 rounded-3xl border-2 border-dashed ${isDarkMode ? 'bg-amber-500/10 border-amber-500/50 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0">
                <Database size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-1">Atualização do Banco de Dados Necessária</h3>
                <p className="text-sm opacity-90 mb-4 leading-relaxed">
                  A coluna <code>comments</code> está faltando na sua tabela <code>social_media_tasks</code>. 
                  Isso impede que você adicione comentários às tarefas.
                </p>
                <div className="flex flex-col gap-3">
                  <div className={`p-4 rounded-2xl font-mono text-xs overflow-x-auto whitespace-pre ${isDarkMode ? 'bg-slate-950/50' : 'bg-white'}`}>
                    {`ALTER TABLE social_media_tasks ADD COLUMN comments JSONB NOT NULL DEFAULT '[]';`}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`ALTER TABLE social_media_tasks ADD COLUMN comments JSONB NOT NULL DEFAULT '[]';`);
                      alert('SQL de atualização copiado!');
                    }}
                    className="self-start px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors"
                  >
                    Copiar SQL de Atualização
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="social-overview-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <div key={i} className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl text-white ${stat.color}`}>
                        <stat.icon size={18} />
                      </div>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{stat.label}</p>
                        <p className="text-lg font-black">{stat.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Aguardando Aprovação</h3>
                    <button onClick={() => setActiveTab('tasks')} className="text-xs text-blue-600 font-bold hover:underline">Ver Todas</button>
                  </div>
                  
                  <div className="space-y-3">
                    {tasks.filter(t => t.status === 'Aguardando Aprovação').map(task => (
                      <div key={task.id} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {task.channels?.map(c => <ChannelIcon key={c} channel={c} />)}
                          </div>
                          <div>
                            <p className="text-sm font-bold truncate max-w-[150px]">{task.title}</p>
                            <p className="text-[10px] text-slate-500 font-bold">
                              {task.responsibleName} 
                              {task.supervisorName && ` • Sup: ${task.supervisorName}`}
                              {task.formats && ` • ${task.formats.join(', ')}`}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            if (isSupervisorOrAdmin || task.supervisorId === user?.id) {
                              await handleUpdateStatus(task.id, 'Agendado/Publicado');
                            } else {
                              setActiveTab('tasks');
                            }
                          }} 
                          className="p-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      </div>
                    ))}
                    {tasks.filter(t => t.status === 'Aguardando Aprovação').length === 0 && (
                      <div className={`p-8 rounded-3xl border border-dashed ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'} text-center text-sm italic`}>
                        Nenhuma tarefa pendente de aprovação.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Editorial de Hoje</h3>
                    <button onClick={() => setActiveTab('calendar')} className="text-xs text-blue-600 font-bold hover:underline">Ver Calendário</button>
                  </div>
                  <div className={`p-8 rounded-3xl border border-dashed ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'} text-center text-sm italic`}>
                    Nenhuma publicação agendada para hoje.
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div
              key="tasks-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-4">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  <button 
                    onClick={() => setSelectedChannel('Todos')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                      selectedChannel === 'Todos' 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : (isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500')
                    }`}
                  >
                    Todos os Canais
                  </button>
                  {channels.map(channel => (
                    <button 
                      key={channel}
                      onClick={() => setSelectedChannel(channel)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all flex items-center gap-2 ${
                        selectedChannel === channel 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : (isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500')
                      }`}
                    >
                      <ChannelIcon channel={channel} />
                      {channel}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} size={18} />
                    <input
                      type="text"
                      placeholder="Buscar por título ou responsável..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 rounded-2xl border transition-all outline-none focus:ring-4 focus:ring-blue-600/10 ${
                        isDarkMode 
                          ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-blue-600' 
                          : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 shadow-sm'
                      }`}
                    />
                  </div>
                  
                  <button 
                    onClick={() => setIsTaskModalOpen(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                  >
                    <Plus size={20} />
                    Nova Tarefa
                  </button>
                </div>

                {/* View Switcher */}
                <div className="flex gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 w-fit">
                   {[
                     { id: 'list', label: 'Lista', icon: List },
                     { id: 'kanban', label: 'Kanban', icon: Layout },
                     { id: 'calendar', label: 'Calendário', icon: Calendar }
                   ].map(mode => (
                     <button
                       key={mode.id}
                       onClick={() => setViewMode(mode.id as any)}
                       className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${
                         viewMode === mode.id 
                           ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' 
                           : 'text-slate-500 hover:text-slate-700'
                       }`}
                     >
                       <mode.icon size={14} />
                       {mode.label}
                     </button>
                   ))}
                </div>
              </div>

              {viewMode === 'list' && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTasks.map((task) => (
                    <div 
                      key={task.id}
                      className={`p-5 rounded-3xl border transition-all flex flex-col gap-4 ${
                        isDarkMode 
                          ? 'bg-slate-900 border-slate-800 hover:border-slate-700' 
                          : 'bg-white border-slate-100 shadow-sm hover:border-blue-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                             {task.channels?.map(c => <ChannelIcon key={c} channel={c} />)}
                          </div>
                          <span className={`text-[10px] font-bold uppercase opacity-60`}>{task.formats?.join(', ')}</span>
                        </div>
                        {isSupervisorOrAdmin ? (
                          <select
                            value={task.status}
                            onChange={(e) => handleUpdateStatus(task.id, e.target.value as SocialTaskStatus)}
                            className={`text-[10px] font-bold py-1 px-2 rounded-lg border-none outline-none cursor-pointer transition-all ${
                              task.status === 'Ideia' ? 'bg-slate-500 text-white' :
                              task.status === 'Em Produção' ? 'bg-amber-500 text-white' :
                              task.status === 'Aguardando Aprovação' ? 'bg-blue-500 text-white' :
                              'bg-emerald-500 text-white'
                            }`}
                          >
                            {['Ideia', 'Em Produção', 'Aguardando Aprovação', 'Agendado/Publicado'].map(s => (
                              <option key={s} value={s} className={isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <StatusBadge status={task.status} isDarkMode={isDarkMode} />
                        )}
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-black text-lg line-clamp-2">{task.title}</h4>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">
                            {task.responsibleName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Responsável</p>
                            <p className="text-sm font-bold truncate">{task.responsibleName}</p>
                          </div>
                        </div>
                        {task.supervisorName && (
                          <div className="flex items-center gap-3 group/sup">
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 text-xs font-bold shrink-0 relative">
                              {task.supervisorName.split(' ').map(n => n[0]).join('')}
                              {isAdmin && (
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if(confirm('Remover supervisor desta tarefa?')) {
                                      try {
                                        const { error } = await supabase
                                          .from('social_media_tasks')
                                          .update({ supervisor_id: null })
                                          .eq('id', task.id);
                                        if (error) throw error;
                                        setTasks(tasks.map(t => t.id === task.id ? { ...t, supervisorId: undefined, supervisorName: '' } : t));
                                      } catch (err) {
                                        console.error('Error removing supervisor:', err);
                                      }
                                    }
                                  }}
                                  className="absolute -top-1 -right-1 size-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/sup:opacity-100 transition-opacity"
                                >
                                  <Plus size={8} className="rotate-45" />
                                </button>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Supervisor</p>
                              <p className="text-sm font-bold truncate">{task.supervisorName}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className={`p-2 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">SLA Produção</p>
                          <p className="text-xs font-bold">{new Date(task.deadlineSLA).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className={`p-2 rounded-2xl ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
                          <p className="text-[10px] font-bold text-emerald-500 uppercase">Publicação</p>
                          <p className="text-xs font-bold">{new Date(task.publicationDate).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>

                      <TaskProgressBar checklist={task.checklist} isDarkMode={isDarkMode} />

                      <div className="flex gap-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 font-bold text-[10px] uppercase text-slate-400">
                        Checklist: 
                        <span className={task.checklist.hashtags ? 'text-emerald-500' : ''}>#</span>
                        <span className={task.checklist.localKeywords ? 'text-emerald-500' : ''}>SEO</span>
                        <span className={task.checklist.qualityChecked ? 'text-emerald-500' : ''}>QA</span>
                      </div>

                      {task.comments && task.comments.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <p className="text-[10px] font-bold uppercase text-slate-500">Comentários:</p>
                          {task.comments.map(comment => (
                            <div key={comment.id} className={`p-2 rounded-xl text-[11px] ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                              <div className="flex justify-between items-start mb-1">
                                <p className="font-bold text-blue-600">{comment.author}:</p>
                                <p className="text-[9px] opacity-40">{new Date(comment.date).toLocaleDateString('pt-BR')}</p>
                              </div>
                              <p className="opacity-80">{comment.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {commentingTaskId === task.id && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            autoFocus
                            placeholder="Escreva seu comentário..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className={`w-full p-3 rounded-xl text-xs border outline-none focus:ring-2 focus:ring-blue-600 ${
                              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddComment(task.id)}
                              className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-[10px] font-bold uppercase shadow-lg shadow-blue-600/20"
                            >
                              Enviar
                            </button>
                            <button
                              onClick={() => {
                                setCommentingTaskId(null);
                                setCommentText('');
                              }}
                              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase border ${
                                isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                              }`}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                        {task.status === 'Aguardando Aprovação' && (isSupervisorOrAdmin || task.supervisorId === user?.id) && (
                          <>
                            <button 
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('social_media_tasks')
                                    .update({ status: 'Agendado/Publicado' })
                                    .eq('id', task.id);
                                  
                                  if (error) throw error;
                                  const updated = tasks.map(t => t.id === task.id ? { ...t, status: 'Agendado/Publicado' as SocialTaskStatus } : t);
                                  setTasks(updated);
                                } catch (err) {
                                  console.error('Error approving task:', err);
                                  alert('Erro ao aprovar tarefa.');
                                }
                              }}
                              className="flex-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 py-2 rounded-xl font-bold text-xs hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                            >
                              Aprovar
                            </button>
                            <button 
                              onClick={async () => {
                                const feedbackText = prompt('Feedback para o colaborador:');
                                if (feedbackText) {
                                  try {
                                    const { error } = await supabase
                                      .from('social_media_tasks')
                                      .update({ status: 'Em Produção', feedback: feedbackText })
                                      .eq('id', task.id);
                                    
                                    if (error) throw error;
                                    const updated = tasks.map(t => t.id === task.id ? { ...t, status: 'Em Produção' as SocialTaskStatus, feedback: feedbackText } : t);
                                    setTasks(updated);
                                  } catch (err) {
                                    console.error('Error refusing task:', err);
                                    alert('Erro ao recusar tarefa.');
                                  }
                                }
                              }}
                              className="flex-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 py-2 rounded-xl font-bold text-xs hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
                            >
                              Recusar
                            </button>
                          </>
                        )}
                        
                        {task.links.canva && (
                          <a href={task.links.canva} target="_blank" className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                            <ExternalLink size={18} />
                          </a>
                        )}
                        {task.links.drive && (
                          <a href={task.links.drive} target="_blank" className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                            <FileText size={18} />
                          </a>
                        )}
                        <button 
                          onClick={() => setCommentingTaskId(commentingTaskId === task.id ? null : task.id)}
                          className={`p-2 rounded-xl transition-colors ${commentingTaskId === task.id ? 'bg-blue-600 text-white' : (isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600')}`}
                          title="Adicionar Comentário"
                        >
                          <MessageSquare size={18} />
                        </button>
                        <button 
                          onClick={() => handleEditTask(task)}
                          className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                          title="Editar Tarefa"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTask(task.id)}
                          className={`p-2 rounded-xl transition-colors text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20`}
                          title="Excluir Tarefa"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button className={`p-2 rounded-xl transition-colors ml-auto ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === 'kanban' && (
                <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar min-h-[500px]">
                  {(['Ideia', 'Em Produção', 'Aguardando Aprovação', 'Agendado/Publicado'] as SocialTaskStatus[]).map(status => (
                    <div key={status} className={`min-w-[300px] flex flex-col gap-4 p-4 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/50 border-slate-100 shadow-inner'}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-500">{status}</h4>
                        <span className="text-[10px] font-black opacity-40">{filteredTasks.filter(t => t.status === status).length}</span>
                      </div>
                      <div className="space-y-3">
                         {filteredTasks.filter(t => t.status === status).map(task => (
                             <div key={task.id} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 shadow-sm'} flex flex-col gap-2 relative group`}>
                                <div className="flex justify-between items-center">
                                  <div className="flex gap-1">
                                    {task.channels?.map(c => <ChannelIcon key={c} channel={c} />)}
                                  </div>
                                  {isSupervisorOrAdmin ? (
                                    <select
                                      value={task.status}
                                      onChange={(e) => handleUpdateStatus(task.id, e.target.value as SocialTaskStatus)}
                                      className="text-[8px] font-bold bg-transparent border-none outline-none cursor-pointer text-slate-400 hover:text-blue-600"
                                    >
                                      {['Ideia', 'Em Produção', 'Aguardando Aprovação', 'Agendado/Publicado'].map(s => (
                                        <option key={s} value={s} className={isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-900'}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-[9px] font-bold text-slate-400">{task.formats?.[0] || '-'}</span>
                                  )}
                                </div>
                                <p className="text-sm font-bold leading-tight">{task.title}</p>
                                
                                <TaskProgressBar checklist={task.checklist} isDarkMode={isDarkMode} />

                                {task.comments && task.comments.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1 opacity-60">
                                     <MessageSquare size={10} />
                                     <span className="text-[9px] font-bold">{task.comments.length}</span>
                                  </div>
                                )}

                                {commentingTaskId === task.id && (
                                  <div className="mt-2 space-y-1">
                                    <textarea
                                      autoFocus
                                      placeholder="Comentar..."
                                      value={commentText}
                                      onChange={(e) => setCommentText(e.target.value)}
                                      className={`w-full p-2 rounded-lg text-[10px] border outline-none focus:ring-1 focus:ring-blue-600 ${
                                        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
                                      }`}
                                      rows={2}
                                    />
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleAddComment(task.id)}
                                        className="flex-1 bg-blue-600 text-white p-1 rounded-lg text-[8px] font-bold uppercase"
                                      >
                                        Ok
                                      </button>
                                      <button
                                        onClick={() => {
                                          setCommentingTaskId(null);
                                          setCommentText('');
                                        }}
                                        className={`flex-1 p-1 rounded-lg text-[8px] font-bold uppercase border ${
                                          isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                                        }`}
                                      >
                                        X
                                      </button>
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-blue-600 truncate max-w-[80px]">{task.responsibleName?.split(' ')[0]}</span>
                                    {task.supervisorName && (
                                      <span className="text-[8px] font-bold text-slate-400 truncate max-w-[80px]">Sup: {task.supervisorName.split(' ')[0]}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400">{new Date(task.publicationDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                    <div className="flex gap-1 items-center">
                                      <button 
                                        onClick={() => setCommentingTaskId(commentingTaskId === task.id ? null : task.id)}
                                        className={`p-1 rounded ${commentingTaskId === task.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/20'}`}
                                        title="Comentar"
                                      >
                                        <MessageSquare size={12} />
                                      </button>
                                      <button 
                                        onClick={() => handleEditTask(task)}
                                        className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                        title="Editar"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteTask(task.id)}
                                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded"
                                        title="Excluir"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                             </div>
                         ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === 'calendar' && (
                 <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="grid grid-cols-7 gap-px rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                       {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                         <div key={d} className="p-2 text-[10px] font-black uppercase text-center bg-slate-50 dark:bg-slate-800 text-slate-400">{d}</div>
                       ))}
                       {Array.from({ length: 31 }).map((_, i) => {
                          const day = i + 1;
                          const dayTasks = filteredTasks.filter(t => new Date(t.publicationDate).getDate() === day);
                          return (
                            <div key={i} className="min-h-[80px] p-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-[0.5px] border-slate-50 dark:border-slate-800">
                               <span className="text-[10px] font-bold text-slate-400">{day}</span>
                               <div className="space-y-1 mt-1">
                                  {dayTasks.map(t => (
                                    <button 
                                      key={t.id} 
                                      onClick={() => handleEditTask(t)}
                                      className="w-full text-left text-[8px] font-bold truncate p-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
                                      title={`${t.title} - Clique para ver/editar/excluir`}
                                    >
                                       <div className="flex shrink-0">
                                          {t.channels?.slice(0, 2).map((c, idx) => <ChannelIcon key={idx} channel={c} />)}
                                       </div>
                                       <span className="truncate">{t.title}</span>
                                    </button>
                                  ))}
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 </div>
              )}
              
              {filteredTasks.length === 0 && (
                <div className="text-center py-20">
                  <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="text-slate-400" size={32} />
                  </div>
                  <h3 className="font-bold">Nenhuma tarefa encontrada</h3>
                  <p className="text-sm text-slate-500">Tente ajustar seus filtros.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">Calendário Editorial</h3>
                <div className="flex gap-2">
                   <button className={`p-2 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                     <ArrowLeft size={16} />
                   </button>
                   <span className="px-4 py-2 font-bold uppercase tracking-widest text-xs self-center">Maio 2024</span>
                   <button className={`p-2 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                     <ArrowLeft size={16} className="rotate-180" />
                   </button>
                </div>
              </div>

              <div className={`grid grid-cols-7 gap-px overflow-hidden rounded-3xl border ${isDarkMode ? 'bg-slate-800 border-slate-800' : 'bg-slate-200 border-slate-200 shadow-sm'}`}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className={`p-4 text-[10px] font-black uppercase text-center ${isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                    {day}
                  </div>
                ))}
                {Array.from({ length: 31 }).map((_, i) => {
                  const day = i + 1;
                  const dayTasks = tasks.filter(t => new Date(t.publicationDate).getDate() === day && new Date(t.publicationDate).getMonth() === 4);
                  
                  return (
                    <div key={i} className={`min-h-[100px] p-2 transition-colors ${isDarkMode ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-slate-50'}`}>
                      <span className={`text-xs font-bold ${dayTasks.length > 0 ? 'text-blue-600 font-black' : 'text-slate-400'}`}>{day}</span>
                      <div className="mt-1 space-y-1">
                        {dayTasks.map(t => (
                          <div key={t.id} className={`p-1 rounded text-[8px] font-bold truncate flex items-center gap-1 ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            <div className="flex shrink-0">
                              {t.channels.slice(0, 2).map((c, idx) => <ChannelIcon key={idx} channel={c} />)}
                            </div>
                            {t.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center py-20"
            >
              <TrendingUp className="mx-auto text-amber-600 mb-4" size={48} />
              <h3 className="text-xl font-bold">Métricas de Performance</h3>
              <p className="text-slate-500 mt-2">Acompanhe o crescimento e engajamento da marca.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <BottomNav />

      {/* Task Modal */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTaskModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black">{isEditing ? 'Editar Tarefa' : 'Nova Tarefa Social'}</h3>
                <button 
                  onClick={() => {
                    setIsTaskModalOpen(false);
                    setIsEditing(false);
                    setEditingTaskId(null);
                  }}
                  className={`p-2 rounded-xl ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                >
                  <ArrowLeft size={20} className="rotate-90" />
                </button>
              </div>

              <form className="space-y-6" onSubmit={async (e) => {
                e.preventDefault();
                if ((newTask.channels?.length || 0) === 0 || (newTask.formats?.length || 0) === 0) {
                  alert('Selecione pelo menos um canal e um formato.');
                  return;
                }
                
                setIsLoading(true);
                try {
                  if (isEditing && editingTaskId) {
                    const taskToUpdate = {
                      title: newTask.title,
                      formats: newTask.formats,
                      channels: newTask.channels,
                      responsible_id: newTask.responsibleId,
                      supervisor_id: newTask.supervisorId || null,
                      deadline_sla: newTask.deadlineSLA,
                      publication_date: newTask.publicationDate,
                      status: newTask.status,
                      links: newTask.links,
                      checklist: newTask.checklist,
                    };

                    const { data, error } = await supabase
                      .from('social_media_tasks')
                      .update(taskToUpdate)
                      .eq('id', editingTaskId)
                      .select(`
                        *,
                        responsible:profiles!responsible_id(name),
                        profiles!responsible_id(name),
                        supervisor:profiles!supervisor_id(name)
                      `)
                      .single();

                    if (error) throw error;

                    if (data) {
                      const updatedTask: SocialTask = {
                        id: data.id,
                        title: data.title,
                        formats: data.formats,
                        responsibleId: data.responsible_id,
                        responsibleName: data.profiles?.name || data.responsible?.name || 'Desconhecido',
                        supervisorId: data.supervisor_id,
                        supervisorName: data.supervisor?.name || '',
                        deadlineSLA: data.deadline_sla,
                        publicationDate: data.publication_date,
                        status: data.status,
                        channels: data.channels,
                        links: data.links,
                        checklist: data.checklist,
                        feedback: data.feedback,
                        createdAt: data.created_at
                      };

                      setTasks(tasks.map(t => t.id === editingTaskId ? updatedTask : t));
                      setIsTaskModalOpen(false);
                      setIsEditing(false);
                      setEditingTaskId(null);
                      setNewTask({ 
                        status: 'Ideia', 
                        channels: [], 
                        formats: [],
                        links: { canva: '', drive: '', caption: '' },
                        checklist: { hashtags: false, localKeywords: false, taggedAccounts: false, qualityChecked: false } 
                      });
                    }
                  } else {
                    const taskToInsert = {
                      title: newTask.title,
                      formats: newTask.formats,
                      channels: newTask.channels,
                      responsible_id: newTask.responsibleId,
                      supervisor_id: newTask.supervisorId || null,
                      deadline_sla: newTask.deadlineSLA,
                      publication_date: newTask.publicationDate,
                      status: newTask.status,
                      links: newTask.links,
                      checklist: newTask.checklist,
                      created_by: user?.id
                    };

                    const { data, error } = await supabase
                      .from('social_media_tasks')
                      .insert([taskToInsert])
                      .select(`
                        *,
                        responsible:profiles!responsible_id(name),
                        profiles!responsible_id(name),
                        supervisor:profiles!supervisor_id(name)
                      `)
                      .single();

                    if (error) {
                      if (error.code === '42P01' || error.message?.includes('does not exist')) {
                        setIsTableMissing(true);
                        throw new Error('Tabela social_media_tasks não encontrada. Execute o SQL de criação.');
                      }
                      if (error.code === '42501' || error.message?.includes('permission denied')) {
                        throw new Error('Permissão negada para inserir na tabela. Verifique as políticas de RLS ou tente copiar o SQL novamente com a política pública.');
                      }
                      throw error;
                    }

                    if (data) {
                      const createdTask: SocialTask = {
                        id: data.id,
                        title: data.title,
                        formats: data.formats,
                        responsibleId: data.responsible_id,
                        responsibleName: data.profiles?.name || data.responsible?.name || 'Desconhecido',
                        supervisorId: data.supervisor_id,
                        supervisorName: data.supervisor?.name || '',
                        deadlineSLA: data.deadline_sla,
                        publicationDate: data.publication_date,
                        status: data.status,
                        channels: data.channels,
                        links: data.links,
                        checklist: data.checklist,
                        feedback: data.feedback,
                        createdAt: data.created_at
                      };

                      setTasks([createdTask, ...tasks]);
                      setIsTaskModalOpen(false);
                      setNewTask({ 
                        status: 'Ideia', 
                        channels: [], 
                        formats: [],
                        links: { canva: '', drive: '', caption: '' },
                        checklist: { hashtags: false, localKeywords: false, taggedAccounts: false, qualityChecked: false } 
                      });
                    }
                  }
                } catch (err: any) {
                  console.error('Error saving task:', err);
                  const errorMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
                  alert('Erro ao salvar tarefa: ' + errorMsg);
                } finally {
                  setIsLoading(false);
                }
              }}>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Título</label>
                  <input 
                    required
                    placeholder="Ex: Reels sobre manutenção"
                    value={newTask.title || ''}
                    className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:ring-2 focus:ring-blue-600`}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase text-slate-500">Formatos/Canais (Múltiplos)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Reels', 'Post Estático', 'Carrossel', 'Story', 'Resposta Google', 'Campanha', 'E-mail Marketing', 'Blog'].map(format => (
                      <label key={format} className={`flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                        newTask.formats?.includes(format)
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
                      }`}>
                        <input 
                          type="checkbox"
                          className="hidden"
                          checked={newTask.formats?.includes(format)}
                          onChange={(e) => {
                            const current = newTask.formats || [];
                            if (e.target.checked) {
                              setNewTask({...newTask, formats: [...current, format]});
                            } else {
                              setNewTask({...newTask, formats: current.filter(f => f !== format)});
                            }
                          }}
                        />
                        <span className="text-[10px] font-bold uppercase">{format}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase text-slate-500">Redes Sociais (Múltiplas)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {channels.map(channel => (
                      <label key={channel} className={`flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                        newTask.channels?.includes(channel)
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
                      }`}>
                        <input 
                          type="checkbox"
                          className="hidden"
                          checked={newTask.channels?.includes(channel)}
                          onChange={(e) => {
                            const current = newTask.channels || [];
                            if (e.target.checked) {
                              setNewTask({...newTask, channels: [...current, channel]});
                            } else {
                              setNewTask({...newTask, channels: current.filter(c => c !== channel)});
                            }
                          }}
                        />
                        <ChannelIcon channel={channel} />
                        <span className="text-[10px] font-bold uppercase">{channel}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Responsável</label>
                    <select 
                      required
                      value={newTask.responsibleId || ''}
                      className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:ring-2 focus:ring-blue-600`}
                      onChange={(e) => {
                        const member = team.find(m => m.id === e.target.value);
                        setNewTask({...newTask, responsibleId: e.target.value, responsibleName: member?.name || ''});
                      }}
                    >
                      <option value="">Selecione</option>
                      {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Supervisor (Opcional)</label>
                    <div className="flex gap-2">
                      <select 
                        className={`flex-1 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:ring-2 focus:ring-blue-600`}
                        value={newTask.supervisorId || ''}
                        onChange={(e) => {
                          const member = team.find(m => m.id === e.target.value);
                          setNewTask({...newTask, supervisorId: e.target.value || undefined, supervisorName: member?.name || ''});
                        }}
                      >
                        <option value="">Nenhum</option>
                        {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      {newTask.supervisorId && (
                        <button 
                          type="button"
                          onClick={() => setNewTask({...newTask, supervisorId: undefined, supervisorName: ''})}
                          className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-rose-500 hover:bg-rose-500/10' : 'bg-slate-50 border-slate-200 text-rose-600 hover:bg-rose-50'}`}
                          title="Remover Supervisor"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">SLA Produção</label>
                    <input 
                      type="date"
                      required
                      value={newTask.deadlineSLA || ''}
                      className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:ring-2 focus:ring-blue-600`}
                      onChange={(e) => setNewTask({...newTask, deadlineSLA: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Data Publicação</label>
                    <input 
                      type="date"
                      required
                      value={newTask.publicationDate || ''}
                      className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:ring-2 focus:ring-blue-600`}
                      onChange={(e) => setNewTask({...newTask, publicationDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Link do Canva</label>
                    <input 
                      placeholder="https://www.canva.com/design/..."
                      value={newTask.links?.canva || ''}
                      className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:ring-2 focus:ring-blue-600`}
                      onChange={(e) => setNewTask({
                        ...newTask, 
                        links: { ...newTask.links!, canva: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Link do Drive</label>
                    <input 
                      placeholder="https://drive.google.com/..."
                      value={newTask.links?.drive || ''}
                      className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} outline-none focus:ring-2 focus:ring-blue-600`}
                      onChange={(e) => setNewTask({
                        ...newTask, 
                        links: { ...newTask.links!, drive: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Checklist de Otimização</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'hashtags', label: 'Hashtags Corretas' },
                      { id: 'localKeywords', label: 'Palavra-chave Local' },
                      { id: 'taggedAccounts', label: 'Contas Marcadas' },
                      { id: 'qualityChecked', label: 'Qualidade OK' }
                    ].map(item => (
                      <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input 
                          type="checkbox"
                          className="size-4 rounded-lg accent-blue-600"
                          checked={newTask.checklist?.[item.id as keyof typeof newTask.checklist]}
                          onChange={(e) => setNewTask({
                            ...newTask, 
                            checklist: { ...newTask.checklist!, [item.id]: e.target.checked }
                          })}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  {isEditing && editingTaskId && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (editingTaskId) {
                          handleDeleteTask(editingTaskId);
                          setIsTaskModalOpen(false);
                          setIsEditing(false);
                          setEditingTaskId(null);
                        }
                      }}
                      className="px-5 py-4 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                      title="Excluir Tarefa"
                    >
                      <Trash2 size={20} />
                      Excluir
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95"
                  >
                    {isEditing ? 'SALVAR ALTERAÇÕES' : 'CRIAR TAREFA'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
