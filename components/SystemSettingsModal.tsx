'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Moon, Sun, MapPin, Bell, Shield, LogOut, ChevronRight, Palette, Lock, Eye, EyeOff, Check, Camera, BellRing, Smartphone, Database, AlertCircle, BookOpen, Download, FileText, Copy, Settings } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { generateUserManualPDF } from '@/lib/generateManualPdf';
import { authFetch } from '@/lib/authFetch';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemSettingsModal({ isOpen, onClose }: SystemSettingsModalProps) {
  const { user, logout, isAdmin, login } = useRole();
  const { isDarkMode, toggleDarkMode, location, updateLocation, mapsApiKey, updateMapsApiKey } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [isResetting, setIsResetting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showSkillSuccess, setShowSkillSuccess] = useState(false);
  const [skillMessage, setSkillMessage] = useState('');
  const [showModulePermissions, setShowModulePermissions] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({
    leads: ['admin'],
    social_media: ['admin'],
    whatsapp: ['admin'],
    deliveries: ['admin', 'entregador'],
    transfers: ['admin', 'estoque'],
    warranties: ['admin', 'vendedor'],
    sales: ['admin', 'vendedor'],
    reports: ['admin']
  });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationSql, setMigrationSql] = useState<string | null>(null);
  
  // Maps API Verification State
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [showMapsKey, setShowMapsKey] = useState(false);
  const [isCopyingKey, setIsCopyingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    isValid: boolean | null;
    message: string | null;
    type: 'success' | 'error' | 'warning' | null;
  }>({ isValid: null, message: null, type: null });

  const handleVerifyApiKey = async () => {
    if (!mapsApiKey) {
      setKeyStatus({ isValid: false, message: 'Insira uma chave antes de testar.', type: 'warning' });
      return;
    }

    setIsVerifyingKey(true);
    setKeyStatus({ isValid: null, message: 'Verificando chave com os servidores do Google...', type: null });

    try {
      const response = await authFetch('/api/maps/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: mapsApiKey })
      });

      const data = await response.json();

      if (data.valid) {
        setKeyStatus({ 
          isValid: true, 
          message: data.message || 'Chave validada com sucesso!', 
          type: 'success' 
        });
      } else {
        setKeyStatus({ 
          isValid: false, 
          message: data.message || 'Chave inválida ou erro na API.', 
          type: 'error' 
        });
      }
    } catch (err: any) {
      setKeyStatus({ 
        isValid: false, 
        message: 'Erro ao conectar com o serviço de verificação.', 
        type: 'error' 
      });
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleCopyKey = async () => {
    if (!mapsApiKey) return;
    
    try {
      await navigator.clipboard.writeText(mapsApiKey);
      setIsCopyingKey(true);
      setTimeout(() => setIsCopyingKey(false), 2000);
    } catch (err) {
      console.error('Failed to copy key:', err);
    }
  };

  // Use a ref to track if we've already initialized permissions to avoid redundant updates
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && isAdmin) {
      initializedRef.current = true;
      fetchPermissions();
    }
  }, [isAdmin]);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'module_permissions')
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return;
        if (error.code === '42P17') {
          console.warn('Aviso: Recursão RLS no Supabase (42P17). Execute o script SQL no Supabase para corrigir.');
          return;
        }
        const isNetworkError = error.message?.includes('Failed to fetch') || error.message?.includes('TypeError');
        if (isNetworkError) {
          console.warn('Aviso: Conexão ao Supabase indisponível no momento para carregar permissões. Mantendo permissões padrão.');
          return;
        }
        throw error;
      }

      if (data?.value) {
        // Ensure 'admin' is in every module
        const val = data.value;
        Object.keys(val).forEach(key => {
          if (!val[key].includes('admin')) {
            val[key].push('admin');
          }
        });
        setPermissions(val);
      }
    } catch (error: any) {
      const isNetworkError = error?.message?.includes('Failed to fetch') || error?.name === 'TypeError' || error instanceof TypeError;
      if (isNetworkError) {
        console.warn('Aviso: Falha de rede ao conectar ao Supabase (offline).');
        return;
      }
      console.error('Error fetching permissions:', error);
    }
  };

  const handleTogglePermission = (module: string, role: string) => {
    if (role === 'admin') return; // Cannot toggle admin
    setPermissions(prev => {
      const current = prev[module] || [];
      const updated = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role];
      return { ...prev, [module]: updated };
    });
  };

  const savePermissions = async () => {
    setIsSavingPermissions(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'module_permissions', value: permissions });

      if (error) {
        console.error('Detailed Supabase Error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      setSkillMessage('Permissões atualizadas!');
      setShowSkillSuccess(true);
      setTimeout(() => setShowSkillSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      const msg = error.code === '42P01' 
        ? 'A tabela system_settings não existe. Use o botão "Corrigir Estrutura" abaixo.' 
        : (error.message || 'Erro desconhecido');
      alert(`Erro ao salvar permissões: ${msg}`);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const runMigration = async () => {
    setIsMigrating(true);
    setMigrationSql(null);
    try {
      const sql = `DO $$ 
BEGIN
    -- Tabela de Configurações do Sistema
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
        CREATE TABLE system_settings (
            key TEXT PRIMARY KEY,
            value JSONB DEFAULT '{}'::jsonb,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        -- Desabilita RLS para facilitar a configuração inicial
        ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
    END IF;

    -- Coluna de Usuário
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
        ALTER TABLE profiles ADD COLUMN username TEXT UNIQUE;
    END IF;

    -- Colunas de Permissões
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_leads') THEN
        ALTER TABLE profiles ADD COLUMN can_access_leads BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_deliveries') THEN
        ALTER TABLE profiles ADD COLUMN can_access_deliveries BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_transfers') THEN
        ALTER TABLE profiles ADD COLUMN can_access_transfers BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_warranties') THEN
        ALTER TABLE profiles ADD COLUMN can_access_warranties BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_whatsapp') THEN
        ALTER TABLE profiles ADD COLUMN can_access_whatsapp BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_social_media') THEN
        ALTER TABLE profiles ADD COLUMN can_access_social_media BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_sales') THEN
        ALTER TABLE profiles ADD COLUMN can_access_sales BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_reports') THEN
        ALTER TABLE profiles ADD COLUMN can_access_reports BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='receives_leads') THEN
        ALTER TABLE profiles ADD COLUMN receives_leads BOOLEAN DEFAULT true;
    END IF;

    -- Ajustar constraint de tipo na tabela de profiles para aceitar todas as roles/types
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_type_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_type_check CHECK (type IN ('admin', 'user', 'vendedor', 'entregador', 'estoque', 'gerente', 'supervisor'));

    -- Converter strings vazias para NULL para evitar violar constraints UNIQUE de email e username
    UPDATE profiles SET email = NULL WHERE email = '';
    UPDATE profiles SET username = NULL WHERE username = '';

    -- Tabela de Garantias (Warranties)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warranties') THEN
        CREATE TABLE warranties (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            protocol_number SERIAL,
            received_at DATE NOT NULL,
            received_by TEXT NOT NULL,
            defect TEXT NOT NULL,
            fiscal_document_type TEXT NOT NULL,
            fiscal_document_number TEXT NOT NULL,
            fiscal_document_date DATE NOT NULL,
            product TEXT NOT NULL,
            brand_supplier TEXT NOT NULL,
            observation TEXT,
            should_discard TEXT NOT NULL,
            process_responsible TEXT NOT NULL,
            type TEXT NOT NULL,
            assistance_name TEXT,
            assistance_phone TEXT,
            assistance_address TEXT,
            sent_at DATE,
            sent_by TEXT,
            reserved_in_system TEXT,
            nfe_remessa TEXT,
            nfe_retorno TEXT,
            returned_at DATE,
            returned_by TEXT,
            assistance_observation TEXT,
            status TEXT NOT NULL DEFAULT 'Aberto',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
        ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow all on warranties" ON warranties FOR ALL USING (true) WITH CHECK (true);
    ELSE
        -- Garantir que a coluna status existe na tabela warranties
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warranties' AND column_name='status') THEN
            ALTER TABLE warranties ADD COLUMN status TEXT NOT NULL DEFAULT 'Aberto';
        END IF;
    END IF;

    -- Reload PostgREST schema cache
    NOTIFY pgrst, 'reload schema';
END $$;`;
      
      setMigrationSql(sql);
      navigator.clipboard.writeText(sql);
      setSkillMessage('SQL de migração copiado para a área de transferência!');
      setShowSkillSuccess(true);
      setTimeout(() => setShowSkillSuccess(false), 3000);
    } catch (err) {
      console.error('Migration error:', err);
      setMigrationSql(`DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_leads') THEN
        ALTER TABLE profiles ADD COLUMN can_access_leads BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_deliveries') THEN
        ALTER TABLE profiles ADD COLUMN can_access_deliveries BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_transfers') THEN
        ALTER TABLE profiles ADD COLUMN can_access_transfers BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_warranties') THEN
        ALTER TABLE profiles ADD COLUMN can_access_warranties BOOLEAN DEFAULT false;
    END IF;

    -- Ajustar constraint de tipo na tabela de profiles para aceitar todas as roles/types
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_type_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_type_check CHECK (type IN ('admin', 'user', 'vendedor', 'entregador', 'estoque', 'gerente', 'supervisor'));

    -- Converter strings vazias para NULL para evitar violar constraints UNIQUE de email e username
    UPDATE profiles SET email = NULL WHERE email = '';
    UPDATE profiles SET username = NULL WHERE username = '';
END $$;`);
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const savedPush = localStorage.getItem('push_enabled');
      if (savedPush === 'true' && Notification.permission === 'granted') {
        setPushEnabled(true);
      }
    }
  }, []);

  const handleTogglePush = async () => {
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações push.');
      return;
    }

    if (Notification.permission === 'denied') {
      alert('As notificações foram bloqueadas. Por favor, habilite-as nas configurações do seu navegador.');
      return;
    }

    if (!pushEnabled) {
      let permission: NotificationPermission = Notification.permission;
      if (permission === 'default') {
        try {
          permission = await Notification.requestPermission();
        } catch (pErr) {
          console.warn('Permissão de notificação negada:', pErr);
        }
      }
      if (permission === 'granted') {
        setPushEnabled(true);
        localStorage.setItem('push_enabled', 'true');
        try {
          new Notification('Notificações Ativadas!', {
            body: 'Você receberá alertas sobre novas tarefas e atualizações de status.',
            icon: '/favicon.ico'
          });
        } catch (e) {
          console.warn('Erro ao disparar notificação local:', e);
        }
      }
    } else {
      setPushEnabled(false);
      localStorage.setItem('push_enabled', 'false');
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        const { error } = await supabase
          .from('profiles')
          .update({ image_url: base64 })
          .eq('id', user.id);

        if (error) throw error;

        const updatedUser = { ...user, image_url: base64 };
        login(user.type || 'user', updatedUser);
        
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    
    if (passwords.new !== passwords.confirm) {
      alert('A nova senha e a confirmação não coincidem.');
      return;
    }

    if (passwords.new.length < 4) {
      alert('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }

    setIsResetting(true);
    try {
      // 1. Atualizar via API administrativa segura (atualiza Supabase Auth e profiles)
      try {
        await authFetch('/api/collaborators', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            name: user.name,
            email: user.email,
            password: passwords.new
          })
        });
      } catch (apiErr) {
        console.warn('Erro ao atualizar senha via API:', apiErr);
      }

      // 2. Atualizar a senha na sessão ativa do cliente no Supabase Auth se aplicável
      try {
        await supabase.auth.updateUser({
          password: passwords.new
        });
      } catch (authError: any) {
        console.warn('Supabase Auth updateUser notice:', authError?.message);
      }

      setShowSuccess(true);
      setPasswords({ current: '', new: '', confirm: '' });
      setShowPasswordForm(false);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      alert('Erro ao redefinir senha: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className={`relative w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl transition-colors duration-300 ${
              isDarkMode ? 'bg-slate-900 border border-slate-800 text-slate-100' : 'bg-white text-slate-900'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <h2 className="text-xl font-bold tracking-tight">Ajustes do Sistema</h2>
              <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
              {/* Profile Card */}
              <div className={`p-4 rounded-2xl border flex items-center gap-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <div 
                  onClick={handlePhotoClick}
                  className="relative size-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-600/20 cursor-pointer group overflow-hidden shrink-0"
                >
                  {user?.image_url ? (
                    <Image 
                      src={user.image_url} 
                      alt={user.name} 
                      fill 
                      className="object-cover"
                    />
                  ) : (
                    String(user?.name || 'U').charAt(0)
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isUploading ? (
                      <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Camera size={16} className="text-white" />
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base truncate">{user?.name || 'Usuário'}</h3>
                  <p className="text-xs text-slate-500 truncate">{user?.role || 'Colaborador'}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shrink-0 ${isAdmin ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/60' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {isAdmin ? 'Admin' : 'Membro'}
                </span>
              </div>

              {/* Acesso Direto às Configurações Gerais do Sistema */}
              {isAdmin && (
                <Link
                  href="/admin/settings"
                  onClick={onClose}
                  className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20 hover:from-blue-500 hover:to-indigo-500 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-xs text-white">
                      <Settings size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">Painel de Configurações do Sistema</h4>
                      <p className="text-[11px] text-blue-100 opacity-90">Módulos, Webhooks, WhatsApp, Multi-Tenant e Logs</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-white/80 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}

              {/* Appearance */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Aparência</label>
                <div className={`flex p-1 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200/60'}`}>
                  <button 
                    onClick={() => toggleDarkMode(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${!isDarkMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Sun size={18} /> Diurno
                  </button>
                  <button 
                    onClick={() => toggleDarkMode(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${isDarkMode ? 'bg-slate-700 shadow-sm text-blue-400' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <Moon size={18} /> Noturno
                  </button>
                </div>
              </div>

              {/* PDF User Guide / Manual Card */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Documentação & Treinamento</label>
                <div className={`p-4 rounded-2xl border transition-all ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-blue-950/40 to-slate-900 border-blue-900/60' 
                    : 'bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border-blue-200/80 shadow-sm'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20 shrink-0 mt-0.5">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          Manual do Aplicativo (PDF)
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            Completo
                          </span>
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          Guia instrutivo passo a passo detalhando o uso de cada função do sistema: Tarefas, Vendas, Entregas, Transferências, Garantias, WhatsApp e Segurança.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={generateUserManualPDF}
                    className="w-full mt-3.5 h-11 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    <Download size={15} />
                    <span>Baixar / Imprimir Manual em PDF</span>
                  </button>
                </div>
              </div>

              {/* Location & Maps API Key */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Preferências & Integração</label>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 ml-1">
                      <MapPin size={14} /> Localização de Trabalho
                    </div>
                    <input 
                      type="text" 
                      value={location}
                      onChange={(e) => updateLocation(e.target.value)}
                      placeholder="ex: Escritório Central"
                      className={`w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 focus:ring-blue-600/20 transition-all font-medium ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'
                      }`}
                    />
                  </div>

                  <div id="google-maps-config-card" className={`p-4 rounded-2xl border transition-all ${
                    isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-200/60 shadow-sm'
                  }`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                          <Shield size={14} className="text-blue-500" /> GOOGLE_MAPS_PLATFORM_KEY
                        </div>
                        <button
                          onClick={handleVerifyApiKey}
                          disabled={isVerifyingKey}
                          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                            isDarkMode 
                              ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' 
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          } disabled:opacity-50`}
                        >
                          {isVerifyingKey ? (
                            <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Testar Validade
                        </button>
                      </div>
                      
                      <div className="relative group flex gap-2">
                        <div className="relative flex-1">
                          <input 
                            type={showMapsKey ? "text" : "password"} 
                            value={mapsApiKey}
                            onChange={(e) => {
                              updateMapsApiKey(e.target.value);
                              setKeyStatus({ isValid: null, message: null, type: null });
                            }}
                            placeholder="Insira sua chave de API do Google Maps"
                            className={`w-full h-12 pl-4 pr-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-600/20 transition-all font-medium text-sm ${
                              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowMapsKey(!showMapsKey)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            {showMapsKey ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleCopyKey}
                          disabled={!mapsApiKey}
                          className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border transition-all ${
                            isCopyingKey 
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                              : isDarkMode 
                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' 
                                : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-blue-600 hover:bg-white hover:shadow-sm'
                          } disabled:opacity-50`}
                          title="Copiar Chave"
                        >
                          {isCopyingKey ? <Check size={20} className="animate-in zoom-in" /> : <Copy size={20} />}
                        </button>
                      </div>

                      {keyStatus.message && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                            keyStatus.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' :
                            keyStatus.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400' :
                            keyStatus.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' :
                            'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                          }`}
                        >
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <p className="text-[11px] font-medium leading-relaxed">{keyStatus.message}</p>
                        </motion.div>
                      )}

                      <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100/50 dark:border-blue-900/30">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          <span className="font-bold text-blue-600 dark:text-blue-400">Dica:</span> Certifique-se de que a 
                          <span className="font-bold"> Geocoding API</span> e a 
                          <span className="font-bold"> Maps JavaScript API</span> estejam habilitadas no Console do Google Cloud.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security & Notifications */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Sistema</label>
                <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
                  {/* Password Toggle */}
                  <div 
                    className={`p-4 flex items-center justify-between border-b cursor-pointer hover:bg-slate-50/50 transition-colors ${isDarkMode ? 'border-slate-700' : 'border-slate-50'}`}
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                        <Lock size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Segurança</p>
                        <p className="text-[10px] text-slate-500">Alterar senha de acesso</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className={`text-slate-300 transition-transform ${showPasswordForm ? 'rotate-90' : ''}`} />
                  </div>

                  <AnimatePresence>
                    {showPasswordForm && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 space-y-4"
                      >
                        <form onSubmit={handlePasswordReset} className="space-y-4 pt-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Senha Atual</label>
                            <div className="relative">
                              <input 
                                required
                                type={showCurrentPassword ? "text" : "password"}
                                value={passwords.current}
                                onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                                className={`w-full h-11 pl-4 pr-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-600/20 transition-all font-medium text-sm ${
                                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'
                                }`}
                              />
                              <button 
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nova Senha</label>
                            <div className="relative">
                              <input 
                                required
                                type={showNewPassword ? "text" : "password"}
                                value={passwords.new}
                                onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                                className={`w-full h-11 pl-4 pr-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-600/20 transition-all font-medium text-sm ${
                                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'
                                }`}
                              />
                              <button 
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          <button 
                            type="submit"
                            disabled={isResetting}
                            className="w-full h-11 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 text-sm"
                          >
                            {isResetting ? (
                              <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                              'Atualizar Senha'
                            )}
                          </button>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Push Notifications */}
                  <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${pushEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        <Bell size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Notificações Push</p>
                        <p className="text-[10px] text-slate-500">Alertas de status de tarefas</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={pushEnabled}
                        onChange={handleTogglePush}
                      />
                      <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {pushEnabled && (
                    <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                          <Smartphone size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Teste de Alerta</p>
                          <p className="text-[10px] text-slate-500">Verificar notificações</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          new Notification('Teste de Notificação', {
                            body: 'As notificações estão funcionando corretamente!',
                            icon: '/favicon.ico'
                          });
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Testar
                      </button>
                    </div>
                  )}

                  {/* Privacy */}
                  <div className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-indigo-950/60 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Shield size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Privacidade</p>
                        <p className="text-[10px] text-slate-500">Segurança e dados</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Admin Module Management */}
              {isAdmin && (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Administração</label>
                  <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div 
                      className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors ${showModulePermissions ? 'border-b' : ''} ${isDarkMode ? 'border-slate-700' : 'border-slate-50'}`}
                      onClick={() => setShowModulePermissions(!showModulePermissions)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                          <Shield size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Gestão de Módulos</p>
                          <p className="text-[10px] text-slate-500">Configurar acessos por cargo</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`text-slate-300 transition-transform ${showModulePermissions ? 'rotate-90' : ''}`} />
                    </div>

                    <AnimatePresence>
                      {showModulePermissions && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="p-4 space-y-6"
                        >
                          {/* Database Fix Section */}
                          <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}>
                            <div className="flex items-start gap-3 mb-4">
                              <Database className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-amber-500">Manutenção de Dados</h4>
                                <p className="text-[10px] text-slate-500 leading-relaxed">
                                  Se você está vendo erros de &quot;coluna não encontrada&quot; ao editar colaboradores, 
                                  clique abaixo para atualizar a estrutura da tabela no Supabase.
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={runMigration}
                              disabled={isMigrating}
                              className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                isDarkMode ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20'
                              } disabled:opacity-50`}
                            >
                              {isMigrating ? (
                                <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Database size={12} />
                                  {migrationSql ? 'Tentar Novamente' : 'Corrigir Estrutura do Banco'}
                                </>
                              )}
                            </button>

                            {migrationSql && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-4 space-y-3"
                              >
                                <div className="flex items-center gap-2 text-rose-500 text-[10px] font-bold uppercase">
                                  <AlertCircle size={12} />
                                  Falha na execução automática
                                </div>
                                <p className="text-[10px] text-slate-500">
                                  O seu projeto Supabase não permite execução remota de SQL. 
                                  Copie o código abaixo e cole no <b>SQL Editor</b> do seu painel Supabase:
                                </p>
                                <div className={`p-3 rounded-lg font-mono text-[9px] break-all border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                                  {migrationSql}
                                </div>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(migrationSql);
                                    setSkillMessage('SQL Copiado!');
                                    setShowSkillSuccess(true);
                                    setTimeout(() => setShowSkillSuccess(false), 2000);
                                  }}
                                  className="w-full py-2 bg-slate-800 text-white text-[9px] font-bold uppercase rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                  Copiar Código SQL
                                </button>
                              </motion.div>
                            )}
                          </div>

                          <div className="overflow-x-auto -mx-4 px-4">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr>
                                  <th className="pb-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">Módulo</th>
                                  {['Admin', 'Ger.', 'Vend.', 'Estoque', 'Entreg.', 'Colab.'].map(role => (
                                    <th key={role} className="pb-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider px-2">{role}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {[
                                  { id: 'leads', label: 'Leads' },
                                  { id: 'social_media', label: 'Redes S.' },
                                  { id: 'whatsapp', label: 'WhatsApp' },
                                  { id: 'deliveries', label: 'Entregas' },
                                  { id: 'transfers', label: 'Transf.' },
                                  { id: 'sales', label: 'Vendas' },
                                  { id: 'warranties', label: 'Garantias' },
                                  { id: 'reports', label: 'Relatórios' }
                                ].map(mod => (
                                  <tr key={mod.id}>
                                    <td className="py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{mod.label}</td>
                                    {['admin', 'gerente', 'vendedor', 'estoque', 'entregador', 'user'].map(role => (
                                      <td key={role} className="py-3 text-center px-1">
                                        <button
                                          onClick={() => handleTogglePermission(mod.id, role)}
                                          disabled={role === 'admin'}
                                          className={`size-6 rounded-lg flex items-center justify-center transition-all mx-auto ${
                                            permissions[mod.id]?.includes(role)
                                              ? 'bg-blue-600 text-white shadow-sm'
                                              : isDarkMode ? 'bg-slate-800 text-slate-600 border border-slate-700' : 'bg-slate-100 text-slate-300'
                                          } ${role === 'admin' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}`}
                                        >
                                          {permissions[mod.id]?.includes(role) && <Check size={14} />}
                                        </button>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <button 
                            onClick={savePermissions}
                            disabled={isSavingPermissions}
                            className="w-full h-11 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 text-sm"
                          >
                            {isSavingPermissions ? (
                              <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                              'Salvar Configurações'
                            )}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Logout */}
              <button 
                onClick={() => {
                  setIsLoggingOut(true);
                  logout();
                  onClose();
                }}
                disabled={isLoggingOut}
                className="w-full h-14 flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200/80 dark:border-rose-900/60 rounded-2xl transition-colors active:scale-[0.98] disabled:opacity-70"
              >
                <LogOut size={20} />
                <span>{isLoggingOut ? 'Saindo...' : 'Sair da Conta'}</span>
              </button>
              
              <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] pt-4 pb-8">Versão 2.4.0 • Gestão Pro</p>
            </div>

            {/* Success Messages */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[210] whitespace-nowrap text-sm"
                >
                  <Check size={18} />
                  Senha Alterada com Sucesso!
                </motion.div>
              )}
              {showSkillSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[210] whitespace-nowrap text-sm"
                >
                  <Check size={18} />
                  {skillMessage}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
