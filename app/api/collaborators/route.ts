import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireAdmin } from '@/lib/serverAuth';

function getServiceRoleKey(): string | null {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  return null;
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) return auth.response;

    const client = getAdminClient();
    if (!client) {
      return NextResponse.json({ collaborators: [] });
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, name, username, type, role, location, image_url, email, phone, status, must_change_password, receives_leads, can_access_leads, can_access_deliveries, can_access_transfers, can_access_warranties, can_access_reports, can_access_whatsapp')
      .order('name');

    if (error) {
      console.warn('Erro ao consultar profiles em GET /api/collaborators:', error.message);
      const { data: fallbackData } = await client
        .from('profiles')
        .select('id, name, type, role, location, image_url, email, phone')
        .order('name');
      return NextResponse.json({ collaborators: fallbackData || [] });
    }

    return NextResponse.json({ collaborators: data || [] });
  } catch (err: any) {
    console.error('Falha na rota GET /api/collaborators:', err);
    return NextResponse.json({ collaborators: [] });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return auth.response;

    const client = getAdminClient();
    if (!client) {
      return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const body = await req.json();
    const {
      name,
      username,
      email,
      phone,
      location,
      role,
      type,
      password,
      image_url,
      skills,
      can_access_leads,
      can_access_deliveries,
      can_access_transfers,
      can_access_warranties,
      can_access_reports,
      can_access_whatsapp,
      receives_leads
    } = body;

    const cleanEmail = email?.trim()?.toLowerCase();
    const cleanUsername = username?.trim()?.toLowerCase();
    const cleanPhone = phone?.trim() || null;
    const cleanPassword = password?.trim();
    const cleanName = name?.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios.' }, { status: 400 });
    }

    if (cleanPassword.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
    }

    // 1. Criar usuário no Supabase Auth via Admin API (se service role key estiver ativa)
    let userId: string | null = null;
    let authCreated = false;
    let authErrorMessage: string | null = null;
    const serviceRoleKey = getServiceRoleKey();

    if (serviceRoleKey) {
      try {
        const { data: authUser, error: authError } = await client.auth.admin.createUser({
          email: cleanEmail,
          password: cleanPassword,
          email_confirm: true,
          user_metadata: {
            name: cleanName,
            username: cleanUsername,
            role: role?.trim() || 'Colaborador',
            phone: cleanPhone,
            type: type === 'admin' ? 'admin' : 'user'
          }
        });

        if (!authError && authUser?.user?.id) {
          userId = authUser.user.id;
          authCreated = true;
        } else if (authError) {
          authErrorMessage = authError.message;
          console.warn('Aviso ao criar usuário no Supabase Auth (tentando continuar):', authError.message);
          // Se o usuário já existir no Auth, localiza o ID
          if (authError.message?.toLowerCase().includes('already') || (authError as any).status === 422) {
            const { data: usersData } = await client.auth.admin.listUsers();
            const matched = usersData?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
            if (matched?.id) {
              userId = matched.id;
            }
          }
        }
      } catch (authException: any) {
        authErrorMessage = authException?.message || 'Falha ao executar auth.admin.createUser';
        console.warn('Exceção ao criar no Supabase Auth:', authException);
      }
    } else {
      console.warn('Aviso: SUPABASE_SERVICE_ROLE_KEY não configurada. O usuário será criado apenas na tabela profiles.');
    }

    // Se o auth admin não retornou ID (ex: trigger quebrado ou chave anônima), verifica se já existe perfil ou gera UUID
    if (!userId) {
      const { data: existingProfile } = await client
        .from('profiles')
        .select('id')
        .or(`email.ilike.${cleanEmail},username.ilike.${cleanUsername}`)
        .maybeSingle();

      userId = existingProfile?.id || crypto.randomUUID();
    }

    // 2. Inserir ou atualizar na tabela profiles (sem coluna password)
    const profilePayload: any = {
      id: userId,
      name: cleanName,
      username: cleanUsername || null,
      email: cleanEmail,
      phone: cleanPhone,
      location: location?.trim() || null,
      role: role?.trim() || 'Colaborador',
      type: type === 'admin' ? 'admin' : 'user',
      status: 'Ativo',
      image_url: image_url || null,
      receives_leads: receives_leads !== false,
      can_access_leads: type === 'admin' ? true : !!can_access_leads,
      can_access_deliveries: type === 'admin' ? true : !!can_access_deliveries,
      can_access_transfers: type === 'admin' ? true : !!can_access_transfers,
      can_access_warranties: type === 'admin' ? true : !!can_access_warranties,
      can_access_reports: type === 'admin' ? true : !!can_access_reports,
      can_access_whatsapp: type === 'admin' ? true : !!can_access_whatsapp,
    };

    let { error: profileError } = await client
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    // Se falhar devido a colunas de permissão não existentes ou restrição de foreign key
    if (profileError) {
      console.warn('Tentativa com payload completo falhou em profiles, tentando com payload seguro:', profileError.message);
      const safePayload = {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: role?.trim() || 'Colaborador',
        type: type === 'admin' ? 'admin' : 'user',
        image_url: image_url || null
      };
      const { error: safeError } = await client.from('profiles').upsert(safePayload, { onConflict: 'id' });
      if (safeError) {
        const fullErrorMessage = safeError.message || profileError.message;
        console.error('Falha crítica ao gravar perfil do colaborador:', fullErrorMessage);

        const isFkError = fullErrorMessage.includes('fk_auth_user') || fullErrorMessage.includes('profiles_id_fkey') || fullErrorMessage.includes('violates foreign key');
        const isTriggerError = authErrorMessage?.includes('Database error') || fullErrorMessage.includes('avatar_url');

        return NextResponse.json({
          error: isFkError || isTriggerError
            ? 'Erro no banco de dados Supabase: O trigger de criação de usuários está incompatível ou a restrição de chave estrangeira (fk_auth_user) impediu o cadastro. Execute a correção SQL no SQL Editor do Supabase.'
            : `Erro ao salvar colaborador no banco: ${fullErrorMessage}`,
          details: fullErrorMessage,
          authErrorMessage,
          needsSqlMigration: true
        }, { status: 400 });
      }
    }

    // 3. Inserir Skills
    if (Array.isArray(skills) && skills.length > 0) {
      try {
        const skillRows = skills.map(skill => ({
          profile_id: userId,
          skill: skill
        }));
        await client.from('profile_skills').insert(skillRows);
      } catch (skillErr) {
        console.warn('Erro ao salvar skills:', skillErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      id: userId,
      authCreated,
      serviceRoleActive: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      authErrorMessage
    });
  } catch (err: any) {
    console.error('Falha em POST /api/collaborators:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) return auth.response;

    const client = getAdminClient();
    if (!client) {
      return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const body = await req.json();
    const {
      id,
      name,
      username,
      email,
      phone,
      location,
      role,
      type,
      status,
      password,
      image_url,
      skills,
      can_access_leads,
      can_access_deliveries,
      can_access_transfers,
      can_access_warranties,
      can_access_reports,
      can_access_whatsapp,
      receives_leads
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do colaborador é obrigatório' }, { status: 400 });
    }

    // Se o usuário logado não for administrador, só pode editar o seu próprio perfil
    // e não pode alterar seu próprio 'type', 'role', 'status' ou permissões de acesso.
    if (!auth.user.isAdmin && auth.user.id !== id) {
      return NextResponse.json(
        { error: 'Acesso negado. Você só pode atualizar o seu próprio perfil.' },
        { status: 403 }
      );
    }

    const cleanEmail = email?.trim()?.toLowerCase() || null;
    const cleanUsername = username?.trim()?.toLowerCase() || null;
    const cleanPhone = phone?.trim() ? phone.trim() : null;
    const cleanPassword = password?.trim() || null;
    const cleanName = name?.trim();

    if (cleanPassword && cleanPassword.length < 6) {
      return NextResponse.json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
    }

    // 1. Atualizar credenciais no Supabase Auth (se service role key estiver ativa)
    try {
      const authUpdates: any = {
        user_metadata: {
          name: cleanName,
          username: cleanUsername,
          role: role?.trim() || 'Colaborador',
          phone: cleanPhone
        }
      };

      if (cleanEmail) {
        authUpdates.email = cleanEmail;
      }

      if (cleanPassword && cleanPassword.length >= 6) {
        authUpdates.password = cleanPassword;
      }

      const { error: authError } = await client.auth.admin.updateUserById(id, authUpdates);
      
      // Se o usuário não existir no auth.users (ex: colaborador criado diretamente no banco), cria no auth.users
      if (authError && (authError.message?.toLowerCase().includes('not found') || (authError as any).status === 404)) {
        if (cleanEmail && cleanPassword && cleanPassword.length >= 6) {
          await client.auth.admin.createUser({
            id: id,
            email: cleanEmail,
            password: cleanPassword,
            email_confirm: true,
            user_metadata: {
              name: cleanName,
              username: cleanUsername,
              role: role?.trim() || 'Colaborador',
              phone: cleanPhone
            }
          });
        }
      } else if (authError) {
        console.warn('Aviso ao atualizar auth.users:', authError.message);
      }
    } catch (authException) {
      console.warn('Exceção ao atualizar no Supabase Auth:', authException);
    }

    // 2. Atualizar tabela profiles (sem coluna password)
    // Se não for admin, preserva estritamente type, role, status e permissões do banco para evitar auto-promoção.
    let targetType = type === 'admin' ? 'admin' : 'user';
    let targetRole = role?.trim() || 'Colaborador';
    let targetStatus = status || 'Ativo';
    let targetReceivesLeads = receives_leads !== false;
    let targetCanLeads = targetType === 'admin' ? true : !!can_access_leads;
    let targetCanDeliveries = targetType === 'admin' ? true : !!can_access_deliveries;
    let targetCanTransfers = targetType === 'admin' ? true : !!can_access_transfers;
    let targetCanWarranties = targetType === 'admin' ? true : !!can_access_warranties;
    let targetCanReports = targetType === 'admin' ? true : !!can_access_reports;
    let targetCanWhatsapp = targetType === 'admin' ? true : !!can_access_whatsapp;

    if (!auth.user.isAdmin) {
      const { data: existingProfile } = await client
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (existingProfile) {
        targetType = existingProfile.type || 'user';
        targetRole = existingProfile.role || 'Colaborador';
        targetStatus = existingProfile.status || 'Ativo';
        targetReceivesLeads = existingProfile.receives_leads ?? false;
        targetCanLeads = existingProfile.can_access_leads ?? false;
        targetCanDeliveries = existingProfile.can_access_deliveries ?? false;
        targetCanTransfers = existingProfile.can_access_transfers ?? false;
        targetCanWarranties = existingProfile.can_access_warranties ?? false;
        targetCanReports = existingProfile.can_access_reports ?? false;
        targetCanWhatsapp = existingProfile.can_access_whatsapp ?? false;
      }
    }

    const profilePayload: any = {
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      phone: cleanPhone,
      location: location?.trim() || null,
      role: targetRole,
      type: targetType,
      status: targetStatus,
      receives_leads: targetReceivesLeads,
      can_access_leads: targetCanLeads,
      can_access_deliveries: targetCanDeliveries,
      can_access_transfers: targetCanTransfers,
      can_access_warranties: targetCanWarranties,
      can_access_reports: targetCanReports,
      can_access_whatsapp: targetCanWhatsapp,
    };

    if (image_url) {
      profilePayload.image_url = image_url;
    }

    let { data: updatedProfile, error: profileError } = await client
      .from('profiles')
      .update(profilePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (profileError) {
      console.warn('Tentativa com payload completo falhou, aplicando fallback no profiles:', profileError.message);
      const safePayload = {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        location: location?.trim() || null,
        role: role?.trim() || 'Colaborador',
        type: type === 'admin' ? 'admin' : 'user'
      };
      const { error: fallbackError } = await client
        .from('profiles')
        .update(safePayload)
        .eq('id', id);

      if (fallbackError) {
        console.error('Erro no fallback do update profiles:', fallbackError.message);
        return NextResponse.json({ error: fallbackError.message }, { status: 400 });
      }
    }

    // 3. Atualizar Skills
    if (Array.isArray(skills)) {
      try {
        await client.from('profile_skills').delete().eq('profile_id', id);
        if (skills.length > 0) {
          const skillRows = skills.map(skill => ({
            profile_id: id,
            skill: skill
          }));
          await client.from('profile_skills').insert(skillRows);
        }
      } catch (skillErr) {
        console.warn('Erro ao sincronizar skills:', skillErr);
      }
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    console.error('Falha em PUT /api/collaborators:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar colaborador' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return auth.response;

    const client = getAdminClient();
    if (!client) {
      return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch (e) {
        // Ignora erro de body se for vazio
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'ID do colaborador é obrigatório.' }, { status: 400 });
    }

    // 1. Apagar habilidades do perfil
    try {
      await client.from('profile_skills').delete().eq('profile_id', id);
    } catch (skillErr) {
      console.warn('Aviso ao remover profile_skills:', skillErr);
    }

    // 2. Apagar do Supabase Auth (se service role key estiver disponível)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { error: authErr } = await client.auth.admin.deleteUser(id);
        if (authErr) {
          console.warn('Aviso ao deletar de auth.users:', authErr.message);
        }
      } catch (authException) {
        console.warn('Exceção ao deletar de auth.users:', authException);
      }
    }

    // 3. Apagar da tabela profiles
    let { error: profileError } = await client
      .from('profiles')
      .delete()
      .eq('id', id);

    // Se houver restrição de chave estrangeira em tarefas/leads/entregas, tenta desassociar antes de deletar
    if (profileError) {
      console.warn('Tentativa direta de exclusão em profiles falhou:', profileError.message);

      // Desassocia tarefas vinculadas
      try {
        await client.from('tasks').update({ collaborator_id: null }).eq('collaborator_id', id);
      } catch (tErr) {
        console.warn('Erro ao desassociar tarefas:', tErr);
      }

      // Tenta novamente excluir
      const retryRes = await client.from('profiles').delete().eq('id', id);
      profileError = retryRes.error;

      // Se ainda falhar devido a restrições relacionais, inativa o cadastro no banco
      if (profileError) {
        console.warn('Inativando colaborador como fallback após falha de deleção física:', profileError.message);
        await client.from('profiles').update({ status: 'Inativo' }).eq('id', id);
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error('Falha em DELETE /api/collaborators:', err);
    return NextResponse.json({ error: err?.message || 'Erro ao excluir colaborador' }, { status: 500 });
  }
}
