'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Search, Plus, User, Target, Trash2, ShieldCheck, Copy, Check, X, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { useUI } from '@/hooks/useUI';
import { LoginForm } from '@/components/auth/LoginForm';
import { supabase } from '@/lib/supabase';
import { applyStatusToProfiles } from '@/lib/collaboratorStatus';
import { useDataPrefetch } from '@/hooks/useDataPrefetch';
import { authFetch } from '@/lib/authFetch';

const isSupabaseConfigured = 
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '') &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key';

const PAGE_SIZE = 12;

const FIX_AUTH_TRIGGER_SQL = `-- 1. Remove o trigger antigo que falhava ao tentar inserir colunas inexistentes na tabela profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Garante a existência de colunas complementares para máxima compatibilidade
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- 3. Remove a chave estrangeira restritiva 'fk_auth_user' para permitir cadastro flexível de colaboradores
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_auth_user;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 4. Recria a função de sincronização do Supabase Auth com a tabela public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    username,
    type,
    role,
    phone,
    image_url,
    status,
    active,
    must_change_password,
    created_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(
      CASE 
        WHEN LOWER(NEW.raw_user_meta_data->>'type') IN ('admin', 'user', 'vendedor', 'entregador', 'estoque', 'gerente', 'supervisor') 
        THEN LOWER(NEW.raw_user_meta_data->>'type') 
        ELSE 'user' 
      END, 
      'user'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Colaborador'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'image_url'),
    'Ativo',
    true,
    false,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    type = COALESCE(public.profiles.type, EXCLUDED.type);

  RETURN NEW;
END;
$$;

-- 5. Ativa o trigger limpo e compatível em auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Permissões de execução
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, postgres, authenticated, anon;

-- 7. Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';`;

