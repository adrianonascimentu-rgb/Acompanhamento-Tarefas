'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ArrowLeft, Search, Plus, Target, User, Phone, Mail, Calendar, Filter, Briefcase, Shuffle, CheckCircle2, AlertCircle, X, Check, Users, Pencil, BarChart3, MapPin, Trash2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { useUI } from '@/hooks/useUI';
import { useNotifications } from '@/hooks/useNotifications';
import { VoiceSearch } from '@/components/ui/VoiceSearch';
import { LoginForm } from '@/components/auth/LoginForm';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/authFetch';

import dynamic from 'next/dynamic';

const LeadsMap = dynamic(() => import('@/components/LeadsMap'), { 
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-slate-100 animate-pulse rounded-2xl border border-slate-200" />
});

const MOCK_LEADS = [
  { id: 1, name: 'Ricardo Santos', company: 'Restaurante Mangai', status: 'Novo', email: 'contato@mangai.com.br', phone: '(83) 3226-1615', segment: 'Restaurante', assigned_to: null, created_at: new Date().toISOString(), lat: -7.1145, lng: -34.8290, address: 'Av. Gen. Edson Ramalho, 696 - Manaíra, João Pessoa - PB' },
  { id: 2, name: 'Juliana Paiva', company: 'Padaria El Shaddai', status: 'Em Contato', email: 'financeiro@elshaddai.com', phone: '(83) 3246-4554', segment: 'Padaria', assigned_to: null, created_at: new Date().toISOString(), lat: -7.0890, lng: -34.8320, address: 'R. Francisco Leocádio Ribeiro Coutinho, 451 - Bessa, João Pessoa - PB' },
  { id: 3, name: 'Marcos Oliveira', company: 'Açougue do Boi', status: 'Qualificado', email: 'marcos@acouguedoboi.com.br', phone: '(83) 99123-4455', segment: 'Açougue', assigned_to: null, created_at: new Date().toISOString(), lat: -7.1150, lng: -34.8630, address: 'Av. Dom Pedro II, 567 - Centro, João Pessoa - PB' },
  { id: 4, name: 'Camila Doces', company: 'Amor Doce', status: 'Novo', email: 'camila@amordoce.com', phone: '(83) 3247-1122', segment: 'Doceria', assigned_to: null, created_at: new Date().toISOString(), lat: -7.1250, lng: -34.8230, address: 'Av. Cabo Branco, 2120 - Cabo Branco, João Pessoa - PB' },
];

const MOCK_VENDEDORES = [
  { id: '88888888-8888-8888-8888-888888888888', name: 'Carlos Vendedor', role: 'Consultor de Vendas', type: 'vendedor', image_url: 'https://picsum.photos/seed/carlos/200' },
  { id: '99999999-9999-9999-9999-999999999999', name: 'Mariana Vendas', role: 'Consultora de Vendas', type: 'vendedor', image_url: 'https://picsum.photos/seed/mariana/200' },
];

