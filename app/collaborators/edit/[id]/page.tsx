'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, User, Mail, Phone, Briefcase, MapPin, Send, Check, X, ShieldCheck, Users, CheckSquare, Square, Target, Package, Truck, MessageCircle, BarChart3, Trash2 } from 'lucide-react';
import { SkillSelector } from '@/components/SkillSelector';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getInactiveCollaboratorIds, saveCollaboratorStatusLocal } from '@/lib/collaboratorStatus';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import { useUI } from '@/hooks/useUI';
import { authFetch } from '@/lib/authFetch';

const isSupabaseConfigured = 
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '') &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key';

export default function EditCollaboratorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { isDarkMode } = useTheme();
  const { isAdmin: isSystemAdmin } = useRole();
  const { showToast, showConfirm } = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [initialPhoto, setInitialPhoto] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'admin' | 'vendedor' | 'entregador' | 'estoque'>('user');
  const [canAccessLeads, setCanAccessLeads] = useState(false);
  const [canAccessDeliveries, setCanAccessDeliveries] = useState(false);
  const [canAccessTransfers, setCanAccessTransfers] = useState(false);
  const [canAccessWarranties, setCanAccessWarranties] = useState(false);
  const [canAccessReports, setCanAccessReports] = useState(false);
  const [canAccessWhatsapp, setCanAccessWhatsapp] = useState(false);
  const [receivesLeads, setReceivesLeads] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [initialPassword, setInitialPassword] = useState('');
  const [systemPermissions, setSystemPermissions] = useState<Record<string, string[]>>({});

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    role: '',
    email: '',
    phone: '',
    location: '',
    password: ''
  });

  useEffect(() => {
    async function fetchCollaborator() {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        console.error('Invalid UUID format:', id);
        alert('ID do colaborador inválido.');
        router.push('/collaborators');
        return;
      }
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();
        
        if (profileError) throw profileError;

        const { data: skills, error: skillsError } = await supabase
          .from('profile_skills')
          .select('skill')
          .eq('profile_id', id);
        
        if (skillsError) throw skillsError;

        setFormData({
          name: profile.name || '',
          username: profile.username || '',
          role: profile.role || '',
          email: profile.email || '',
          phone: profile.phone || '',
          location: profile.location || '',
          password: profile.password || ''
        });
        setInitialPassword(profile.password || '');
        setUserRole(profile.type || 'user');
        const isInactive = getInactiveCollaboratorIds().includes(id as string) || profile.status === 'Inativo';
        setStatus(isInactive ? 'Inativo' : 'Ativo');
        setCanAccessLeads(profile.can_access_leads || false);
        setCanAccessDeliveries(profile.can_access_deliveries || false);
        setCanAccessTransfers(profile.can_access_transfers || false);
        setCanAccessWarranties(profile.can_access_warranties || false);
        setCanAccessReports(profile.can_access_reports || false);
        setCanAccessWhatsapp(profile.can_access_whatsapp || false);
        setReceivesLeads(profile.receives_leads !== false);
        setPhoto(profile.image_url);
        setInitialPhoto(profile.image_url);
        setSelectedSkills(skills?.map(s => s.skill) || []);
      } catch (error) {
        console.error('Error fetching collaborator:', error);
        alert('Erro ao carregar dados do colaborador.');
        router.push('/collaborators');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchCollaborator();
    }

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
  }, [id, router]);

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
      setCanAccessReports(systemPermissions.reports?.includes(role) || false);
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

          // Compress to JPEG with 0.8 quality for preview
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
      alert('Configuração do Supabase ausente. Por favor, adicione as chaves de API nas configurações do projeto.');
      return;
    }

    if (!formData.username.trim()) {
      alert('O nome de usuário é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      saveCollaboratorStatusLocal(id as string, status);
      const isPasswordChanged = formData.password !== initialPassword;

      const cleanName = formData.name?.trim();
      const cleanEmail = formData.email?.trim() ? formData.email.trim().toLowerCase() : null;
      const cleanUsername = formData.username?.trim() ? formData.username.trim().toLowerCase() : null;
      const cleanPhone = formData.phone?.trim() ? formData.phone.trim() : null;
      const cleanLocation = formData.location?.trim() ? formData.location.trim() : null;
      const cleanPassword = formData.password?.trim() ? formData.password.trim() : null;

      if (!cleanName) {
        throw new Error('Por favor, informe o nome do colaborador.');
      }

      if (cleanPassword && cleanPassword.length < 6) {
        throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
      }

      // Pre-flight check: Verify if email is already in use by ANOTHER collaborator
      if (cleanEmail) {
        const { data: existingEmail } = await supabase
          .from('profiles')
          .select('id, name')
          .ilike('email', cleanEmail)
          .neq('id', id)
          .maybeSingle();

        if (existingEmail) {
          throw new Error(`O e-mail "${cleanEmail}" já está em uso pelo colaborador "${existingEmail.name}". Por favor, utilize outro endereço de e-mail.`);
        }
      }

      // Pre-flight check: Verify if username is already in use by ANOTHER collaborator
      if (cleanUsername) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id, name')
          .ilike('username', cleanUsername)
          .neq('id', id)
          .maybeSingle();

        if (existingUser) {
          throw new Error(`O nome de usuário "${cleanUsername}" já está em uso pelo colaborador "${existingUser.name}". Por favor, escolha outro nome de usuário.`);
        }
      }

      // Database constraint profiles_type_check expects 'admin' or 'user'
      const dbType = userRole === 'admin' ? 'admin' : 'user';

      let finalImageUrl = photo;

      // Upload do arquivo binário real para o bucket 'avatars' no Supabase Storage se uma nova foto foi selecionada
      if (imageBlob) {
        const fileName = `${id}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, imageBlob, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          finalImageUrl = publicUrlData.publicUrl;
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
              finalImageUrl = resData.url;
            }
          } catch (_) {}

          if (!finalImageUrl && photo) {
            finalImageUrl = photo;
          }
        }
      }

      // Envia atualização para a API segura com service_role (atualiza Supabase Auth e tabela profiles)
      let apiSuccess = false;
      try {
        const apiResponse = await authFetch('/api/collaborators', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            name: cleanName,
            username: cleanUsername,
            role: formData.role?.trim() || (userRole === 'admin' ? 'Administrador' : userRole === 'vendedor' ? 'Vendedor' : userRole === 'estoque' ? 'Estoque' : 'Colaborador'),
            email: cleanEmail,
            phone: cleanPhone,
            location: cleanLocation,
            status: status,
            type: dbType,
            password: cleanPassword || undefined,
            image_url: finalImageUrl,
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

        if (apiResponse.ok && apiResult?.success) {
          apiSuccess = true;
        } else if (!apiResponse.ok && apiResult?.error) {
          console.warn('Aviso retornado pela API /api/collaborators:', apiResult.error);
        }
      } catch (apiErr) {
        console.warn('Falha na chamada da API /api/collaborators (tentando sincronização direta):', apiErr);
      }

      // Sincronização direta de garantia na tabela profiles pelo cliente do Supabase
      try {
        const clientPayload: any = {
          name: cleanName,
          username: cleanUsername,
          role: formData.role?.trim() || (userRole === 'admin' ? 'Administrador' : userRole === 'vendedor' ? 'Vendedor' : userRole === 'estoque' ? 'Estoque' : 'Colaborador'),
          email: cleanEmail,
          phone: cleanPhone,
          location: cleanLocation,
          status: status,
          type: dbType,
          image_url: finalImageUrl,
          receives_leads: receivesLeads,
          can_access_leads: userRole === 'admin' ? true : canAccessLeads,
          can_access_deliveries: userRole === 'admin' ? true : canAccessDeliveries,
          can_access_transfers: userRole === 'admin' ? true : canAccessTransfers,
          can_access_warranties: userRole === 'admin' ? true : canAccessWarranties,
          can_access_reports: userRole === 'admin' ? true : canAccessReports,
          can_access_whatsapp: userRole === 'admin' ? true : canAccessWhatsapp,
        };

        if (cleanPassword) {
          clientPayload.password = cleanPassword;
        }

        let { error: directError } = await supabase
          .from('profiles')
          .update(clientPayload)
          .eq('id', id);

        if (directError && (directError.message?.includes('password') || directError.code === '42703')) {
          delete clientPayload.password;
          await supabase.from('profiles').update(clientPayload).eq('id', id);
        }
      } catch (directErr) {
        console.warn('Aviso ao sincronizar profiles diretamente:', directErr);
      }

      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => {
        router.push(`/collaborators/${id}`);
      }, 1500);
    } catch (error: any) {
      console.error('Error updating collaborator:', error);
      setIsSubmitting(false);
      
      const errorMessage = error instanceof Error ? error.message : (error?.message || error?.details || 'Erro ao atualizar colaborador.');
      alert(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const handleDeleteCollaborator = () => {
    showConfirm({
      title: 'Excluir Cadastro do Colaborador',
      message: `Tem certeza que deseja excluir permanentemente o cadastro de "${formData.name || 'este colaborador'}"? Esta ação não poderá ser desfeita.`,
      type: 'danger',
      confirmLabel: 'Excluir Colaborador',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          // Chama a API para exclusão completa
          const apiRes = await fetch(`/api/collaborators?id=${id}`, {
            method: 'DELETE'
          });
          const apiJson = await apiRes.json();

          if (!apiRes.ok && apiJson.error) {
            // Tenta fallback direto no Supabase se a rota falhar
            const { error: sbError } = await supabase.from('profiles').delete().eq('id', id);
            if (sbError) {
              console.warn('Falha na exclusão direta Supabase:', sbError.message);
              saveCollaboratorStatusLocal(id, 'Inativo');
              await supabase.from('profiles').update({ status: 'Inativo' }).eq('id', id);
            }
          }

          showToast('Cadastro do colaborador excluído com sucesso!', 'success');
          router.push('/collaborators');
        } catch (err) {
          console.error('Erro ao excluir colaborador:', err);
          showToast('Erro ao excluir colaborador.', 'error');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  return (
    <div className={`flex flex-col h-full transition-colors ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <header className={`sticky top-0 z-10 flex items-center px-4 py-6 border-b transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <Link href={`/collaborators/${id}`} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
          <ArrowLeft size={20} />
        </Link>
        <h2 className={`ml-2 text-xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Editar Colaborador</h2>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-4">
          <div 
            onClick={handlePhotoClick}
            className={`relative size-32 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-all group overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-blue-500' : 'bg-slate-100 border-slate-300 hover:border-blue-600 hover:bg-blue-50'
            }`}
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
        </div>

        <div className="space-y-6">
          {/* Full Name */}
          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              <User size={14} />
              Nome Completo
            </label>
            <input 
              required
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full h-14 px-4 rounded-xl border focus:ring-2 focus:ring-blue-600 transition-all outline-none font-medium ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`} 
              placeholder="ex: João Silva" 
              type="text"
            />
          </div>

          {/* Username */}
          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              <User size={14} className="text-blue-600" />
              Usuário de Login
            </label>
            <input 
              required
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className={`w-full h-14 px-4 rounded-xl border focus:ring-2 focus:ring-blue-600 transition-all outline-none font-medium ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`} 
              placeholder="ex: joao.silva" 
              type="text"
            />
            <p className="text-[10px] text-slate-400 italic">Este nome é usado para entrar no sistema.</p>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              <Briefcase size={14} />
              Cargo / Função
            </label>
            <input 
              required
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className={`w-full h-14 px-4 rounded-xl border focus:ring-2 focus:ring-blue-600 transition-all outline-none font-medium ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`} 
              placeholder="ex: Estoquista" 
              type="text"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              <Mail size={14} />
              E-mail
            </label>
            <input 
              required
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full h-14 px-4 rounded-xl border focus:ring-2 focus:ring-blue-600 transition-all outline-none font-medium ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`} 
              placeholder="ex: joao@empresa.com" 
              type="email"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              <Phone size={14} />
              Telefone
            </label>
            <input 
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className={`w-full h-14 px-4 rounded-xl border focus:ring-2 focus:ring-blue-600 transition-all outline-none font-medium ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`} 
              placeholder="+55 (11) 99999-0000" 
              type="tel"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              <MapPin size={14} />
              Localização / Setor
            </label>
            <input 
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className={`w-full h-14 px-4 rounded-xl border focus:ring-2 focus:ring-blue-600 transition-all outline-none font-medium ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`} 
              placeholder="ex: Setor de Estoque" 
              type="text"
            />
          </div>

          {/* Password Reset */}
          <div className="space-y-2">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              <ShieldCheck size={14} />
              Redefinir Senha
            </label>
            <input 
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={`w-full h-14 px-4 rounded-xl border focus:ring-2 focus:ring-blue-600 transition-all outline-none font-medium ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`} 
              placeholder="Nova senha para o colaborador" 
              type="text"
            />
            <p className="text-[10px] text-slate-400 italic">Como administrador, você pode visualizar e alterar a senha deste colaborador.</p>
          </div>

          {/* Skills / Specialties */}
          <div className="space-y-3">
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
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

          {/* Status do Colaborador (Ativo / Inativo) */}
          <div className={`space-y-3 pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              <User size={14} className="text-amber-500" />
              Status na Empresa
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('Ativo')}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                  status === 'Ativo'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : isDarkMode
                    ? 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="size-2 rounded-full bg-emerald-400"></span>
                Ativo
              </button>

              <button
                type="button"
                onClick={() => setStatus('Inativo')}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                  status === 'Inativo'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20'
                    : isDarkMode
                    ? 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="size-2 rounded-full bg-rose-400"></span>
                Inativo (Desligado da Empresa)
              </button>
            </div>

            {status === 'Inativo' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span className="font-mono">⚠️</span> Colaborador Inativo / Desligado
                </p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  O colaborador inativo não conseguirá realizar login e não aparecerá nas opções para delegação de novas tarefas na empresa.
                </p>
              </div>
            )}
          </div>

          {/* User Type */}
          <div className={`space-y-3 pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              <ShieldCheck size={14} />
              Nível de Acesso
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => handleRoleChange('user')}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                  userRole === 'user' 
                    ? 'border-blue-600 bg-blue-50 text-blue-600' 
                    : (isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-500' : 'border-slate-100 bg-white text-slate-400')
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
                    : (isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-500' : 'border-slate-100 bg-white text-slate-400')
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
                    : (isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-500' : 'border-slate-100 bg-white text-slate-400')
                }`}
              >
                <Package size={20} />
                <span className="text-[10px] font-bold">Estoque</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('entregador')}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                  userRole === 'entregador' 
                    ? 'border-blue-600 bg-blue-50 text-blue-600' 
                    : (isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-500' : 'border-slate-100 bg-white text-slate-400')
                }`}
              >
                <Truck size={20} />
                <span className="text-[10px] font-bold">Entregador</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('admin')}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                  userRole === 'admin' 
                    ? 'border-blue-600 bg-blue-50 text-blue-600' 
                    : (isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-500' : 'border-slate-100 bg-white text-slate-400')
                }`}
              >
                <ShieldCheck size={20} />
                <span className="text-[10px] font-bold">Admin</span>
              </button>
            </div>
          </div>

          {/* Module Permissions */}
          {isSystemAdmin && (
            <div className={`space-y-4 pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                  <ShieldCheck size={14} />
                  Acesso a Módulos
                </label>
                <span className="text-[10px] font-medium text-slate-400 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
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
              
              <p className="text-[10px] text-slate-400 italic">
                {userRole === 'admin' 
                  ? 'Administradores sempre têm acesso a todos os módulos.' 
                  : 'Selecione os módulos que este colaborador poderá acessar.'}
              </p>
            </div>
          )}
        </div>
      </form>

      <div className={`p-6 border-t sticky bottom-0 transition-colors flex flex-col sm:flex-row items-center gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <button 
          type="button"
          onClick={handleDeleteCollaborator}
          disabled={isSubmitting || isDeleting}
          className="w-full sm:w-auto px-6 h-14 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-950/80 dark:text-rose-400 font-bold rounded-xl border border-rose-200 dark:border-rose-900/50 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-[0.98] disabled:opacity-50"
        >
          <Trash2 size={20} />
          Excluir Cadastro
        </button>

        <button 
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || isDeleting || showSuccess}
          className={`flex-1 w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70`}
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

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[100]"
          >
            <Check size={20} />
            Alterações Salvas com Sucesso!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
