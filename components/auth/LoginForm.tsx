'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, User, Lock, ArrowRight, LayoutGrid, Mail } from 'lucide-react';
import { Role } from '@/hooks/useRole';
import { supabase } from '@/lib/supabase';
import { getInactiveCollaboratorIds } from '@/lib/collaboratorStatus';

interface LoginFormProps {
  onLogin: (role: any, userData: any) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);

  const handleEmailRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Por favor, digite um e-mail válido.');
      setIsLoading(false);
      return;
    }

    try {
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/reset-password`
        : '/reset-password';

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        throw resetError;
      }

      setRecoveryEmailSent(true);
    } catch (err: any) {
      console.error('Erro ao enviar e-mail de recuperação:', err);
      setError(err?.message || 'Não foi possível enviar o e-mail de recuperação. Verifique o endereço digitado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const cleanInput = username.trim();
      let targetEmail = cleanInput.toLowerCase();
      let profileUser: any = null;

      // 1. Tentar resolver o e-mail via RPC seguro 'login_lookup' ou fallback por username
      if (!cleanInput.includes('@')) {
        try {
          const { data: lookupData } = await supabase.rpc('login_lookup', { p_identifier: cleanInput });
          if (Array.isArray(lookupData) && lookupData.length > 0 && lookupData[0]?.email) {
            targetEmail = lookupData[0].email.toLowerCase();
          } else if (lookupData && typeof lookupData === 'object' && (lookupData as any).email) {
            targetEmail = (lookupData as any).email.toLowerCase();
          } else {
            const { data: userFromDb } = await supabase
              .from('profiles')
              .select('email')
              .ilike('username', cleanInput)
              .maybeSingle();
            if (userFromDb?.email) {
              targetEmail = userFromDb.email.toLowerCase();
            }
          }
        } catch (_) {
          const { data: userFromDb } = await supabase
            .from('profiles')
            .select('email')
            .ilike('username', cleanInput)
            .maybeSingle();
          if (userFromDb?.email) {
            targetEmail = userFromDb.email.toLowerCase();
          }
        }
      }

      if (!targetEmail.includes('@')) {
        throw new Error('E-mail não encontrado para o usuário informado.');
      }

      // 2. Autenticação obrigatória com o Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password
      });

      if (authError || !authData?.user) {
        throw new Error(authError?.message?.includes('Invalid login credentials') 
          ? 'E-mail/usuário ou senha incorretos.' 
          : (authError?.message || 'Falha ao autenticar no Supabase Auth.'));
      }

      const authUser = authData.user;

      // 3. Buscar perfil atualizado no Supabase se não foi buscado antes
      if (!profileUser || profileUser.id !== authUser.id) {
        const { data: matchingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (matchingProfile) {
          profileUser = matchingProfile;
        }
      }

      const finalUser = profileUser || {
        id: authUser.id,
        name: authUser.user_metadata?.name || targetEmail.split('@')[0],
        email: targetEmail,
        type: (authUser.user_metadata?.role === 'admin' ? 'admin' : 'user') as Role
      };

      const isUserInactive = finalUser.status === 'Inativo' || getInactiveCollaboratorIds().includes(finalUser.id);
      if (isUserInactive) {
        await supabase.auth.signOut().catch(() => {});
        throw new Error('Sua conta de colaborador foi inativada. Entre em contato com a administração.');
      }

      onLogin((finalUser.type || finalUser.role || 'user') as Role, finalUser);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showRecovery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
        >
          <div className="text-center mb-8">
            <div className="size-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Recuperar Senha</h2>
            <p className="text-slate-500 mt-2">
              Informe seu e-mail cadastrado para receber as instruções de redefinição de senha.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-medium text-center">
              {error}
            </div>
          )}

          {recoveryEmailSent ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-sm font-semibold">
                Enviamos um link de redefinição para <strong>{recoveryEmail}</strong>. Verifique sua caixa de entrada e spam.
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRecovery(false);
                  setRecoveryEmailSent(false);
                  setRecoveryEmail('');
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
              >
                Voltar para o Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailRecovery} className="space-y-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="Seu e-mail cadastrado"
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
              >
                {isLoading ? (
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Enviar E-mail de Recuperação'
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowRecovery(false)}
                className="w-full text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Voltar para o Login
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100"
      >
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
              <LayoutGrid size={32} />
            </div>
          </div>
          
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-slate-900">Bem-vindo de volta</h1>
            <p className="text-slate-500 mt-2">Informe suas credenciais para acessar o sistema</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-medium text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Seu usuário ou e-mail"
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                type="button"
                onClick={() => setShowRecovery(true)}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 shadow-lg shadow-blue-600/20"
            >
              {isLoading ? (
                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Acessar Sistema
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
            Gestão de Tarefas
          </p>
        </div>
      </motion.div>
    </div>
  );
}