export default function LeadsPage() {
  const { role, user, isAdmin, canAccessLeads, isAuthenticated, isLoading: roleLoading, login } = useRole();
  const { isDarkMode } = useTheme();
  const { showToast, showConfirm } = useUI();
  const { createNotification } = useNotifications();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLeadForAssignment, setSelectedLeadForAssignment] = useState<any>(null);
  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([]);
  const [distributionMode, setDistributionMode] = useState<'random' | 'balanced'>('balanced');
  const [vendedorSearchQuery, setVendedorSearchQuery] = useState('');
  const [searchSegment, setSearchSegment] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [newLead, setNewLead] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    segment: 'Geral',
    address: '',
    neighborhood: '',
    city: '',
    reference: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('Todos');
  const [userReceivesLeads, setUserReceivesLeads] = useState<boolean>(true);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);

  useEffect(() => {
    if (user) {
      setUserReceivesLeads(user.receives_leads !== false);
    }
  }, [user]);

  const handleToggleMyAvailability = async () => {
    if (!user?.id) return;
    
    setIsUpdatingAvailability(true);
    const newValue = !userReceivesLeads;
    
    try {
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

      if (isConfigured) {
        const { error } = await supabase
          .from('profiles')
          .update({ receives_leads: newValue })
          .eq('id', user.id);
        
        if (error) throw error;
      }
      
      setUserReceivesLeads(newValue);
      showToast(newValue ? 'Você agora está disponível para receber leads!' : 'Você marcou como indisponível para receber novos leads.', 'info');
    } catch (err: any) {
      console.error('Error updating availability:', err);
      showToast('Erro ao atualizar sua disponibilidade.', 'error');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      'Todos': leads.length,
      'Novo': 0,
      'Em Contato': 0,
      'Qualificado': 0,
      'Concluído': 0
    };

    leads.forEach((lead) => {
      const st = lead.status || 'Novo';
      counts[st] = (counts[st] || 0) + 1;
    });

    return counts;
  }, [leads]);

  const availableStatuses = React.useMemo(() => {
    const defaultStatuses = ['Todos', 'Novo', 'Em Contato', 'Qualificado', 'Concluído'];
    const customStatuses = Object.keys(statusCounts).filter(st => !defaultStatuses.includes(st) && statusCounts[st] > 0);
    return [...defaultStatuses, ...customStatuses];
  }, [statusCounts]);

  const segmentData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((lead) => {
      const seg = (lead.segment || 'Geral').trim();
      counts[seg] = (counts[seg] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([segment, total]) => ({ segment, total }))
      .sort((a, b) => b.total - a.total);
  }, [leads]);

  const handleSearchLeads = async () => {
    if (!searchSegment) return;

    setIsSearching(true);
    try {
      const res = await authFetch('/api/gemini/search-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: searchSegment }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao buscar leads');
      }

      const leadsData = data.leads || [];
      
      // Save to Supabase
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

      if (isConfigured) {
        const { error } = await supabase
          .from('leads')
          .insert(leadsData.map((l: any) => ({
            name: l.name,
            company: l.company,
            email: l.email,
            phone: l.phone,
            segment: l.segment,
            status: 'Novo',
            created_at: new Date().toISOString()
          })));
        
        if (error) throw error;
        await fetchLeads();
      } else {
        // Mock save
        const mockNewLeads = leadsData.map((l: any, i: number) => ({
          ...l,
          id: Math.max(...leads.map(l => l.id), 0) + i + 1,
          status: 'Novo',
          created_at: new Date().toISOString()
        }));
        setLeads([...mockNewLeads, ...leads]);
      }
      
      showToast(`${leadsData.length} leads encontrados e salvos!`, 'success');
    } catch (err) {
      console.error('Detailed Error in handleSearchLeads:', err);
      showToast(`Erro ao buscar leads: ${err instanceof Error ? err.message : 'Erro desconhecido'}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const hasAccess = canAccessLeads;

  const fetchVendedores = async () => {
    console.log('Fetching vendedores...');
    try {
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

      if (!isConfigured) {
        console.log('Supabase not configured, using mock vendedores');
        setVendedores(MOCK_VENDEDORES.map(v => ({ ...v, receives_leads: true })));
        return;
      }

      // Fetch potential lead receivers (vendedores, gerentes, supervisores)
      // We check multiple columns and patterns to ensure compatibility with different database versions
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or('type.eq.vendedor,type.eq.gerente,type.eq.supervisor,role.ilike.%vendedor%,role.ilike.%gerente%,role.ilike.%consultor%')
        .order('name');
      
      if (error) {
        console.warn('Error fetching vendedores from Supabase:', error.message);
        // Emergency fallback: fetch all non-admin profiles
        const { data: allProfiles } = await supabase.from('profiles').select('*').neq('type', 'admin').limit(20);
        if (allProfiles && allProfiles.length > 0) {
          setVendedores(allProfiles);
        } else {
          setVendedores(MOCK_VENDEDORES.map(v => ({ ...v, receives_leads: true })));
        }
      } else {
        console.log(`Fetched ${data?.length || 0} potential vendedores from Supabase`);
        if (data && data.length > 0) {
          setVendedores(data);
        } else {
          // If specific query returned nothing, try to get anyone who isn't an admin
          const { data: anyNonAdmin } = await supabase.from('profiles').select('*').neq('type', 'admin').limit(15);
          if (anyNonAdmin && anyNonAdmin.length > 0) {
            setVendedores(anyNonAdmin);
          } else {
            // Last resort: mock data
            setVendedores(MOCK_VENDEDORES.map(v => ({ ...v, receives_leads: true })));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching vendedores:', err);
      setVendedores(MOCK_VENDEDORES.map(v => ({ ...v, receives_leads: true })));
    }
  };

  const fetchLeads = async () => {
    try {
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

      if (!isConfigured) {
        setLeads(MOCK_LEADS);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('leads')
        .select('*, assigned_profile:profiles(name)')
        .order('created_at', { ascending: false });
      
      if (error) {
        const isTableMissing = error.code === '42P01' || 
                               error.message?.includes('relation "leads" does not exist') ||
                               error.message?.includes('Could not find the table \'public.leads\' in the schema cache');
        
        if (isTableMissing) {
          setTableMissing(true);
        }
        setLeads(MOCK_LEADS);
      } else {
        setLeads(data || []);
      }
    } catch (err: any) {
      setLeads(MOCK_LEADS);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setIsDistributing(true);
    await Promise.all([fetchLeads(), fetchVendedores()]);
    setIsDistributing(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  useEffect(() => {
    if (isAuthenticated && hasAccess) {
      fetchLeads();
      fetchVendedores();
    }

    // Real-time subscription
    const tables = ['leads', 'profiles'];
    const channels = tables.map(table => {
      return supabase
        .channel(`public:${table}-leads-realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          if (table === 'leads') fetchLeads();
          if (table === 'profiles') fetchVendedores();
        })
        .subscribe();
    });

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [isAuthenticated, hasAccess]);

  useEffect(() => {
    // Initialize selected vendedores when list is fetched
    if (vendedores.length > 0 && selectedVendedores.length === 0) {
      // Use receives_leads from DB if available, otherwise default to all
      const receiving = vendedores.filter(v => v.receives_leads !== false).map(v => v.id);
      setSelectedVendedores(receiving);
    }
  }, [vendedores, selectedVendedores.length]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.name || !newLead.company) {
      showToast('Nome e Empresa são obrigatórios.', 'warning');
      return;
    }

    if (newLead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLead.email)) {
      showToast('E-mail inválido.', 'warning');
      return;
    }

    if (emailError || phoneError) {
      showToast('Corrija os erros no formulário antes de salvar.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

      if (selectedLeadForAssignment) {
        // Edit mode
        const leadData = { ...newLead };

        if (isConfigured && !tableMissing) {
          const { error } = await supabase
            .from('leads')
            .update(leadData)
            .eq('id', selectedLeadForAssignment.id);
          
          if (error) throw error;
        }

        setLeads(prev => prev.map(l => l.id === selectedLeadForAssignment.id ? { ...l, ...leadData } : l));
        showToast('Lead atualizado com sucesso.', 'success');
      } else {
        // Create mode
        const leadWithoutAddress = { ...newLead };
        const leadData = {
          ...leadWithoutAddress,
          status: 'Novo',
          created_at: new Date().toISOString(),
          assigned_to: null,
          created_by: user?.id
        };

        if (isConfigured && !tableMissing) {
          const { data, error } = await supabase
            .from('leads')
            .insert([leadData])
            .select();
          
          if (error) {
            console.error('Supabase error:', error);
            throw error;
          }
          if (data) setLeads([data[0], ...leads]);
        } else {
          // Mock save or table missing local save
          const mockNewLead = {
            ...leadData,
            id: leads.length > 0 ? (Math.max(...leads.map(l => typeof l.id === 'number' ? l.id : 0), 0) + 1) : 1
          };
          setLeads([mockNewLead, ...leads]);
        }
        showToast('Lead criado com sucesso.', 'success');
      }

      setShowAddModal(false);
      setNewLead({ 
        name: '', 
        company: '', 
        email: '', 
        phone: '', 
        segment: 'Geral',
        address: '',
        neighborhood: '',
        city: '',
        reference: ''
      });
      setSelectedLeadForAssignment(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving lead:', err);
      console.error('Supabase anon key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      console.error('Error message:', err.message);
      console.error('Error keys:', Object.keys(err));
      console.error('Error stringified:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      showToast(`Erro ao salvar lead: ${err.message || 'Erro desconhecido'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDistributeLeads = async () => {
    if (!canAccessLeads) return;
    
    const unassignedLeads = leads.filter(l => !l.assigned_to && l.status === 'Novo');
    
    if (unassignedLeads.length === 0) {
      showToast('Não há novos leads para distribuir.', 'info');
      return;
    }

    if (vendedores.length === 0) {
      showToast('Não há vendedores cadastrados para receber leads.', 'warning');
      return;
    }

    if (selectedVendedores.length === 0) {
      showToast('Selecione pelo menos um vendedor para a distribuição.', 'warning');
      return;
    }

    setIsDistributing(true);
    
    try {
      // Only distribute to 'Ativo' and 'Habilitado' (receives_leads) vendedores
      const activeVendedores = vendedores.filter(v => 
        selectedVendedores.includes(v.id) && 
        (v.status === 'Ativo' || !v.status) &&
        v.receives_leads !== false
      );

      if (activeVendedores.length === 0) {
        showToast('Nenhum vendedor selecionado está com status "Ativo" no momento.', 'warning');
        setIsDistributing(false);
        return;
      }
      
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

      // Prepare updates
      const updates: any[] = [];
      
      if (distributionMode === 'random') {
        unassignedLeads.forEach(lead => {
          const randomVendedor = activeVendedores[Math.floor(Math.random() * activeVendedores.length)];
          updates.push({
            id: lead.id,
            name: lead.name,
            assigned_to: randomVendedor.id,
            assigned_name: randomVendedor.name,
            status: 'Em Contato'
          });
        });
      } else {
        // Balanced (Round-robin)
        unassignedLeads.forEach((lead, index) => {
          const vendedor = activeVendedores[index % activeVendedores.length];
          updates.push({
            id: lead.id,
            name: lead.name,
            assigned_to: vendedor.id,
            assigned_name: vendedor.name,
            status: 'Em Contato'
          });
        });
      }

      if (isConfigured) {
        // Update Supabase in batches or one by one for simplicity in this demo
        for (const update of updates) {
          await supabase
            .from('leads')
            .update({ 
              assigned_to: update.assigned_to, 
              status: 'Em Contato' 
            })
            .eq('id', update.id);
        }
      }

      // Update local state
      const updatedLeads = leads.map(lead => {
        const update = updates.find(u => u.id === lead.id);
        if (update) {
          return {
            ...lead,
            assigned_to: update.assigned_to,
            assigned_profile: { name: update.assigned_name },
            status: 'Em Contato'
          };
        }
        return lead;
      });

      setLeads(updatedLeads);
      setShowDistributeModal(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      // Notify assigned sellers
      for (const update of updates) {
        await createNotification(
          update.assigned_to,
          'Novo Lead Recebido',
          `Um novo lead (${update.name || 'Novo Lead'}) foi distribuído para você.`,
          'info'
        );
      }
      
    } catch (err) {
      console.error('Error distributing leads:', err);
    } finally {
      setIsDistributing(false);
    }
  };

  const toggleVendedorSelection = async (id: string) => {
    const isSelected = selectedVendedores.includes(id);
    const newSelection = isSelected 
      ? selectedVendedores.filter(v => v !== id) 
      : [...selectedVendedores, id];
    
    setSelectedVendedores(newSelection);

    // Persist to Supabase
    try {
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

      if (isConfigured) {
        await supabase
          .from('profiles')
          .update({ receives_leads: !isSelected })
          .eq('id', id);
      }
      
      // Update local vendedores state to keep it in sync
      setVendedores(prev => prev.map(v => 
        v.id === id ? { ...v, receives_leads: !isSelected } : v
      ));
    } catch (err) {
      console.error('Error updating receives_leads:', err);
    }
  };

  const handleAssignLead = async (vendedorId: string) => {
    if (!selectedLeadForAssignment) return;
    
    setIsDistributing(true);
    try {
      const vendedor = vendedores.find(v => v.id === vendedorId);
      
      const isConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

      if (isConfigured) {
        const { error } = await supabase
          .from('leads')
          .update({ 
            assigned_to: vendedorId, 
            status: 'Em Contato' 
          })
          .eq('id', selectedLeadForAssignment.id);
        
        if (error) throw error;
      }

      // Update local state
      setLeads(prev => prev.map(l => 
        l.id === selectedLeadForAssignment.id 
          ? { ...l, assigned_to: vendedorId, assigned_profile: { name: vendedor?.name }, status: 'Em Contato' } 
          : l
      ));

      // Notify the seller
      if (vendedorId) {
        await createNotification(
          vendedorId,
          'Novo Lead Atribuído',
          `Você recebeu o lead ${selectedLeadForAssignment.name} (${selectedLeadForAssignment.company}).`,
          'info'
        );
      }

      setShowAssignModal(false);
      setSelectedLeadForAssignment(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Error assigning lead:', err);
      showToast('Erro ao atribuir lead.', 'error');
    } finally {
      setIsDistributing(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    showConfirm({
      title: 'Excluir Lead',
      message: 'Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      type: 'danger',
      onConfirm: async () => {
        try {
          const isConfigured = 
            process.env.NEXT_PUBLIC_SUPABASE_URL && 
            process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

          if (isConfigured && !tableMissing) {
            const { error } = await supabase
              .from('leads')
              .delete()
              .eq('id', leadId);
            
            if (error) throw error;
          }

          setLeads(prev => prev.filter(l => l.id !== leadId));
          showToast('Lead excluído com sucesso.', 'success');
        } catch (err) {
          console.error('Error deleting lead:', err);
          showToast('Erro ao excluir lead.', 'error');
        }
      }
    });
  };

  const handleDeleteAllLeads = async () => {
    if (!isAdmin) return;

    showConfirm({
      title: 'Limpar Todos os Leads',
      message: 'Tem certeza que deseja apagar TODOS os leads cadastrados? Esta ação é irreversível.',
      confirmLabel: 'Apagar Tudo',
      type: 'danger',
      onConfirm: async () => {
        try {
          const isConfigured = 
            process.env.NEXT_PUBLIC_SUPABASE_URL && 
            process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

          if (isConfigured && !tableMissing) {
            const { error } = await supabase
              .from('leads')
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
            
            if (error) throw error;
          }

          setLeads([]);
          showToast('Todos os leads foram apagados.', 'success');
        } catch (err) {
          console.error('Error deleting all leads:', err);
          showToast('Erro ao apagar todos os leads.', 'error');
        }
      }
    });
  };

  const handleEditLead = (lead: any) => {
    setNewLead({
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      segment: lead.segment,
      address: lead.address || '',
      neighborhood: lead.neighborhood || '',
      city: lead.city || '',
      reference: lead.reference || ''
    });
    setSelectedLeadForAssignment(lead); // Reusing this state to track the lead being edited
    setShowAddModal(true);
  };

  if (roleLoading || (loading && isAuthenticated && hasAccess)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  if (!hasAccess) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="p-4 bg-rose-50 rounded-full text-rose-600 mb-4">
          <Target size={48} />
        </div>
        <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Acesso Restrito</h1>
        <p className="text-slate-500 mt-2">Apenas administradores e vendedores podem visualizar os leads.</p>
        <Link href="/" className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
          Voltar para o Início
        </Link>
      </div>
    );
  }

  const filteredLeads = leads.filter(lead => {
    const normalizedPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
    const normalizedSearch = searchQuery.replace(/\D/g, '');
    const queryLower = searchQuery.toLowerCase().trim();
    
    const matchesSearch = !queryLower ||
                          (lead.name || '').toLowerCase().includes(queryLower) ||
                          (lead.company || '').toLowerCase().includes(queryLower) ||
                          (lead.email || '').toLowerCase().includes(queryLower) ||
                          (lead.segment || '').toLowerCase().includes(queryLower) ||
                          (normalizedPhone && normalizedSearch && normalizedPhone.includes(normalizedSearch));
    
    const matchesStatus = selectedStatusFilter === 'Todos' || (lead.status || 'Novo') === selectedStatusFilter;
    const matchesSegment = !selectedSegmentFilter || (lead.segment || 'Geral').trim() === selectedSegmentFilter;

    const isManagerOrAdmin = isAdmin || role === 'gerente' || role === 'supervisor';

    if (isManagerOrAdmin) return matchesSearch && matchesStatus && matchesSegment;
    
    // If vendedor, show assigned leads OR leads created by them
    // Fallback: If it's a mock lead (no assigned_to and no created_by), show it for testing purposes if the list would otherwise be empty
    const isMockLead = !lead.assigned_to && !lead.created_by;
    const isAssignedToMe = lead.assigned_to === user?.id || lead.created_by === user?.id;

    return matchesSearch && matchesStatus && matchesSegment && (isAssignedToMe || isMockLead);
  });

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`sticky top-0 z-10 backdrop-blur-md border-b transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center p-4 justify-between w-full">
          <Link href="/" className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">Gestão de Leads</h2>
          <div className={`flex size-10 items-center justify-end rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <Search size={20} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="p-4 space-y-6">
          {/* Vendedor UI: Lead Receiving Toggle & New Assignments Inbox (Visible to all for verification, labeled for admins) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {isAdmin ? 'Módulo do Vendedor (Visualização de Admin)' : 'Meu Painel de Recebimento'}
              </h4>
            </div>

            {/* Availability Toggle */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all shadow-sm ${
              userReceivesLeads 
                ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50 border-emerald-100')
                : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')
            }`}>
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-xl flex items-center justify-center ${
                  userReceivesLeads 
                    ? 'bg-emerald-100 text-emerald-600' 
                    : (isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400')
                }`}>
                  <Target size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Disponibilidade para Leads</h3>
                  <p className="text-[11px] text-slate-500">
                    {userReceivesLeads 
                      ? 'Você está ativo e receberá leads distribuídos.' 
                      : 'Você está marcado como ocupado (não recebe novos leads).'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleMyAvailability}
                disabled={isUpdatingAvailability}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  userReceivesLeads ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    userReceivesLeads ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* New Assignments Inbox (Show if there are new leads assigned to current user) */}
            {leads.some(l => l.assigned_to === user?.id && l.status === 'Novo') && (
              <div className={`p-4 rounded-2xl border bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 overflow-hidden relative`}>
                <div className="absolute -right-4 -top-4 size-24 bg-white/10 rounded-full blur-2xl" />
                <div className="relative z-10 flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shuffle size={18} className="animate-pulse" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Novos Leads Recebidos</h3>
                  </div>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black">
                    {leads.filter(l => l.assigned_to === user?.id && l.status === 'Novo').length} PENDENTES
                  </span>
                </div>
                <p className="text-xs text-indigo-100 mb-4 leading-relaxed">
                  Você tem novos leads aguardando o primeiro contato.
                </p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {leads
                    .filter(l => l.assigned_to === user?.id && l.status === 'Novo')
                    .slice(0, 5)
                    .map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => {
                          setSearchQuery(lead.name);
                          setSelectedStatusFilter('Novo');
                        }}
                        className="flex-shrink-0 bg-white/10 hover:bg-white/20 border border-white/10 p-3 rounded-xl transition-all text-left min-w-[160px]"
                      >
                        <p className="text-[11px] font-black truncate">{lead.name}</p>
                        <p className="text-[9px] opacity-70 truncate">{lead.company}</p>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {(isAdmin || role === 'gerente') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="size-2 rounded-full bg-emerald-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status da Equipe (Admin)</h4>
              </div>
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold">Disponibilidade dos Vendedores</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Indicador de quem está apto a receber leads</p>
                  </div>
                  <button 
                    onClick={fetchVendedores}
                    className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    <Shuffle size={16} className={isDistributing ? 'animate-spin' : ''} />
                  </button>
                </div>
                {vendedores.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {vendedores.map((vendedor) => (
                      <div 
                        key={vendedor.id}
                        className={`flex flex-col items-center p-3 rounded-2xl border min-w-[100px] transition-all relative ${
                          vendedor.receives_leads !== false
                            ? (isDarkMode ? 'bg-indigo-600/10 border-indigo-600/50' : 'bg-indigo-50 border-indigo-200')
                            : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100')
                        }`}
                      >
                        <div className="relative size-12 mb-2">
                          <Image 
                            src={vendedor.image_url || `https://picsum.photos/seed/${vendedor.id}/100`}
                            alt={vendedor.name}
                            fill
                            referrerPolicy="no-referrer"
                            className={`rounded-full object-cover ${(vendedor.status !== 'Ativo' && vendedor.status) ? 'grayscale contrast-75' : ''}`}
                          />
                          <div className={`absolute -top-1 -right-1 size-5 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center transition-colors ${
                            vendedor.receives_leads !== false && (vendedor.status === 'Ativo' || !vendedor.status) ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-500'
                          }`}>
                            {vendedor.receives_leads !== false && (vendedor.status === 'Ativo' || !vendedor.status) ? <Check size={10} /> : <X size={10} />}
                          </div>
                          
                          {/* Visual indicator for 'Inativo' status */}
                          {(vendedor.status !== 'Ativo' && vendedor.status) && (
                            <div className="absolute -bottom-1 -left-1 px-1 rounded-md bg-rose-500 text-white text-[7px] font-black uppercase">
                              Inativo
                            </div>
                          )}
                        </div>
                        <p className={`text-[11px] font-bold text-center truncate w-full ${
                          vendedor.receives_leads !== false 
                            ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-700')
                            : 'text-slate-500'
                        }`}>
                          {(vendedor.name || 'Sem Nome').split(' ')[0]}
                        </p>
                        <p className="text-[8px] font-black uppercase text-slate-400 mt-0.5 tracking-tighter">
                          {vendedor.type || vendedor.role || 'Consultor'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Users size={24} className="mx-auto mb-2 text-slate-300 animate-pulse" />
                    <p className="text-xs text-slate-500">Nenhum vendedor disponível para receber leads.</p>
                    <button 
                      onClick={fetchVendedores}
                      className="mt-2 text-[10px] font-bold text-blue-600 uppercase hover:underline"
                    >
                      Tentar Recarregar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="h-px bg-slate-200 dark:bg-slate-800" />

          {/* Search Segment UI (Admin Only) */}
          {(isAdmin || role === 'gerente') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="size-2 rounded-full bg-indigo-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gerador Inteligente (Admin)</h4>
              </div>
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <h3 className="text-sm font-bold mb-3">Encontrar novos clientes</h3>
                <div className="flex gap-2">
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="text"
                      placeholder="Ex: Padarias em João Pessoa"
                      value={searchSegment}
                      onChange={(e) => setSearchSegment(e.target.value)}
                      className={`w-full h-11 pl-4 pr-12 rounded-xl border outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <VoiceSearch 
                        onResult={(text) => setSearchSegment(text)} 
                        isDarkMode={isDarkMode} 
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSearchLeads}
                    disabled={isSearching}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSearching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search and Status Filters Component */}
          <div className={`p-4 rounded-2xl border space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            {/* Search Input Bar */}
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nome, empresa, e-mail, telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-11 pl-10 pr-24 rounded-xl border text-sm font-medium outline-none transition-all ${
                  isDarkMode 
                    ? 'bg-slate-950/80 border-slate-800 text-slate-100 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30'
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <VoiceSearch 
                  onResult={(text) => setSearchQuery(text)} 
                  isDarkMode={isDarkMode} 
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                    title="Limpar pesquisa"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter Chips Header & Horizontal Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Filter size={12} className="text-blue-500" />
                  Filtrar por Status do Lead
                </span>
                {(searchQuery || selectedStatusFilter !== 'Todos' || selectedSegmentFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedStatusFilter('Todos');
                      setSelectedSegmentFilter(null);
                    }}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider hover:underline flex items-center gap-1"
                  >
                    <X size={12} />
                    Limpar Filtros
                  </button>
                )}
              </div>

              {/* Status Pills */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5">
                {availableStatuses.map((st) => {
                  const count = statusCounts[st] || 0;
                  const isSelected = selectedStatusFilter === st;

                  const getBadgeStyle = () => {
                    if (!isSelected) {
                      return isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100/80';
                    }
                    switch (st) {
                      case 'Novo':
                        return 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20';
                      case 'Em Contato':
                        return 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20';
                      case 'Qualificado':
                        return 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20';
                      case 'Concluído':
                      case 'Convertido':
                        return 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20';
                      default:
                        return 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900 shadow-md';
                    }
                  };

                  return (
                    <button
                      key={st}
                      onClick={() => setSelectedStatusFilter(st)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border shrink-0 ${getBadgeStyle()}`}
                    >
                      <span>{st}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Results Count Summary */}
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <span>
                Exibindo <strong className="text-slate-900 dark:text-slate-100 font-bold">{filteredLeads.length}</strong> de <strong className="text-slate-900 dark:text-slate-100 font-bold">{leads.length}</strong> leads
              </span>
              {selectedSegmentFilter && (
                <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                  Nicho: {selectedSegmentFilter}
                  <button onClick={() => setSelectedSegmentFilter(null)} className="hover:text-rose-500">
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {(isAdmin || role === 'gerente') && (
              <button 
                onClick={() => {
                  setNewLead({ 
                    name: '', 
                    company: '', 
                    email: '', 
                    phone: '', 
                    segment: 'Geral',
                    address: '',
                    neighborhood: '',
                    city: '',
                    reference: ''
                  });
                  setSelectedLeadForAssignment(null);
                  setShowAddModal(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white h-12 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
              >
                <Plus size={20} />
                <span>Novo Lead</span>
              </button>
            )}
            
            {canAccessLeads && (
              <button 
                onClick={handleSync}
                disabled={isDistributing}
                className={`flex size-12 items-center justify-center rounded-xl border transition-all ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'
                } ${isDistributing ? 'animate-pulse opacity-50' : ''}`}
                title="Sincronizar Vendedores e Leads"
              >
                <Shuffle size={20} className={isDistributing ? 'animate-spin' : 'text-blue-600'} />
              </button>
            )}
            
            {(isAdmin || role === 'gerente') && (
              <button 
                onClick={async () => {
                  setIsDistributing(true);
                  await fetchVendedores();
                  setIsDistributing(false);
                  setShowDistributeModal(true);
                }}
                disabled={isDistributing}
                className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all active:scale-95 border-2 ${
                  isDarkMode 
                    ? 'bg-slate-900 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10' 
                    : 'bg-white border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-sm'
                } ${isDistributing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Shuffle size={18} className={isDistributing ? 'animate-spin' : ''} />
                <span>Distribuir Leads</span>
              </button>
            )}

            {isAdmin && (
              <button 
                onClick={handleDeleteAllLeads}
                className={`flex size-12 items-center justify-center rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95`}
                title="Apagar Todos os Leads"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>

          {/* Leads Map */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-blue-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Distribuição Geográfica</h4>
              </div>
              <span className="text-[10px] text-slate-400 italic">Visualização de Leads no Mapa</span>
            </div>
            <LeadsMap leads={filteredLeads} isDarkMode={isDarkMode} />
          </div>

          {/* Gráfico de Leads por Segmento (Nichos Promissores) */}
          <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20">
                    <BarChart3 size={18} />
                  </div>
                  <h3 className="text-sm font-bold tracking-tight">Leads por Segmento (Nichos Promissores)</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Identificação dos nichos de mercado com maior concentração de oportunidades. Clique em uma barra para filtrar.
                </p>
              </div>

              {selectedSegmentFilter && (
                <button
                  onClick={() => setSelectedSegmentFilter(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 hover:bg-indigo-200 transition-all self-start sm:self-auto flex items-center gap-1.5"
                >
                  <span>Filtro: {selectedSegmentFilter}</span>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Key Segment Indicators */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200/60'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Nichos</p>
                <p className="text-base font-black text-blue-600 dark:text-blue-400">{segmentData.length}</p>
              </div>
              <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200/60'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nicho Líder</p>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 truncate">
                  {segmentData[0]?.segment || 'N/A'} ({segmentData[0]?.total || 0})
                </p>
              </div>
              <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200/60'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Leads</p>
                <p className="text-base font-black text-indigo-600 dark:text-indigo-400">{leads.length}</p>
              </div>
            </div>

            {/* Recharts BarChart Component */}
            {segmentData.length > 0 ? (
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={segmentData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                    <XAxis
                      dataKey="segment"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    />
                    <Tooltip
                      cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value: any) => [`${value} Leads`, 'Volume']}
                      labelFormatter={(label: any) => `Segmento: ${label}`}
                    />
                    <Bar
                      dataKey="total"
                      radius={[6, 6, 0, 0]}
                      onClick={(entry: any) => {
                        if (entry && entry.segment) {
                          setSelectedSegmentFilter(
                            selectedSegmentFilter === entry.segment ? null : entry.segment
                          );
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {segmentData.map((entry, index) => {
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#6366f1'];
                        const isSelected = selectedSegmentFilter === entry.segment;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={colors[index % colors.length]}
                            opacity={selectedSegmentFilter ? (isSelected ? 1 : 0.35) : 1}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">Nenhum dado de segmento disponível.</div>
            )}
          </div>

          {/* Table Missing Warning */}
          {tableMissing && isAdmin && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-500">Banco de Dados não configurado</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  A tabela <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">leads</code> não foi encontrada no Supabase. 
                  Novos leads serão salvos apenas localmente nesta sessão.
                </p>
                <button 
                  onClick={() => {
                    const sql = `-- 1. Create the leads table\nCREATE TABLE IF NOT EXISTS leads (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  name TEXT NOT NULL,\n  company TEXT NOT NULL,\n  email TEXT,\n  phone TEXT,\n  segment TEXT DEFAULT 'Geral',\n  status TEXT DEFAULT 'Novo',\n  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,\n  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL\n);\n\n-- 2. Add columns to profiles if they don't exist\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS receives_leads BOOLEAN DEFAULT true;\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_access_leads BOOLEAN DEFAULT false;\n\n-- 3. Enable Row Level Security\nALTER TABLE leads ENABLE ROW LEVEL SECURITY;\n\n-- 4. Create policies\nCREATE POLICY "Allow all on leads" ON leads FOR ALL USING (true) WITH CHECK (true);`;
                    navigator.clipboard.writeText(sql);
                    showToast('SQL copiado! Cole no SQL Editor do Supabase.', 'success');
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:underline"
                >
                  Copiar SQL para criar tabela
                </button>
              </div>
            </div>
          )}

          {/* Vendedores Overview (Admin/Gerente Only) */}
          {/* Leads List */}
          <div className="space-y-3">
            {filteredLeads.length > 0 ? (
              filteredLeads.map((lead, idx) => (
                <motion.div
                  key={`${lead.id}-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-4 rounded-2xl border transition-all ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  {/* ... lead content ... */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-xl flex items-center justify-center ${
                        isDarkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                      }`}>
                        <User size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-base leading-tight">{lead.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Briefcase size={12} className="text-slate-400" />
                          <p className="text-xs font-medium text-slate-500">{lead.company}</p>
                        </div>
                        {lead.address && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <MapPin size={12} className="text-slate-400" />
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{lead.address}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.status === 'Novo' && lead.assigned_to && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[8px] font-black uppercase animate-pulse shadow-sm shadow-amber-500/20">
                          Recém Enviado
                        </span>
                      )}
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        lead.status === 'Novo' ? 'bg-blue-100 text-blue-600' :
                        lead.status === 'Em Contato' ? 'bg-amber-100 text-amber-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {lead.status}
                      </span>
                      {(isAdmin || role === 'gerente') && (
                        <div className="flex gap-1">
                          <button onClick={() => handleEditLead(lead)} className="p-1.5 text-slate-400 hover:text-blue-600">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteLead(lead.id)} className="p-1.5 text-slate-400 hover:text-rose-600">
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className={`grid grid-cols-2 gap-y-3 gap-x-4 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-indigo-500" />
                      <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{lead.segment || 'Geral'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-500">{lead.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-500 truncate">{lead.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-500">
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        <span className="ml-2 font-bold text-amber-600">
                          (Prazo: {new Date(new Date(lead.created_at).setDate(new Date(lead.created_at).getDate() + 5)).toLocaleDateString('pt-BR')})
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Salesperson Interaction Fields */}
                  {lead.assigned_to === user?.id && lead.status !== 'Concluído' && (
                    <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} space-y-3`}>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Teor da Conversa</label>
                        <textarea className={`w-full p-2 rounded-lg text-xs ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`} rows={2} placeholder="Descreva a conversa..." />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-500">Já conhecia?</label>
                          <select className={`w-full p-2 rounded-lg text-xs ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                            <option>Não</option>
                            <option>Sim</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-500">Já tinha interesse?</label>
                          <select className={`w-full p-2 rounded-lg text-xs ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                            <option>Não</option>
                            <option>Sim</option>
                          </select>
                        </div>
                      </div>
                      <button 
                        className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-emerald-700 transition-all"
                        onClick={async () => {
                          // Find admin
                          const { data: admin } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('role', 'admin')
                            .limit(1)
                            .single();
                          
                          if (admin) {
                            await createNotification(admin.id, 'Lead Concluído', `O lead ${lead.name} foi concluído pelo vendedor ${user?.name || 'Vendedor'}.`, 'success');
                          }
                          
                          showToast('Lead concluído com sucesso!', 'success');
                          // Update status locally
                          setLeads(prev => prev.map(l => l.id === lead.id ? {...l, status: 'Concluído'} : l));
                        }}
                      >
                        Concluir Lead
                      </button>
                    </div>
                  )}

                  {(lead.assigned_profile?.name || lead.assigned_name) ? (
                    <div className={`mt-3 pt-3 border-t flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <User size={12} />
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Responsável:</span>
                        <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                          {lead.assigned_profile?.name || lead.assigned_name}
                        </span>
                      </div>
                      {canAccessLeads && (
                        <button 
                          onClick={async () => {
                            setIsDistributing(true);
                            await fetchVendedores();
                            setIsDistributing(false);
                            setSelectedLeadForAssignment(lead);
                            setShowAssignModal(true);
                          }}
                          disabled={isDistributing}
                          className={`text-[11px] font-bold uppercase transition-colors ${
                            isDistributing ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600'
                          }`}
                        >
                          {isDistributing ? 'Carregando...' : 'Alterar'}
                        </button>
                      )}
                    </div>
                  ) : (
                    canAccessLeads && (
                      <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                        <button 
                          onClick={async () => {
                            setIsDistributing(true);
                            await fetchVendedores();
                            setIsDistributing(false);
                            setSelectedLeadForAssignment(lead);
                            setShowAssignModal(true);
                          }}
                          disabled={isDistributing}
                          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-[11px] font-bold uppercase tracking-wider hover:bg-indigo-100 transition-all ${
                            isDistributing ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Shuffle size={12} className={isDistributing ? 'animate-spin' : ''} />
                          {isDistributing ? 'Carregando Vendedores...' : 'Atribuir Vendedor'}
                        </button>
                      </div>
                    )
                  )}
                </motion.div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500">
                <p>Nenhum lead encontrado.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className={`relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl transition-colors ${
                isDarkMode ? 'bg-slate-900' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{selectedLeadForAssignment ? 'Editar Lead' : 'Novo Lead'}</h3>
                    <p className="text-xs text-slate-500">{selectedLeadForAssignment ? 'Edite os dados do cliente' : 'Cadastre um novo potencial cliente'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddLead} className="space-y-3 overflow-y-auto pr-1 flex-1">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nome do Contato *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      required
                      type="text"
                      placeholder="Ex: João Silva"
                      value={newLead.name || ''}
                      onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                      className={`w-full h-11 pl-11 pr-4 rounded-xl border outline-none transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Empresa *</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      required
                      type="text"
                      placeholder="Ex: Restaurante Central"
                      value={newLead.company || ''}
                      onChange={(e) => setNewLead({...newLead, company: e.target.value})}
                      className={`w-full h-11 pl-11 pr-4 rounded-xl border outline-none transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="email"
                        placeholder="joao@email.com"
                        value={newLead.email || ''}
                        onChange={(e) => {
                          const email = e.target.value;
                          setNewLead({...newLead, email});
                          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                            setEmailError('E-mail inválido.');
                          } else {
                            setEmailError('');
                          }
                        }}
                        className={`w-full h-11 pl-11 pr-4 rounded-xl border outline-none transition-all ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                        } ${emailError ? 'border-rose-500' : ''}`}
                      />
                    </div>
                    {emailError && <p className="text-xs text-rose-500 mt-1">{emailError}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={newLead.phone || ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/\D/g, '');
                          let formattedValue = rawValue;
                          
                          if (rawValue.length <= 10) {
                            formattedValue = rawValue.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
                          } else {
                            formattedValue = rawValue.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
                          }
                          
                          setNewLead({...newLead, phone: formattedValue});
                          
                          if (rawValue.length > 0 && rawValue.length < 10) {
                            setPhoneError('Telefone inválido (mínimo 10 dígitos).');
                          } else {
                            setPhoneError('');
                          }
                        }}
                        className={`w-full h-11 pl-11 pr-4 rounded-xl border outline-none transition-all ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                        } ${phoneError ? 'border-rose-500' : ''}`}
                      />
                    </div>
                    {phoneError && <p className="text-xs text-rose-500 mt-1">{phoneError}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Segmento</label>
                  <div className="relative">
                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select 
                      value={newLead.segment || ''}
                      onChange={(e) => setNewLead({...newLead, segment: e.target.value})}
                      className={`w-full h-11 pl-11 pr-10 rounded-xl border outline-none transition-all appearance-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                      }`}
                    >
                      <option value="Geral">Geral</option>
                      <option value="Restaurante">Restaurante</option>
                      <option value="Padaria">Padaria</option>
                      <option value="Açougue">Açougue</option>
                      <option value="Doceria">Doceria</option>
                      <option value="Mercado">Mercado</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Filter size={14} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Endereço (Rua e Número)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      placeholder="Ex: Rua das Flores, 123"
                      value={newLead.address || ''}
                      onChange={(e) => setNewLead({...newLead, address: e.target.value})}
                      className={`w-full h-11 pl-11 pr-4 rounded-xl border outline-none transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bairro</label>
                    <input 
                      type="text"
                      placeholder="Ex: Centro"
                      value={newLead.neighborhood || ''}
                      onChange={(e) => setNewLead({...newLead, neighborhood: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border outline-none transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cidade</label>
                    <input 
                      type="text"
                      placeholder="Ex: São Paulo"
                      value={newLead.city || ''}
                      onChange={(e) => setNewLead({...newLead, city: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border outline-none transition-all ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ponto de Referência / Complemento</label>
                  <input 
                    type="text"
                    placeholder="Ex: Próximo à praça central, Loja 2"
                    value={newLead.reference || ''}
                    onChange={(e) => setNewLead({...newLead, reference: e.target.value})}
                    className={`w-full h-11 px-4 rounded-xl border outline-none transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                    }`}
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className={`flex-1 py-3.5 rounded-2xl font-bold transition-colors ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className={`flex-[2] py-3.5 rounded-2xl font-bold text-white transition-all shadow-lg shadow-blue-600/20 active:scale-95 ${
                      isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Lead'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAssignModal && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAssignModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className={`relative w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl transition-colors ${
                isDarkMode ? 'bg-slate-900' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Atribuir Lead</h3>
                    <p className="text-xs text-slate-500">Selecione o vendedor para {selectedLeadForAssignment?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={fetchVendedores}
                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                    title="Atualizar lista"
                  >
                    <Shuffle size={18} className={isDistributing ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setShowAssignModal(false)}
                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar vendedor..."
                    value={vendedorSearchQuery}
                    onChange={(e) => setVendedorSearchQuery(e.target.value)}
                    className={`w-full h-10 pl-10 pr-4 rounded-xl text-xs outline-none border transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto mb-6 pr-2 custom-scrollbar">
                {vendedores.filter(v => v.name?.toLowerCase().includes(vendedorSearchQuery.toLowerCase())).map((vendedor) => (
                  <button
                    key={vendedor.id}
                    onClick={() => handleAssignLead(vendedor.id)}
                    disabled={isDistributing || (vendedor.status !== 'Ativo' && vendedor.status)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      selectedLeadForAssignment?.assigned_to === vendedor.id
                        ? (isDarkMode ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-200')
                        : (isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100')
                    } ${isDistributing || (vendedor.status !== 'Ativo' && vendedor.status) ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full overflow-hidden bg-slate-200 relative">
                        <Image 
                          src={vendedor.image_url || `https://picsum.photos/seed/${vendedor.id}/100`}
                          alt={vendedor.name}
                          fill
                          className={`object-cover ${(vendedor.status !== 'Ativo' && vendedor.status) ? 'grayscale opacity-50' : ''}`}
                        />
                        {(vendedor.status !== 'Ativo' && vendedor.status) && (
                          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                            <X size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <p className={`font-bold text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'} flex items-center gap-2`}>
                          {vendedor.name || 'Sem Nome'}
                          {(vendedor.status !== 'Ativo' && vendedor.status) && (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-600 text-[7px] font-black uppercase">Inativo</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{vendedor.role || 'Vendedor'}</p>
                      </div>
                    </div>
                    {selectedLeadForAssignment?.assigned_to === vendedor.id && (
                      <div className="size-6 rounded-full bg-blue-600 flex items-center justify-center text-white">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setShowAssignModal(false)}
                className={`w-full py-4 rounded-2xl font-bold transition-colors ${
                  isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}

        {showDistributeModal && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDistributeModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className={`relative w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl transition-colors ${
                isDarkMode ? 'bg-slate-900' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Shuffle size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Distribuir Leads</h3>
                    <p className="text-xs text-slate-500">Defina quem está ativo para receber novos leads</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={fetchVendedores}
                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                    title="Atualizar lista"
                  >
                    <Shuffle size={18} className={isDistributing ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setShowDistributeModal(false)}
                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar vendedor..."
                    value={vendedorSearchQuery}
                    onChange={(e) => setVendedorSearchQuery(e.target.value)}
                    className={`w-full h-10 pl-10 pr-4 rounded-xl text-xs outline-none border transition-all ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-blue-600' : 'bg-slate-50 border-slate-200 focus:border-blue-600'
                    }`}
                  />
                </div>
              </div>

              <div className="mb-6 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3">Modo de Distribuição</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setDistributionMode('balanced')}
                    className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      distributionMode === 'balanced' 
                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                        : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500')
                    }`}
                  >
                    <Users size={18} />
                    <span className="text-[10px] font-bold uppercase">Equilibrada</span>
                  </button>
                  <button 
                    onClick={() => setDistributionMode('random')}
                    className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      distributionMode === 'random' 
                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                        : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500')
                    }`}
                  >
                    <Shuffle size={18} />
                    <span className="text-[10px] font-bold uppercase">Aleatória</span>
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 mt-3 italic">
                  {distributionMode === 'balanced' 
                    ? 'Distribui os leads de forma igualitária entre os vendedores selecionados.' 
                    : 'Distribui os leads de forma totalmente aleatória entre os vendedores selecionados.'}
                </p>
              </div>

              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vendedores Disponíveis</p>
                <button 
                  onClick={async () => {
                    const allSelected = selectedVendedores.length === vendedores.length;
                    const newSelection = allSelected ? [] : vendedores.map(v => v.id);
                    setSelectedVendedores(newSelection);

                    // Persist to Supabase
                    try {
                      const isConfigured = 
                        process.env.NEXT_PUBLIC_SUPABASE_URL && 
                        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url.supabase.co';

                      if (isConfigured) {
                        // Update all vendedores in the list
                        for (const v of vendedores) {
                          await supabase
                            .from('profiles')
                            .update({ receives_leads: !allSelected })
                            .eq('id', v.id);
                        }
                      }
                      
                      setVendedores(prev => prev.map(v => ({ ...v, receives_leads: !allSelected })));
                    } catch (err) {
                      console.error('Error updating bulk receives_leads:', err);
                    }
                  }}
                  className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
                >
                  {selectedVendedores.length === vendedores.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto mb-6 pr-2 custom-scrollbar">
                {vendedores.filter(v => v.name?.toLowerCase().includes(vendedorSearchQuery.toLowerCase())).length > 0 ? (
                  vendedores.filter(v => v.name?.toLowerCase().includes(vendedorSearchQuery.toLowerCase())).map((vendedor) => (
                    <button
                      key={vendedor.id}
                      onClick={() => toggleVendedorSelection(vendedor.id)}
                      disabled={(vendedor.status !== 'Ativo' && vendedor.status)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        selectedVendedores.includes(vendedor.id)
                          ? (isDarkMode ? 'bg-indigo-900/20 border-indigo-500' : 'bg-indigo-50 border-indigo-200')
                          : (isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100')
                      } ${(vendedor.status !== 'Ativo' && vendedor.status) ? 'opacity-40 cursor-not-allowed border-dashed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full overflow-hidden bg-slate-200 relative">
                          <Image 
                            src={vendedor.image_url || `https://picsum.photos/seed/${vendedor.id}/100`}
                            alt={vendedor.name}
                            fill
                            className={`object-cover ${(vendedor.status !== 'Ativo' && vendedor.status) ? 'grayscale' : ''}`}
                          />
                        </div>
                        <div className="text-left">
                          <p className={`font-bold text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'} flex items-center gap-2`}>
                            {vendedor.name || 'Sem Nome'}
                            {(vendedor.status !== 'Ativo' && vendedor.status) && (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-600 text-[7px] font-black uppercase">Fora da Lista</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{vendedor.role || 'Vendedor'}</p>
                        </div>
                      </div>
                      <div className={`size-6 rounded-full flex items-center justify-center border-2 transition-all ${
                        selectedVendedores.includes(vendedor.id)
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : (isDarkMode ? 'border-slate-700' : 'border-slate-200')
                      }`}>
                        {selectedVendedores.includes(vendedor.id) && <Check size={14} />}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-500">
                    <Users size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhum vendedor encontrado.</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDistributeModal(false)}
                  className={`flex-1 py-4 rounded-2xl font-bold transition-colors ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDistributeLeads}
                  disabled={isDistributing || selectedVendedores.length === 0}
                  className={`flex-[2] py-4 rounded-2xl font-bold text-white transition-all shadow-lg shadow-indigo-600/20 active:scale-95 ${
                    isDistributing || selectedVendedores.length === 0
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isDistributing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Distribuindo...</span>
                    </div>
                  ) : (
                    <span>Confirmar Distribuição</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 z-[100]"
          >
            <CheckCircle2 size={20} />
            Leads distribuídos com sucesso!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