export default function CollaboratorsPage() {
  const { isAdmin, isAuthenticated, isLoading: roleLoading, login } = useRole();
  const { isDarkMode } = useTheme();
  const { showToast, showConfirm } = useUI();
  const { getCachedCollaborators, prefetchCollaborators } = useDataPrefetch();
  
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [statusTab, setStatusTab] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback((node: HTMLAnchorElement | null) => {
    if (loading || isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, isFetchingMore, hasMore]);

  const fetchCollaborators = useCallback(async (currentPage: number, searchTarget: string, currentStatusTab: 'ativos' | 'inativos' | 'todos', append = false) => {
    // 1. Tentar renderização instantânea do cache se for primeira página sem busca
    if (currentPage === 0 && !searchTarget && !append) {
      const cached = getCachedCollaborators();
      if (Array.isArray(cached) && cached.length > 0) {
        let processed = cached;
        if (currentStatusTab === 'ativos') {
          processed = processed.filter(p => p.status !== 'Inativo');
        } else if (currentStatusTab === 'inativos') {
          processed = processed.filter(p => p.status === 'Inativo');
        }
        setCollaborators(processed.slice(0, PAGE_SIZE));
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else if (currentPage === 0) {
      setLoading(true);
    } else {
      setIsFetchingMore(true);
    }

    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .not('role', 'ilike', '%entrega%')
        .not('type', 'eq', 'entregador')
        .order('name');
      
      if (searchTarget) {
        query = query.ilike('location', `%${searchTarget}%`);
      }

      query = query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
      
      let { data, error } = await query;
      
      if (error) {
        if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
          console.warn('Política recursiva (42P17) em profiles detectada. Ativando rota de contingência /api/collaborators...');
          try {
            const res = await authFetch('/api/collaborators');
            const json = await res.json();
            if (json?.collaborators?.length) {
              data = json.collaborators.filter((c: any) => 
                c.type !== 'entregador' && !c.role?.toLowerCase()?.includes('entrega')
              );
              error = null;
            }
          } catch (apiErr) {
            console.warn('Falha no fallback de colaboradores:', apiErr);
          }
        }
        if (error) throw error;
      }
      
      if (data) {
        let processed = applyStatusToProfiles(data);
        if (currentStatusTab === 'ativos') {
          processed = processed.filter(p => p.status !== 'Inativo');
        } else if (currentStatusTab === 'inativos') {
          processed = processed.filter(p => p.status === 'Inativo');
        }

        if (append) {
          setCollaborators(prev => [...prev, ...processed]);
        } else {
          setCollaborators(processed);
        }
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      setPage(0);
      fetchCollaborators(0, locationSearch, statusTab, false);
    }
  }, [isAuthenticated, isAdmin, locationSearch, statusTab, fetchCollaborators]);

  useEffect(() => {
    if (page > 0) {
      fetchCollaborators(page, locationSearch, statusTab, true);
    }
  }, [page, locationSearch, statusTab, fetchCollaborators]);

  useEffect(() => {
    // Real-time subscription
    let channel: any;
    if (isAuthenticated && isAdmin) {
      channel = supabase
        .channel('public:profiles-collaborators-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          // If a change occurs, optionally we can reset the pagination
          setPage(0);
          fetchCollaborators(0, locationSearch, statusTab, false);
        })
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [isAuthenticated, isAdmin, locationSearch, fetchCollaborators]);

  const handleDeleteCollaborator = (e: React.MouseEvent, person: any) => {
    e.preventDefault();
    e.stopPropagation();

    showConfirm({
      title: 'Excluir Cadastro do Colaborador',
      message: `Tem certeza que deseja excluir permanentemente o cadastro de "${person.name || 'este colaborador'}"? Esta ação removerá o perfil do sistema.`,
      type: 'danger',
      confirmLabel: 'Excluir Cadastro',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          const apiRes = await fetch(`/api/collaborators?id=${person.id}`, {
            method: 'DELETE'
          });
          const apiJson = await apiRes.json();

          if (!apiRes.ok && apiJson.error) {
            const { error: sbError } = await supabase.from('profiles').delete().eq('id', person.id);
            if (sbError) {
              console.warn('Erro na exclusão direta Supabase:', sbError.message);
              await supabase.from('profiles').update({ status: 'Inativo' }).eq('id', person.id);
            }
          }

          setCollaborators(prev => prev.filter(c => c.id !== person.id));
          showToast('Cadastro do colaborador excluído com sucesso!', 'success');
        } catch (err) {
          console.error('Erro ao excluir colaborador:', err);
          showToast('Erro ao excluir colaborador.', 'error');
        }
      }
    });
  };

  if (roleLoading || (loading && isAuthenticated && isAdmin && page === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="p-4 bg-rose-50 rounded-full text-rose-600 mb-4">
          <User size={48} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Acesso Restrito</h1>
        <p className="text-slate-500 mt-2">Apenas administradores podem visualizar a equipe.</p>
        <Link href="/" className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
          Voltar para o Início
        </Link>
      </div>
    );
  }
  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`sticky top-0 z-10 backdrop-blur-md border-b transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center p-4 justify-between w-full">
          <Link href="/" className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">Membros da Equipe</h2>
          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 rounded-xl transition-all shadow-xs shrink-0"
            title="Ver script SQL de sincronização e permissões do Supabase"
          >
            <ShieldCheck size={14} className="text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Script SQL</span>
          </button>
        </div>
      </header>

      {/* Modal de Correção SQL Supabase */}
      <AnimatePresence>
        {showSqlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 rounded-2xl text-amber-700 dark:text-amber-400">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Correção do Trigger Supabase</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Atualize a função trigger do banco para salvar novos colaboradores sem conflitos
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="py-4 space-y-4 overflow-y-auto flex-1 text-xs">
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl text-amber-900 dark:text-amber-300">
                  <p className="font-semibold text-xs mb-1">Por que isso é necessário?</p>
                  <p className="text-[11px] leading-relaxed">
                    Se o cadastro de novos colaboradores não estiver salvando, isso ocorre porque o trigger <code className="bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono">handle_new_user</code> ou a chave estrangeira <code className="font-mono">fk_auth_user</code> estão bloqueando inserções no banco. Execute o script abaixo no <b>SQL Editor</b> do painel Supabase para destravar.
                  </p>
                </div>

                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-60 border border-slate-800">
                    {FIX_AUTH_TRIGGER_SQL}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(FIX_AUTH_TRIGGER_SQL);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 3000);
                    }}
                    className="absolute top-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                  >
                    {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                    {copiedSql ? 'Copiado!' : 'Copiar SQL'}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <a
                    href="https://supabase.com/dashboard/project/xzwjefuzmkcgdfzojeqp/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    <ExternalLink size={14} />
                    <span>Abrir SQL Editor no Supabase</span>
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(FIX_AUTH_TRIGGER_SQL);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 3000);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Copy size={14} />
                    <span>{copiedSql ? 'SQL Copiado para Área de Transferência' : 'Copiar Código SQL'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="px-5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto pb-32 p-4">
        {!isSupabaseConfigured && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <p className="font-bold mb-1">Configuração Pendente</p>
            <p>O Supabase não está configurado. Adicione as chaves de API nas configurações do projeto para habilitar o salvamento de dados.</p>
          </div>
        )}
        
        <Link href="/collaborators/new"
          className={`w-full flex items-center justify-center gap-2 border-2 border-dashed p-4 rounded-xl transition-all group mb-4 ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-800 text-slate-500 hover:border-blue-600 hover:text-blue-400' 
              : 'bg-white border-slate-200 text-slate-500 hover:border-blue-600 hover:text-blue-600'
          }`}
        >
          <Plus size={20} className="group-hover:scale-110 transition-transform" />
          <span className="font-bold">Adicionar Novo Colaborador</span>
        </Link>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 mb-4 rounded-xl bg-slate-200/60 dark:bg-slate-900/60 text-xs font-bold">
          <button
            onClick={() => setStatusTab('ativos')}
            className={`flex-1 py-2 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              statusTab === 'ativos'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="size-2 rounded-full bg-emerald-500"></span>
            Ativos
          </button>
          <button
            onClick={() => setStatusTab('inativos')}
            className={`flex-1 py-2 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              statusTab === 'inativos'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="size-2 rounded-full bg-rose-500"></span>
            Inativos (Desligados)
          </button>
          <button
            onClick={() => setStatusTab('todos')}
            className={`flex-1 py-2 px-3 rounded-lg transition-all text-center ${
              statusTab === 'todos'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todos
          </button>
        </div>

        {/* Search by Sector */}
        <div className="mb-6 relative">
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <Target size={18} />
          </div>
          <input
            type="text"
            placeholder="Filtrar por setor (Ex: Vendas, Estoque...)"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            className={`w-full pl-12 pr-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-600/20 ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-blue-600' 
                : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600'
            }`}
          />
          {locationSearch && (
            <button 
              onClick={() => setLocationSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <Plus size={18} className="rotate-45" />
            </button>
          )}
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {collaborators.map((person: any, idx: number) => {
            const isLastElement = collaborators.length === idx + 1;
            const isInactive = person.status === 'Inativo';
            
            return (
              <Link 
                ref={isLastElement ? lastElementRef : null}
                key={`${person.id}-${idx}`}
                href={`/collaborators/${person.id}`}
                className={`flex flex-col items-center p-4 rounded-xl border transition-all group relative ${
                  isInactive ? 'opacity-70 bg-slate-100/50 dark:bg-slate-900/30 border-dashed border-rose-300 dark:border-rose-950' :
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 hover:border-blue-600/50' 
                    : 'bg-white border-slate-100 hover:border-blue-600/50 shadow-sm hover:shadow-md'
                }`}
              >
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCollaborator(e, person)}
                    className="absolute top-2.5 right-2.5 size-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Excluir Colaborador"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <div className="relative h-16 w-16 mb-3 shrink-0">
                  <Image
                    src={person.image_url || `https://picsum.photos/seed/${person.id}/200`}
                    alt={person.name || 'Colaborador'}
                    fill
                    className={`rounded-full object-cover border-2 ${isInactive ? 'border-rose-300 grayscale-[40%]' : isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
                    referrerPolicy="no-referrer"
                  />
                  <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${isDarkMode ? 'border-slate-900' : 'border-white'} ${
                    isInactive ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}></span>
                </div>
                
                <div className="text-center min-w-0 w-full">
                  <p className={`text-xs font-bold truncate ${isInactive ? 'text-rose-600 dark:text-rose-400' : isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{person.name}</p>
                  <p className={`text-[10px] truncate mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{person.role}</p>
                  
                  {isInactive ? (
                    <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 inline-block">
                      Inativo (Ex-colaborador)
                    </span>
                  ) : person.location && (
                    <p className={`text-[9px] font-medium uppercase tracking-tighter mt-1 px-1.5 py-0.5 rounded-md inline-block ${
                      isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {person.location}
                    </p>
                  )}
                  <div className="flex flex-wrap justify-center gap-1 mt-2">
                    {(person.type === 'admin' || person.can_access_leads) && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold uppercase tracking-wider">Leads</span>
                    )}
                    {(person.type === 'admin' || person.can_access_deliveries) && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider">Entregas</span>
                    )}
                    {(person.type === 'admin' || person.can_access_transfers) && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider">Transf.</span>
                    )}
                    {(person.type === 'admin' || person.can_access_warranties) && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold uppercase tracking-wider">Garant.</span>
                    )}
                    {(person.type === 'admin' || person.can_access_reports) && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold uppercase tracking-wider">Relat.</span>
                    )}
                    {(person.type === 'admin' || person.can_access_whatsapp) && (
                      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[9px] font-bold uppercase tracking-wider">WhatsApp</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        
        {/* Loading Spinner for Lazy Loading */}
        {isFetchingMore && (
          <div className="flex justify-center items-center py-6">
            <div className={`size-6 border-4 rounded-full animate-spin ${
              isDarkMode ? 'border-slate-800 border-t-blue-500' : 'border-slate-200 border-t-blue-600'
            }`} />
          </div>
        )}
        
        {!hasMore && collaborators.length > 0 && !loading && (
          <p className="text-center text-xs text-slate-500 py-6">Fim da lista de colaboradores.</p>
        )}
      </main>
    </div>
  );
}
