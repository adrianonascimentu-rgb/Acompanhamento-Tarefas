'use client';

import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, User, Mail, Phone, Briefcase, MapPin, Send, Check, X, ShieldCheck, Users, CheckSquare, Square, Target, Package, Truck, MessageCircle, BarChart3, Copy, AlertTriangle, ExternalLink } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import { SkillSelector } from '@/components/SkillSelector';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/authFetch';

const isSupabaseConfigured = 
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '') &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key';

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

export default function NewCollaboratorPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const { isDarkMode } = useTheme();
  const { isAdmin: isSystemAdmin } = useRole();
  const [userRole, setUserRole] = useState<'user' | 'admin' | 'vendedor' | 'estoque'>('user');
  const [canAccessLeads, setCanAccessLeads] = useState(false);
  const [canAccessDeliveries, setCanAccessDeliveries] = useState(false);
  const [canAccessTransfers, setCanAccessTransfers] = useState(false);
  const [canAccessWarranties, setCanAccessWarranties] = useState(false);
  const [canAccessReports, setCanAccessReports] = useState(false);
  const [canAccessWhatsapp, setCanAccessWhatsapp] = useState(false);
  const [receivesLeads, setReceivesLeads] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    role: '',
    email: '',
    phone: '',
    location: '',
    password: ''
  });

  const [systemPermissions, setSystemPermissions] = useState<Record<string, string[]>>({});

  React.useEffect(() => {
    async function fetchSystemPermissions() {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'module_permissions')
          .single();
        if (data?.value) {
          setSystemPermissions(data.value);
        }
      } catch (err: any) {
        const isNetworkError = err?.message?.includes('Failed to fetch') || err?.name === 'TypeError' || err instanceof TypeError;
        if (!isNetworkError) {
          console.error('Error fetching system permissions:', err);
        }
      }
    }
    fetchSystemPermissions();
  }, []);

  const handleRoleChange = (role: typeof userRole) => {
    setUserRole(role);
    if (role === 'admin') {
      setCanAccessLeads(true);
      setCanAccessDeliveries(true);
      setCanAccessTransfers(true);
      setCanAccessWarranties(true);
    } else {
      // Set defaults from system permissions
      setCanAccessLeads(systemPermissions.leads?.includes(role) || false);
      setCanAccessDeliveries(systemPermissions.deliveries?.includes(role) || false);
      setCanAccessTransfers(systemPermissions.transfers?.includes(role) || false);
      setCanAccessWarranties(systemPermissions.warranties?.includes(role) || false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB.');
        return;
      }
      
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        // Create an image element to resize
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimensions
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Converte o canvas para Blob binário com 80% de qualidade para o Supabase Storage
          canvas.toBlob((blob) => {
            if (blob) {
              setImageBlob(blob);
            }
          }, 'image/jpeg', 0.8);

          // Preview imediato para a interface
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setPhoto(dataUrl);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSupabaseConfigured) {
      alert('Configuração do Supabase ausente. Por favor, adicione as chaves NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY nas configurações do projeto.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const cleanName = formData.name?.trim();
      const cleanEmail = formData.email?.trim() ? formData.email.trim().toLowerCase() : null;
      const cleanUsername = formData.username?.trim() ? formData.username.trim().toLowerCase() : null;
      const cleanPhone = formData.phone?.trim() ? formData.phone.trim() : null;
      const cleanLocation = formData.location?.trim() ? formData.location.trim() : null;
      const cleanPassword = formData.password?.trim() ? formData.password.trim() : null;

      if (!cleanName) {
        throw new Error('Por favor, informe o nome do colaborador.');
      }

      if (!cleanEmail) {
        throw new Error('Por favor, informe o e-mail do colaborador para criação da conta no Supabase Auth.');
      }

      if (!cleanPassword || cleanPassword.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres para cadastro no Supabase Auth.');
      }

      // Pre-flight check: Verify if email is already in use by another collaborator
      if (cleanEmail) {
        const { data: existingEmail } = await supabase
          .from('profiles')
          .select('id, name')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (existingEmail) {
          throw new Error(`O e-mail "${cleanEmail}" já está cadastrado para o colaborador "${existingEmail.name}". Por favor, utilize outro endereço de e-mail.`);
        }
      }

      // Pre-flight check: Verify if username is already in use
      if (cleanUsername) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id, name')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (existingUser) {
          throw new Error(`O nome de usuário "${cleanUsername}" já está em uso pelo colaborador "${existingUser.name}". Por favor, escolha outro nome de usuário.`);
        }
      }

      // Database constraint profiles_type_check expects 'admin' or 'user'
      const dbType = userRole === 'admin' ? 'admin' : 'user';

      let avatarUrl = photo || `https://picsum.photos/seed/${cleanName.toLowerCase().replace(/\s+/g, '-')}/200`;

      // Upload do arquivo binário real para o bucket 'avatars' no Supabase Storage se uma foto foi selecionada
      if (imageBlob) { 
        const tempId = Math.random().toString(36).substring(2, 9);
        const fileName = `collab-${tempId}-${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, imageBlob, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: true
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        } else {
          try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', imageBlob, fileName);
            uploadFormData.append('fileName', fileName);
            const res = await fetch('/api/upload-avatar', {
              method: 'POST',
              body: uploadFormData
            });
            const resData = await res.json();
            if (resData?.url) {
              avatarUrl = resData.url;
            }
          } catch (_) {}
        }
      }

      // Envia criação para a API segura com service_role (cria usuário no Supabase Auth com senha e salva perfil com telefone)
      const apiResponse = await authFetch('/api/collaborators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          username: cleanUsername,
          role: formData.role?.trim() || (userRole === 'admin' ? 'Administrador' : userRole === 'vendedor' ? 'Vendedor' : userRole === 'estoque' ? 'Estoque' : 'Colaborador'),
          email: cleanEmail,
          phone: cleanPhone,
          location: cleanLocation,
          type: dbType,
          password: cleanPassword,
          image_url: avatarUrl,
          skills: selectedSkills,
          can_access_leads: userRole === 'admin' ? true : canAccessLeads,
          can_access_deliveries: userRole === 'admin' ? true : canAccessDeliveries,
          can_access_transfers: userRole === 'admin' ? true : canAccessTransfers,
          can_access_warranties: userRole === 'admin' ? true : canAccessWarranties,
          can_access_reports: userRole === 'admin' ? true : canAccessReports,
          can_access_whatsapp: userRole === 'admin' ? true : canAccessWhatsapp,
          receives_leads: receivesLeads
        })
      });

      const apiResult = await apiResponse.json();

      if (!apiResponse.ok || apiResult?.error) {
        const errorMsg = apiResult?.error || 'Erro ao cadastrar colaborador no banco de dados.';
        setFormError(errorMsg);
        setIsSubmitting(false);
        if (apiResult?.needsSqlMigration || errorMsg.includes('fk_auth_user') || errorMsg.includes('Database error') || errorMsg.includes('trigger') || errorMsg.includes('Supabase')) {
          setShowSqlModal(true);
        }
        return;
      }

      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => {
        router.push('/collaborators');
      }, 1500);
      return;
    } catch (error: any) {
      console.error('Error creating collaborator:', error);
      setIsSubmitting(false);
      
      const errorMessage = error instanceof Error ? error.message : (error?.message || error?.details || 'Erro ao criar colaborador.');
      setFormError(errorMessage);
      if (errorMessage.includes('fk_auth_user') || errorMessage.includes('Database error') || errorMessage.includes('trigger')) {
        setShowSqlModal(true);
      }
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(FIX_AUTH_TRIGGER_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-6 bg-white border-b border-slate-200">
        <div className="flex items-center">
          <Link href="/collaborators" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
            <ArrowLeft size={20} />
          </Link>
          <h2 className="ml-2 text-xl font-bold tracking-tight">Adicionar Novo Colaborador</h2>
        </div>

        <button
          type="button"
          onClick={() => setShowSqlModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-xl transition-all shadow-xs"
          title="Ver script SQL de sincronização e permissões do Supabase"
        >
          <ShieldCheck size={14} className="text-amber-600" />
          <span className="hidden sm:inline">Script SQL Supabase</span>
          <span className="sm:hidden">Script SQL</span>
        </button>
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
                      Atualize a função trigger do banco para salvar novos usuários sem conflito de colunas
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
                  <p className="font-semibold text-xs mb-1">Por que isso acontece?</p>
                  <p className="text-[11px] leading-relaxed">
                    O trigger de criação de novos usuários no Supabase (<code className="bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono">handle_new_user</code>) tentava salvar colunas antigas (<code className="font-mono">avatar_url</code>) ou a restrição estrangeira (<code className="font-mono">fk_auth_user</code>) impedia o cadastro. Execute o script abaixo no <b>SQL Editor</b> do seu painel Supabase para corrigir em definitivo.
                  </p>
                </div>

                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-60 border border-slate-800">
                    {FIX_AUTH_TRIGGER_SQL}
                  </pre>
                  <button
                    onClick={handleCopySql}
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
                    onClick={handleCopySql}
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
                  Entendi, vou executar no Supabase
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Banner de Erro com Ação de Correção */}
        {formError && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">Atenção ao Salvar Colaborador</p>
                <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{formError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shadow-sm flex items-center gap-1.5 self-end sm:self-auto cursor-pointer"
            >
              <ShieldCheck size={14} />
              <span>Ver Correção SQL</span>
            </button>
          </div>
        )}
        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-4">
          <div 
            onClick={handlePhotoClick}
            className="relative size-32 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-blue-600 hover:bg-blue-50 transition-all group overflow-hidden"
          >
            {photo ? (
              <Image 
                src={photo} 
                alt="Preview" 
                fill 
                className="object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-600">
                <Camera size={32} />
                <span className="text-[10px] font-bold uppercase mt-1">Carregar Foto</span>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*"
            />
          </div>
          <p className="text-xs text-slate-400 text-center">Clique para carregar ou alterar a foto do colaborador</p>
        </div>

        <div className="space-y-6">
          {/* Full Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <User size={14} />
              Nome Completo
            </label>
            <input 
              required
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium" 
              placeholder="ex: João Silva" 
              type="text"
            />
          </div>

          {/* Username */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <User size={14} className="text-blue-600" />
              Usuário de Login
            </label>
            <input 
              required
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium" 
              placeholder="ex: joao.silva" 
              type="text"
            />
            <p className="text-[10px] text-slate-400">Este será o nome usado para entrar no sistema.</p>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Briefcase size={14} />
              Cargo / Função
            </label>
            <input 
              required
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium" 
              placeholder="ex: Estoquista" 
              type="text"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Mail size={14} />
              E-mail
            </label>
            <input 
              required
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium" 
              placeholder="ex: joao@empresa.com" 
              type="email"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Phone size={14} />
              Telefone
            </label>
            <input 
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium" 
              placeholder="+55 (11) 99999-0000" 
              type="tel"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={14} />
              Senha de Acesso
            </label>
            <input 
              required
              name="password"
              minLength={6}
              value={formData.password}
              onChange={handleInputChange}
              className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium" 
              placeholder="Defina uma senha (mínimo 6 caracteres)" 
              type="password"
            />
            <p className="text-[10px] text-slate-400">Protegida e criptografada com segurança pelo Supabase Auth (mínimo 6 caracteres).</p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <MapPin size={14} />
              Localização / Setor
            </label>
            <input 
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all outline-none font-medium" 
              placeholder="ex: Setor de Estoque" 
              type="text"
            />
          </div>

          {/* Skills / Specialties */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare size={14} />
              Habilidades e Especialidades
            </label>
            <SkillSelector 
              selectedSkills={selectedSkills} 
              onChange={setSelectedSkills} 
              isDarkMode={isDarkMode}
            />
            <p className="text-[10px] text-slate-400 italic">Busque ou adicione as especialidades do colaborador.</p>
          </div>

          {/* User Type / Permissions */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={14} />
              Nível de Acesso / Tipo de Usuário
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleRoleChange('user')}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                  userRole === 'user' 
                    ? 'border-blue-600 bg-blue-50 text-blue-600' 
                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                }`}
              >
                <Users size={20} />
                <span className="text-[10px] font-bold">Colaborador</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('vendedor')}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                  userRole === 'vendedor' 
                    ? 'border-blue-600 bg-blue-50 text-blue-600' 
                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                }`}
              >
                <Target size={20} />
                <span className="text-[10px] font-bold">Vendedor</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('estoque')}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                  userRole === 'estoque' 
                    ? 'border-blue-600 bg-blue-50 text-blue-600' 
                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                }`}
              >
                <Package size={20} />
                <span className="text-[10px] font-bold">Estoque</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('admin')}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                  userRole === 'admin' 
                    ? 'border-blue-600 bg-blue-50 text-blue-600' 
                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                }`}
              >
                <ShieldCheck size={20} />
                <span className="text-[10px] font-bold">Admin</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              {userRole === 'admin' 
                ? 'Administradores podem delegar tarefas, gerenciar a equipe e ver estatísticas globais.' 
                : userRole === 'vendedor'
                ? 'Vendedores podem gerenciar leads e visualizar suas próprias tarefas.'
                : 'Colaboradores podem visualizar e atualizar apenas as tarefas atribuídas a eles.'}
            </p>
          </div>

          {/* Module Permissions */}
          {isSystemAdmin && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={14} />
                Acesso a Módulos
              </label>
              <span className="text-[10px] font-medium text-slate-400 px-2 py-1 rounded bg-slate-100">
                {userRole === 'admin' ? 'Acesso Total' : 'Acesso Personalizado'}
              </span>
            </div>
            
            <div className="space-y-2">
              {[
                { id: 'leads', label: 'Módulo de Leads', desc: 'Acesso ao gerenciamento de clientes em prospecção', icon: Target, state: canAccessLeads, setter: setCanAccessLeads },
                { id: 'whatsapp', label: 'WhatsApp', desc: 'Acesso às funcionalidades de comunicação direta', icon: MessageCircle, state: canAccessWhatsapp, setter: setCanAccessWhatsapp },
                { id: 'deliveries', label: 'Entregas', desc: 'Acesso ao controle de logística e saídas', icon: Truck, state: canAccessDeliveries, setter: setCanAccessDeliveries },
                { id: 'transfers', label: 'Transferências', desc: 'Acesso ao controle de estoque entre lojas', icon: Package, state: canAccessTransfers, setter: setCanAccessTransfers },
                { id: 'warranties', label: 'Garantias', desc: 'Acesso ao módulo de assistência técnica', icon: ShieldCheck, state: canAccessWarranties, setter: setCanAccessWarranties },
                { id: 'reports', label: 'Relatórios', desc: 'Visualização de métricas e resultados', icon: BarChart3, state: canAccessReports, setter: setCanAccessReports }
              ].map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => module.setter(!module.state)}
                  disabled={userRole === 'admin'}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                    module.state || userRole === 'admin'
                      ? (isDarkMode ? 'bg-blue-600/10 border-blue-600/50' : 'bg-blue-50 border-blue-200')
                      : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')
                  } ${userRole === 'admin' ? 'opacity-70 cursor-not-allowed' : 'hover:border-blue-400'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${
                      module.state || userRole === 'admin'
                        ? (isDarkMode ? 'bg-blue-600/30 text-blue-400' : 'bg-blue-600 text-white')
                        : (isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')
                    }`}>
                      <module.icon size={20} />
                    </div>
                    <div className="text-left">
                      <span className={`text-sm font-bold block ${module.state || userRole === 'admin' ? (isDarkMode ? 'text-blue-400' : 'text-blue-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-700')}`}>
                        {module.label}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-black">{module.desc}</span>
                    </div>
                  </div>
                  
                  <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${
                    module.state || userRole === 'admin' ? 'bg-blue-600' : (isDarkMode ? 'bg-slate-800' : 'bg-slate-200')
                  }`}>
                    <div className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition-all duration-300 ${
                      module.state || userRole === 'admin' ? 'left-7' : 'left-1'
                    }`} />
                  </div>
                </button>
              ))}
            </div>

            {/* Receives Leads Toggle */}
            <button
              type="button"
              onClick={() => setReceivesLeads(!receivesLeads)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all mt-4 ${
                receivesLeads 
                  ? (isDarkMode ? 'bg-indigo-600/10 border-indigo-600/50' : 'bg-indigo-50 border-indigo-200')
                  : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')
              } hover:border-indigo-400`}
            >
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-xl flex items-center justify-center ${
                  receivesLeads 
                    ? (isDarkMode ? 'bg-indigo-600/30 text-indigo-400' : 'bg-indigo-600 text-white')
                    : (isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')
                }`}>
                  <Target size={20} />
                </div>
                <div className="text-left">
                  <span className={`text-sm font-bold block ${receivesLeads ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-700')}`}>
                    Receber Leads
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-black">Habilitar este vendedor para distribuição</span>
                </div>
              </div>
              
              <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${
                receivesLeads ? 'bg-indigo-600' : (isDarkMode ? 'bg-slate-800' : 'bg-slate-200')
              }`}>
                <div className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition-all duration-300 ${
                  receivesLeads ? 'left-7' : 'left-1'
                }`} />
              </div>
            </button>
            
            <p className="text-[10px] text-slate-400 italic mt-3">
              {userRole === 'admin' 
                ? 'Administradores sempre têm acesso a todos os módulos.' 
                : 'Selecione os módulos que este colaborador poderá acessar.'}
            </p>
          </div>
        )}
        </div>
      </form>

      <div className="p-6 border-t border-slate-200 bg-white sticky bottom-0">
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || showSuccess}
          className={`w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 ${isSubmitting ? 'cursor-not-allowed' : ''}`}
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : showSuccess ? (
            <Check size={24} className="animate-bounce" />
          ) : (
            <>
              <Send size={20} />
              Cadastrar Colaborador
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[100]"
          >
            <Check size={20} />
            Colaborador Cadastrado com Sucesso!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
