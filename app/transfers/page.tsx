'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Edit2, Trash2, Package, Clock, CheckCircle2, Send, XCircle, MoreVertical, X, User, LayoutGrid, List, Columns, Table, Settings, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@/hooks/useTheme';
import { supabase, handleSupabaseAuthError } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { useRole } from '@/hooks/useRole';
import { getInactiveCollaboratorIds } from '@/lib/collaboratorStatus';
import { getAllCatalogProducts, findProductByCode, CatalogProduct } from '@/lib/catalogProducts';

export interface RequestedProductItem {
  id: string;
  code: string;
  name: string;
  reference: string;
  quantity: number;
}

function parseDescriptionToItems(desc: string): RequestedProductItem[] {
  if (!desc || !desc.trim()) {
    return [{ id: crypto.randomUUID(), code: '', name: '', reference: '', quantity: 1 }];
  }

  const lines = desc.split('\n').filter(l => l.trim().length > 0);
  const items: RequestedProductItem[] = [];

  for (const line of lines) {
    const qtyMatch = line.match(/^(\d+)\s*x\s*/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    let rest = qtyMatch ? line.substring(qtyMatch[0].length) : line;

    const codeMatch = rest.match(/^\[([^\]]+)\]\s*/);
    const code = codeMatch ? codeMatch[1] : '';
    if (codeMatch) {
      rest = rest.substring(codeMatch[0].length);
    }

    const refMatch = rest.match(/\(Ref:\s*([^)]+)\)/i);
    const reference = refMatch ? refMatch[1] : '';
    if (refMatch) {
      rest = rest.replace(refMatch[0], '').trim();
    }

    const name = rest.trim();
    items.push({
      id: crypto.randomUUID(),
      code,
      name: name || desc,
      reference,
      quantity: isNaN(qty) ? 1 : qty
    });
  }

  return items.length > 0 ? items : [{ id: crypto.randomUUID(), code: '', name: desc, reference: '', quantity: 1 }];
}

function formatItemsToDescription(items: RequestedProductItem[]): string {
  return items
    .filter(item => item.name.trim() || item.code.trim())
    .map(item => {
      const qtyStr = `${item.quantity || 1}x`;
      const codeStr = item.code.trim() ? `[${item.code.trim()}] ` : '';
      const refStr = item.reference.trim() ? ` (Ref: ${item.reference.trim()})` : '';
      return `${qtyStr} ${codeStr}${item.name.trim()}${refStr}`.trim();
    })
    .join('\n');
}

type TransferStatus = 'Solicitado' | 'Em separação' | 'Separado' | 'Enviado' | 'Desistiu';

interface Collaborator {
  id: string;
  name: string;
  type?: string;
  role?: string;
  status?: string;
  active?: boolean;
}

interface Transfer {
  id: string;
  sequentialNumber: number;
  requesterName: string;
  requesterId?: string;
  description: string;
  requestDate: string;
  status: TransferStatus;
  createdAt: string;
  responsibleId?: string;
  type?: 'solicitada' | 'recebida';
}

const STATUS_COLORS = {
  'Solicitado': 'bg-slate-100 text-slate-700 border-slate-200',
  'Em separação': 'bg-amber-100 text-amber-700 border-amber-200',
  'Separado': 'bg-blue-100 text-blue-700 border-blue-200',
  'Enviado': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Desistiu': 'bg-rose-100 text-rose-700 border-rose-200',
};

const STATUS_ICONS = {
  'Solicitado': <Clock size={14} />,
  'Em separação': <Clock size={14} />,
  'Separado': <Package size={14} />,
  'Enviado': <Send size={14} />,
  'Desistiu': <XCircle size={14} />,
};

const TYPE_COLORS = {
  'solicitada': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'recebida': 'bg-teal-100 text-teal-700 border-teal-200',
};

const TYPE_LABELS = {
  'solicitada': 'Solicitada',
  'recebida': 'Recebida',
};

export default function TransfersPage() {
  const { createNotification } = useNotifications();
  const { user, isAdmin, role: currentRole } = useRole();
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'kanban' | 'table'>('list');
  const [activeTab, setActiveTab] = useState<'todas' | 'solicitada' | 'recebida' | 'meus'>('todas');
  const [statusFilter, setStatusFilter] = useState<TransferStatus | 'Todos'>('Todos');
  const [visibleRoles, setVisibleRoles] = useState<string[]>(['admin', 'estoque']);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState<string | null>(null);
  const [missingTable, setMissingTable] = useState(false);
  const [missingTasksTable, setMissingTasksTable] = useState(false);

  // Form state
  const [requesterName, setRequesterName] = useState('');
  const [description, setDescription] = useState('');
  const [requestedItems, setRequestedItems] = useState<RequestedProductItem[]>([
    { id: crypto.randomUUID(), code: '', name: '', reference: '', quantity: 1 }
  ]);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<TransferStatus>('Em separação');
  const [responsibleId, setResponsibleId] = useState<string>('');
  const [transferType, setTransferType] = useState<'solicitada' | 'recebida'>('solicitada');

  const catalogProducts = React.useMemo(() => {
    return typeof window !== 'undefined' ? getAllCatalogProducts() : [];
  }, []);

  const handleAddItem = () => {
    setRequestedItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), code: '', name: '', reference: '', quantity: 1 }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (requestedItems.length <= 1) return;
    setRequestedItems(prev => prev.filter(i => i.id !== id));
  };

  const handleItemCodeChange = (index: number, codeVal: string) => {
    setRequestedItems(prev => {
      const copy = [...prev];
      const item = { ...copy[index], code: codeVal };

      if (codeVal.trim()) {
        const found = catalogProducts.find(p => 
          p.code?.toLowerCase() === codeVal.trim().toLowerCase() ||
          p.additionalCode?.toLowerCase() === codeVal.trim().toLowerCase()
        );
        if (found) {
          item.name = found.name;
          item.reference = found.additionalCode || '';
        }
      }

      copy[index] = item;
      return copy;
    });
  };

  const handleItemNameChange = (index: number, nameVal: string) => {
    setRequestedItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], name: nameVal };
      return copy;
    });
  };

  const handleItemReferenceChange = (index: number, refVal: string) => {
    setRequestedItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], reference: refVal };
      return copy;
    });
  };

  const handleItemQtyChange = (index: number, qtyVal: number) => {
    setRequestedItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: Math.max(1, qtyVal) };
      return copy;
    });
  };

  const selectCatalogProduct = (index: number, prod: CatalogProduct) => {
    setRequestedItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        code: prod.code || '',
        name: prod.name || '',
        reference: prod.additionalCode || ''
      };
      return copy;
    });
    setFocusedItemIndex(null);
  };

  useEffect(() => {
    async function fetchCollaborators() {
      try {
        let profilesData: any[] | null = null;
        let { data, error }: { data: any[] | null; error: any } = await supabase
          .from('profiles')
          .select('id, name, type, role, status')
          .order('name');
        
        if (error && (error.message?.includes('column') || error.code === '42703')) {
          const fallback = await supabase
            .from('profiles')
            .select('id, name, type, role')
            .order('name');
          if (!fallback.error && fallback.data) {
            data = fallback.data as any;
            error = null;
          } else {
            const fallback2 = await supabase
              .from('profiles')
              .select('id, name, type')
              .order('name');
            data = fallback2.data as any;
            error = fallback2.error;
          }
        }

        if (!error && data && data.length > 0) {
          profilesData = data;
        } else {
          // Fallback para rota /api/collaborators que contorna RLS e traz status, type e role
          try {
            const res = await fetch('/api/collaborators');
            const json = await res.json();
            if (json?.collaborators?.length) {
              profilesData = json.collaborators;
            }
          } catch (apiErr) {
            console.warn('Falha no fallback de colaboradores:', apiErr);
          }
        }

        if (profilesData && profilesData.length > 0) {
          setCollaborators(profilesData);
        } else if (data) {
          setCollaborators(data);
        }
      } catch (err: any) {
        if (err?.message === 'Failed to fetch' || err?.message?.includes('Failed to fetch') || err instanceof TypeError) {
          return;
        }
        console.error('Unexpected error fetching collaborators:', err);
      }
    }

    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'transfers_visible_roles')
          .single();
        
        if (error) {
          const isJwtExpired = error.code === 'PGRST303' || error.message?.includes('JWT expired');
          if (isJwtExpired) {
            await handleSupabaseAuthError(error);
            return;
          }

          const isMissingTable = error.message?.includes('schema cache') || error.message?.includes('Could not find the table');
          const isNetworkError = error.message?.includes('Failed to fetch') || error.message?.includes('TypeError');
          const isRecursionError = error.code === '42P17' || error.message?.includes('infinite recursion');
          if (error.code !== 'PGRST116' && error.code !== '42P01' && !isMissingTable && !isNetworkError && !isRecursionError) {
            if (Object.keys(error).length > 0 || error.message) {
              console.warn('Aviso ao buscar configurações:', error.message || error);
            }
          } else if (isRecursionError) {
            console.warn('Aviso: Política RLS em loop (42P17) ao carregar configurações.');
          }
        } else if (data && data.value) {
          let parsedValue = data.value;
          if (typeof parsedValue === 'string') {
            try {
              parsedValue = JSON.parse(parsedValue);
            } catch (e) {}
          }
          if (Array.isArray(parsedValue)) {
            setVisibleRoles(parsedValue);
          }
        }
      } catch (err: any) {
        const isNetworkError = err?.message?.includes('Failed to fetch') || err?.name === 'TypeError' || err instanceof TypeError;
        if (!isNetworkError) {
          console.warn('Aviso inesperado ao buscar configurações:', err);
        }
      }
    }

    async function fetchTransfers() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('transfers')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          const isJwtExpired = error.code === 'PGRST303' || error.message?.includes('JWT expired');
          if (isJwtExpired) {
            const recovered = await handleSupabaseAuthError(error);
            if (recovered) {
              return fetchTransfers();
            }
          }

          if (error.message === 'Failed to fetch' || error.message?.includes('Failed to fetch') || error.message?.includes('TypeError')) {
            return;
          }
          console.warn('Aviso ao carregar transferências:', error.message);
          
          if (error.code === '42P01' || error.message?.includes('relation "transfers" does not exist')) {
            setMissingTable(true);
          }

          // Fallback to local storage for any error (missing table, permissions, etc.)
          const savedTransfers = localStorage.getItem('app_transfers');
          if (savedTransfers) {
            try {
              setTransfers(JSON.parse(savedTransfers));
            } catch (e) {
              console.error('Error parsing transfers from local storage', e);
            }
          }
          return;
        }

        if (data) {
          console.log('DEBUG TRANSFERS:', data.map(t => ({ id: t.id, responsible_id: t.responsible_id })));
          // Map snake_case to camelCase
          const mappedTransfers: Transfer[] = data.map(t => ({
            id: t.id,
            sequentialNumber: t.sequential_number,
            requesterName: t.requester_name,
            description: t.description,
            requestDate: t.request_date,
            status: t.status,
            createdAt: t.created_at,
            responsibleId: t.responsible_id,
            requesterId: t.requester_id,
            type: t.type
          }));
          setTransfers(mappedTransfers);
        }
      } catch (err) {
        console.error('Unexpected error fetching transfers:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCollaborators();
    fetchSettings();
    fetchTransfers();

    // Real-time subscription
    const channel = supabase
      .channel('public:transfers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' }, () => {
        fetchTransfers();
      })
      .subscribe();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('new') === 'true' || params.get('openNew') === 'true') {
        handleOpenModal();
      }
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveTransfers = (newTransfers: Transfer[]) => {
    setTransfers(newTransfers);
    // Keep local storage as backup
    localStorage.setItem('app_transfers', JSON.stringify(newTransfers));
  };

  const handleOpenModal = (transfer?: Transfer) => {
    if (transfer) {
      setEditingTransfer(transfer);
      setRequesterName(transfer.requesterName);
      setDescription(transfer.description);
      setRequestedItems(parseDescriptionToItems(transfer.description));
      setRequestDate(transfer.requestDate);
      setStatus(transfer.status);
      setResponsibleId(transfer.responsibleId || '');
      setTransferType(transfer.type || 'solicitada');
    } else {
      setEditingTransfer(null);
      setRequesterName(user?.name || '');
      setDescription('');
      setRequestedItems([{ id: crypto.randomUUID(), code: '', name: '', reference: '', quantity: 1 }]);
      setRequestDate(new Date().toISOString().split('T')[0]);
      setStatus('Solicitado');
      setResponsibleId('');
      setTransferType(activeTab === 'todas' || activeTab === 'meus' ? 'solicitada' : activeTab);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransfer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formattedDesc = formatItemsToDescription(requestedItems);
    const finalDescription = formattedDesc.trim() || description.trim();

    if (!requesterName.trim() || !finalDescription || !requestDate) {
      alert('Por favor, informe o nome do solicitante, data e pelo menos um produto válido na lista.');
      return;
    }

    if (editingTransfer) {
      // Optimistic update
      const updatedTransfers = transfers.map(t => 
        t.id === editingTransfer.id 
          ? { ...t, requesterName, description: finalDescription, requestDate, status, responsibleId, type: transferType } 
          : t
      );
      saveTransfers(updatedTransfers);

      // Supabase update
      try {
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        
        const { error } = await supabase
          .from('transfers')
          .update({
            requester_name: requesterName,
            description: finalDescription,
            request_date: requestDate,
            status,
            responsible_id: responsibleId || null,
            type: transferType
          })
          .eq('id', editingTransfer.id);
          
        if (error) {
          console.error('Erro ao atualizar transferência no Supabase:', JSON.stringify(error, null, 2));
          console.error('Código:', error.code);
          console.error('Mensagem:', error.message);
          alert(`Erro ao atualizar no banco de dados: ${error.message || 'Erro desconhecido'}`);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        alert('Ocorreu um erro inesperado ao atualizar a transferência.');
      }
    } else {
      const nextSeq = transfers.length > 0 
        ? Math.max(...transfers.map(t => t.sequentialNumber)) + 1 
        : 1;
        
      const newTransfer: Transfer = {
        id: crypto.randomUUID(),
        sequentialNumber: nextSeq,
        requesterName,
        requesterId: user?.id,
        description: finalDescription,
        requestDate,
        status,
        createdAt: new Date().toISOString(),
        responsibleId,
        type: transferType
      };
      
      // Optimistic update
      saveTransfers([newTransfer, ...transfers]);

        // Supabase insert
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const currentUser = session?.user;
          const requesterId = currentUser?.id;
          const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

          const payload: any = {
            id: newTransfer.id,
            sequential_number: nextSeq,
            requester_name: requesterName,
            requester_id: requesterId || null,
            description,
            request_date: requestDate,
            status,
            created_at: newTransfer.createdAt,
            responsible_id: responsibleId || null,
            type: transferType
          };

          console.log('--- Diagnóstico de Envio ---');
          console.log('Payload:', payload);

          let { error } = await supabase
            .from('transfers')
            .insert(payload);
            
          // Se falhar por chave estrangeira, tentamos salvar sem os IDs técnicos
          if (error && error.code === '23503') {
            console.warn('Falha de chave estrangeira. Tentando salvar sem IDs técnicos...');
            const fallbackPayload = { ...payload, requester_id: null, responsible_id: null };
            const { error: retryError } = await supabase
              .from('transfers')
              .insert(fallbackPayload);
            error = retryError;
          }
            
          if (error) {
            const errDetails = {
              message: error.message || 'Sem mensagem',
              details: error.details || 'Sem detalhes',
              hint: error.hint || 'Sem dica',
              code: error.code || 'Sem código',
              stack: error.stack
            };
            console.error('Erro detalhado do Supabase (Transfers):', errDetails);
            
            let userMessage = `Erro ao salvar no banco de dados: ${error.message || 'Erro desconhecido'}`;
            
            if (error.code === '42P01') {
              userMessage = 'A tabela "transfers" não existe no Supabase.';
            } else if (error.code === '42703') {
              userMessage = `Coluna inexistente: ${error.message}.`;
            } else if (error.code === '23503') {
              userMessage = 'Erro de Chave Estrangeira persistente. Por favor, execute o comando SQL de correção no painel do Supabase.';
            }
            
            alert(userMessage);
          } else {
            // Create task for responsible person
            if (responsibleId) {
              try {
                // Basic UUID validation
                const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
                
                if (isUUID(responsibleId)) {
                  const taskTitle = `Processar Transferência #${nextSeq.toString().padStart(4, '0')}`;
                  const taskDescription = `Solicitante: ${requesterName}\nDescrição: ${description}\nData Solicitada: ${requestDate}`;
                  
                  const taskPayload: any = {
                    title: taskTitle,
                    description: taskDescription,
                    due_date: requestDate,
                    priority: 'Alta',
                    status: 'Pendente',
                    task_type: 'Transferência',
                    created_at: new Date().toISOString()
                  };

                  // Only add UUID fields if they are valid UUIDs
                  if (isUUID(responsibleId)) {
                    taskPayload.collaborator_id = responsibleId;
                  }
                  
                  if (user?.id && isUUID(user.id)) {
                    taskPayload.created_by = user.id;
                  }

                  let { data: task, error: taskError } = await supabase
                    .from('tasks')
                    .insert(taskPayload)
                    .select()
                    .single();

                  if (taskError) {
                    // Check for missing columns (42703), missing table (42P01), or foreign key violation (23503)
                    const isMissingCreatedBy = taskError.message?.includes('created_by') || taskError.code === '42703';
                    const isMissingTaskType = taskError.message?.includes('task_type') || taskError.code === '42703';
                    const isMissingCollaboratorId = taskError.message?.includes('collaborator_id') || taskError.code === '42703';
                    const isTableMissing = taskError.code === '42P01';
                    const isForeignKeyViolation = taskError.code === '23503';
                    const isCheckViolation = taskError.code === '23514';
                    
                    if (isTableMissing) {
                      setMissingTasksTable(true);
                    }

                    // If any technical column, foreign key, or check constraint is causing issues, retry with fallback
                    if (isMissingCreatedBy || isMissingTaskType || isMissingCollaboratorId || isForeignKeyViolation || isCheckViolation) {
                      const fallbackTaskPayload = { ...taskPayload };
                      if (isMissingCreatedBy) delete fallbackTaskPayload.created_by;
                      if (isMissingTaskType) delete fallbackTaskPayload.task_type;
                      if (isMissingCollaboratorId || isForeignKeyViolation) delete fallbackTaskPayload.collaborator_id;
                      if (isForeignKeyViolation) delete fallbackTaskPayload.created_by;
                      if (isCheckViolation) fallbackTaskPayload.priority = 'Alta';

                      const { data: retryTask, error: retryError } = await supabase
                        .from('tasks')
                        .insert(fallbackTaskPayload)
                        .select()
                        .single();
                      task = retryTask;
                      taskError = retryError;
                    }
                  }

                  if (taskError) {
                    console.error('Erro ao criar tarefa automática para transferência:', JSON.stringify(taskError, null, 2));
                    console.error('Detalhes do erro:', {
                      message: taskError.message,
                      code: taskError.code,
                      details: taskError.details,
                      hint: taskError.hint,
                      payload: taskPayload
                    });
                  } else if (task) {
                    // Also create entry in task_assignees if possible
                    try {
                      const { error: assigneesError } = await supabase.from('task_assignees').insert({
                        task_id: task.id,
                        profile_id: responsibleId
                      });
                      
                      if (assigneesError && assigneesError.code !== '42P01') {
                        console.error('Erro ao vincular responsável à tarefa:', assigneesError);
                      }
                    } catch (assigneeErr) {
                      console.warn('Tabela task_assignees pode estar ausente ou inacessível.');
                    }

                    // Notify responsible person
                    await createNotification(
                      responsibleId,
                      'Nova Tarefa de Transferência',
                      `Você recebeu uma nova tarefa: "${taskTitle}".`,
                      'info',
                      task.id,
                      `transfer_task_${newTransfer.id}`
                    );
                  }
                } else {
                  console.warn('responsibleId não é um UUID válido, pulando criação de tarefa automática:', responsibleId);
                }
              } catch (taskErr) {
                console.error('Erro inesperado ao criar tarefa automática:', taskErr);
              }
            }
          }
        } catch (err) {
          console.error('Erro inesperado durante o insert:', err);
          alert('Ocorreu um erro inesperado ao tentar salvar.');
        }
    }
    
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    console.log('handleDelete called for id:', id);
    setTransferToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    console.log('confirmDelete called for id:', transferToDelete);
    if (!transferToDelete) return;
    
    const id = transferToDelete;
    // Optimistic update
    saveTransfers(transfers.filter(t => t.id !== id));
    setIsDeleteModalOpen(false);
    setTransferToDelete(null);

    // Supabase delete
    try {
      const { error } = await supabase
        .from('transfers')
        .delete()
        .eq('id', id);
        
      if (error) console.error('Error deleting transfer in Supabase:', error);
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  const handleStatusChange = async (id: string, newStatus: TransferStatus) => {
    const transfer = transfers.find(t => t.id === id);
    if (!transfer || transfer.status === newStatus) return;

    const oldStatus = transfer.status;

    // Optimistic update
    const updatedTransfers = transfers.map(t => 
      t.id === id ? { ...t, status: newStatus } : t
    );
    saveTransfers(updatedTransfers);

    // Supabase update
    try {
      const { error } = await supabase
        .from('transfers')
        .update({ status: newStatus })
        .eq('id', id);
        
      if (error) {
        console.error('Error updating transfer status in Supabase:', error);
      } else {
        // Send notification if there's a responsible person and it's not the current user
        if (transfer.responsibleId && transfer.responsibleId !== user?.id) {
          await createNotification(
            transfer.responsibleId,
            'Status de Transferência Atualizado',
            `A transferência #${transfer.sequentialNumber.toString().padStart(4, '0')} mudou de "${oldStatus}" para "${newStatus}".`,
            'info',
            transfer.id,
            `status_change_${newStatus}_${Date.now()}`
          );
        }

        // Send notification to requester when status changes to 'Enviado'
        if (newStatus === 'Enviado') {
          setShowSuccessModal(true);
          const requesterNameStr = transfer.requesterName || '';
          const requester = collaborators.find(c => (c.name || '').toLowerCase() === requesterNameStr.toLowerCase().trim());
          const responsible = collaborators.find(c => c.id === transfer.responsibleId);
          const responsibleName = responsible ? responsible.name : 'um responsável';
          
          if (requester && requester.id !== user?.id) {
            await createNotification(
              requester.id,
              'Transferência Enviada',
              `Sua transferência #${transfer.sequentialNumber.toString().padStart(4, '0')} foi enviada por ${responsibleName}.`,
              'success',
              transfer.id,
              `transfer_sent_${Date.now()}`
            );
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'transfers_visible_roles', value: visibleRoles });
        
      if (error) {
        console.error('Error saving settings:', error);
        if (error.code === '42P01') {
          alert('A tabela "system_settings" não existe. Por favor, execute o SQL de migração no painel do Supabase.');
        } else {
          alert(`Erro ao salvar as configurações: ${error.message}`);
        }
      } else {
        setIsSettingsModalOpen(false);
      }
    } catch (err) {
      console.error('Unexpected error saving settings:', err);
    }
  };

  const filteredTransfers = transfers.filter(t => {
    const type = t.type || 'solicitada';
    const requesterName = t.requesterName || '';
    
    // O usuário é o solicitante se o ID bater ou se o nome bater (fallback para registros antigos)
    const currentUserName = (user?.name || '').toLowerCase().trim();
    const transferRequesterName = requesterName.toLowerCase().trim();
    
    const isRequester = Boolean(
      (t.requesterId && user?.id && t.requesterId === user.id) || 
      (transferRequesterName !== '' && transferRequesterName === currentUserName)
    );

    // O usuário é o destinatário/responsável pelo recebimento se for o responsável designado
    const responsibleCollab = collaborators.find(c => c.id === t.responsibleId);
    const responsibleCollabName = (responsibleCollab?.name || '').toLowerCase().trim();
    const isRecipient = Boolean(
      (t.responsibleId && user?.id && t.responsibleId === user.id) ||
      (responsibleCollabName !== '' && responsibleCollabName === currentUserName)
    );

    // Permissão especial de visualização:
    // "Somente o administrador, gerente e supervisor deve visualizar todas as transferencias de todos os usuários."
    const userRoleStr = (user?.type || user?.role || currentRole || '').toLowerCase().trim();
    const canViewAllTransfers = Boolean(
      isAdmin || 
      userRoleStr === 'admin' || 
      userRoleStr === 'administrador' || 
      userRoleStr.includes('admin') || 
      userRoleStr === 'gerente' || 
      userRoleStr === 'gerência' || 
      userRoleStr === 'gerencia' || 
      userRoleStr.includes('gerent') || 
      userRoleStr === 'supervisor' || 
      userRoleStr === 'supervisora' || 
      userRoleStr.includes('supervisor')
    );

    // Regra estrita de visibilidade:
    // Administrador, Gerente e Supervisor visualizam todas as transferências de todos os usuários.
    // Demais colaboradores: APENAS transferências solicitadas ou recebidas por eles.
    const isVisible = canViewAllTransfers || isRequester || isRecipient;

    if (!isVisible) {
      return false;
    }

    // Filtragem por abas
    let isMatchingTab = true;
    if (activeTab === 'todas') {
      isMatchingTab = true;
    } else if (activeTab === 'meus') {
      isMatchingTab = isRequester;
    } else if (activeTab === 'solicitada') {
      if (canViewAllTransfers) {
        isMatchingTab = type === 'solicitada';
      } else {
        isMatchingTab = isRequester || type === 'solicitada';
      }
    } else if (activeTab === 'recebida') {
      if (canViewAllTransfers) {
        isMatchingTab = type === 'recebida' || isRecipient;
      } else {
        isMatchingTab = isRecipient || type === 'recebida';
      }
    }
    
    const description = t.description || '';
    const sequentialNumber = t.sequentialNumber?.toString() || '';
    
    const isMatchingSearch = requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sequentialNumber.includes(searchQuery);
      
    const isMatchingStatus = statusFilter === 'Todos' || t.status === statusFilter;

    return isMatchingTab && isMatchingSearch && isMatchingStatus;
  });

  // Filtrar apenas colaboradores do estoque, administrador, gerência e supervisor ATIVOS para a separação
  const separationCollaborators = React.useMemo(() => {
    const inactives = typeof window !== 'undefined' ? getInactiveCollaboratorIds() : [];

    const isCollaboratorActive = (c: Collaborator) => {
      // 1. Checa lista local de colaboradores inativados
      if (inactives.includes(c.id)) {
        return false;
      }

      // 2. Checa status textual (ex: 'Inativo', 'inativo', 'desligado')
      const statusStr = (c.status || '').toLowerCase().trim();
      if (statusStr === 'inativo' || statusStr === 'inactive' || statusStr === 'desligado') {
        return false;
      }

      // 3. Checa campo booleano active se existir
      if (c.active === false) {
        return false;
      }

      return true;
    };

    const isSeparationResponsible = (c: Collaborator) => {
      // Apenas colaboradores ATIVOS
      if (!isCollaboratorActive(c)) {
        return false;
      }

      const type = (c.type || '').toLowerCase().trim();
      const role = (c.role || '').toLowerCase().trim();

      // 1. Estoque
      const isEstoque = 
        type === 'estoque' || 
        role === 'estoque' ||
        role.includes('estoque') || 
        role.includes('estoquista') || 
        role.includes('almoxarif') || 
        role.includes('separad') || 
        role.includes('conferent');

      // 2. Administrador
      const isAdminCollab = 
        type === 'admin' || 
        type === 'administrador' || 
        role === 'admin' ||
        role === 'administrador' ||
        role.includes('admin') || 
        role.includes('administrador') || 
        role.includes('administradora');

      // 3. Gerência / Gerente
      const isGerencia = 
        type === 'gerente' || 
        type === 'gerência' || 
        type === 'gerencia' || 
        role === 'gerente' ||
        role.includes('gerent') || 
        role.includes('gerênc') || 
        role.includes('gerenc');

      // 4. Supervisor (ou supervidor)
      const isSupervisor = 
        type === 'supervisor' || 
        type === 'supervisora' || 
        role === 'supervisor' ||
        role.includes('supervisor') || 
        role.includes('supervisão') || 
        role.includes('supervisao');

      return isEstoque || isAdminCollab || isGerencia || isSupervisor;
    };

    const allowed = collaborators.filter(isSeparationResponsible);

    // Se estiver editando e o responsável atual já salvo não estiver na lista filtrada, mantém para não quebrar a exibição
    if (editingTransfer && responsibleId && !allowed.some(c => c.id === responsibleId)) {
      const current = collaborators.find(c => c.id === responsibleId);
      if (current) {
        return [...allowed, current];
      }
    }

    return allowed;
  }, [collaborators, editingTransfer, responsibleId]);

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 border-b backdrop-blur-md ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center p-4 justify-between w-full">
          <Link href="/tasks" className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ArrowLeft size={20} />
          </Link>
          <AnimatePresence mode="wait">
            {showSearch ? (
              <motion.div 
                key="search"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: '100%' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 px-2"
              >
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar transferências..."
                  className={`w-full h-10 px-4 rounded-full outline-none focus:ring-2 focus:ring-blue-600/20 transition-all text-sm ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}
                />
              </motion.div>
            ) : (
              <motion.h2 
                key="title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-lg font-bold leading-tight tracking-tight flex-1 text-center"
              >
                Transferências
              </motion.h2>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-1 md:gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TransferStatus | 'Todos')}
              className={`hidden md:block rounded-full border text-xs font-medium py-2 px-3 outline-none transition-colors h-10 ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' 
                  : 'bg-white border-slate-200 text-slate-700 focus:border-blue-500 shadow-sm'
              }`}
            >
              <option value="Todos">Todos os Status</option>
              <option value="Solicitado">Solicitado</option>
              <option value="Em separação">Em separação</option>
              <option value="Separado">Separado</option>
              <option value="Enviado">Enviado</option>
              <option value="Desistiu">Desistiu</option>
            </select>
            <div className={`hidden md:flex items-center p-1 rounded-lg mr-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`} title="Lista"><List size={16} /></button>
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`} title="Grade"><LayoutGrid size={16} /></button>
              <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`} title="Kanban"><Columns size={16} /></button>
              <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`} title="Tabela"><Table size={16} /></button>
            </div>
            <button 
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery('');
              }}
              className={`flex size-10 items-center justify-center rounded-full transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              {showSearch ? <X size={20} /> : <Search size={20} />}
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Nova Transferência"
            >
              <Plus size={16} />
              <span>Nova Transferência</span>
            </button>
            {isAdmin && (
              <button 
                onClick={() => setIsSettingsModalOpen(true)}
                className={`flex size-10 items-center justify-center rounded-full transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
              >
                <Settings size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 pb-32 overflow-x-hidden">
        {/* Missing Table Alert */}
      {missingTasksTable && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
          <div className="flex gap-3">
            <AlertCircle className="text-rose-600 shrink-0" size={20} />
            <div>
              <h3 className="text-sm font-bold text-rose-900">Tabela de Tarefas não encontrada</h3>
              <p className="text-xs text-rose-700 mt-1">
                A tabela &quot;tasks&quot; não foi encontrada. O sistema não pôde criar a tarefa automática para esta transferência. Para corrigir, execute o seguinte SQL no Supabase:
              </p>
              <div className={`mt-2 p-2 rounded-lg font-mono text-[9px] break-all whitespace-pre-wrap ${isDarkMode ? 'bg-slate-950 text-rose-400' : 'bg-white text-rose-600'}`}>
{`CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  priority TEXT CHECK (priority IN ('Alta', 'Média', 'Baixa', 'Urgente')),
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pendente',
  collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`}
              </div>
            </div>
          </div>
        </div>
      )}

      {missingTable && (
        <div className="p-4">
          <div className={`p-4 rounded-3xl border flex items-start gap-3 transition-all ${isDarkMode ? 'bg-rose-900/20 border-rose-800/50 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            <div className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'bg-rose-900/40 text-rose-400' : 'bg-rose-100 text-rose-600'}`}>
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold leading-tight">Tabela Faltando no Banco de Dados</h4>
              <p className="text-[10px] mt-1 opacity-80 leading-relaxed font-medium">
                A tabela &quot;transfers&quot; não foi encontrada. O sistema está salvando localmente para evitar erros. Para corrigir, execute o seguinte SQL no Supabase:
              </p>
              <div className={`mt-2 p-2 rounded-lg font-mono text-[9px] break-all whitespace-pre-wrap ${isDarkMode ? 'bg-slate-950 text-rose-400' : 'bg-white text-rose-600'}`}>
{`CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequential_number SERIAL,
  requester_name TEXT NOT NULL,
  requester_id UUID REFERENCES profiles(id),
  description TEXT NOT NULL,
  request_date DATE NOT NULL,
  status TEXT DEFAULT 'Solicitado',
  responsible_id UUID REFERENCES profiles(id),
  type TEXT DEFAULT 'solicitada',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on transfers" ON transfers FOR ALL USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs & Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 sm:mb-6 max-w-5xl mx-auto w-full">
          <div className="hidden sm:block w-36" />
          
          <div className="flex items-center justify-start sm:justify-center overflow-x-auto no-scrollbar scrollbar-none max-w-full w-full sm:w-auto py-1">
            <div className={`inline-flex p-1 rounded-2xl shrink-0 ${isDarkMode ? 'bg-slate-800/80 border border-slate-700/60' : 'bg-slate-200/80'}`}>
              <button
                onClick={() => setActiveTab('todas')}
                className={`px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  activeTab === 'todas'
                    ? (isDarkMode ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setActiveTab('meus')}
                className={`px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  activeTab === 'meus'
                    ? (isDarkMode ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                Meus Pedidos
              </button>
              <button
                onClick={() => setActiveTab('solicitada')}
                className={`px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  activeTab === 'solicitada'
                    ? (isDarkMode ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                Solicitadas
              </button>
              <button
                onClick={() => setActiveTab('recebida')}
                className={`px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  activeTab === 'recebida'
                    ? (isDarkMode ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs')
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                Recebidas
              </button>
            </div>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            title="Nova Transferência"
          >
            <Plus size={16} />
            <span>Nova Transferência</span>
          </button>
        </div>

        {/* Mobile View Toggle and Status Filter (Only 1 Nova Transferencia button on mobile) */}
        <div className="md:hidden flex flex-col gap-2.5 mb-5 max-w-lg mx-auto w-full">
          <button
            onClick={() => handleOpenModal()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus size={18} />
            <span>Nova Transferência</span>
          </button>
          
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TransferStatus | 'Todos')}
              className={`flex-1 rounded-xl border text-xs py-2.5 px-3 outline-none transition-colors ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' 
                  : 'bg-white border-slate-300 text-slate-700 focus:border-blue-500 shadow-xs'
              }`}
            >
              <option value="Todos">Todos os Status</option>
              <option value="Solicitado">Solicitado</option>
              <option value="Em separação">Em separação</option>
              <option value="Separado">Separado</option>
              <option value="Enviado">Enviado</option>
              <option value="Desistiu">Desistiu</option>
            </select>
            
            <div className={`flex items-center p-1 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-xs') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`} title="Lista"><List size={15} /></button>
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-xs') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`} title="Grade"><LayoutGrid size={15} /></button>
              <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg transition-colors ${viewMode === 'kanban' ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-xs') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`} title="Kanban"><Columns size={15} /></button>
              <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-xs') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`} title="Tabela"><Table size={15} /></button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className={`max-w-3xl mx-auto p-8 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <Package size={48} className={`mx-auto mb-4 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`} />
            <h3 className="text-lg font-bold mb-2">Nenhuma transferência encontrada</h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {searchQuery 
                ? 'Tente buscar com outros termos.' 
                : activeTab === 'meus' 
                  ? 'Você ainda não realizou nenhum pedido de transferência.'
                  : `Crie um novo pedido de transferência ${activeTab === 'solicitada' ? 'solicitada' : activeTab === 'recebida' ? 'recebida' : ''}.`}
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-colors shadow-sm"
            >
              Nova Transferência
            </button>
          </div>
        ) : (
          <>
            {viewMode === 'list' && (
              <div className="max-w-3xl mx-auto w-full space-y-4">
                {filteredTransfers.map((transfer) => (
                  <motion.div
                    key={transfer.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                  >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            #{transfer.sequentialNumber.toString().padStart(4, '0')}
                          </span>
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 shrink-0 ${TYPE_COLORS[transfer.type || 'solicitada']}`}>
                            {transfer.type === 'solicitada' && transfer.responsibleId === user?.id ? 'Recebida' : TYPE_LABELS[transfer.type || 'solicitada']}
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${STATUS_COLORS[transfer.status]}`}>
                            {STATUS_ICONS[transfer.status]}
                            {transfer.status}
                          </div>
                        </div>
                        
                        {transfer.responsibleId && (
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-xs w-fit ${isDarkMode ? 'bg-indigo-950/30 border-indigo-900 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                            <div className="size-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] shrink-0">
                              <User size={12} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[9px] opacity-70 uppercase leading-none mb-0.5">Responsável</span>
                              <span className="leading-none truncate">{collaborators.find(c => c.id === transfer.responsibleId)?.name || 'Desconhecido'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenModal(transfer)}
                          className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(transfer.id)}
                          className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-rose-900/30 text-rose-400' : 'hover:bg-rose-50 text-rose-500'}`}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">Solicitante</div>
                      <h4 className="font-bold text-base sm:text-lg mb-1 text-slate-900 dark:text-slate-100">{transfer.requesterName}</h4>
                      <p className={`text-xs sm:text-sm whitespace-pre-wrap leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {transfer.description}
                      </p>
                    </div>

                    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      <div className={`text-xs flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Clock size={13} />
                        <span>Solicitado em: {new Date(transfer.requestDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                        {(['Solicitado', 'Em separação', 'Separado', 'Enviado', 'Desistiu'] as TransferStatus[]).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(transfer.id, status)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors border whitespace-nowrap ${
                              transfer.status === status 
                                ? STATUS_COLORS[status] 
                                : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto w-full">
                {filteredTransfers.map((transfer) => (
                  <motion.div
                    key={transfer.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-4 rounded-2xl border shadow-sm flex flex-col h-full ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                  >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            #{transfer.sequentialNumber.toString().padStart(4, '0')}
                          </span>
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 shrink-0 ${TYPE_COLORS[transfer.type || 'solicitada']}`}>
                            {transfer.type === 'solicitada' && transfer.responsibleId === user?.id ? 'Recebida' : TYPE_LABELS[transfer.type || 'solicitada']}
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${STATUS_COLORS[transfer.status]}`}>
                            {STATUS_ICONS[transfer.status]}
                            {transfer.status}
                          </div>
                        </div>
                        {transfer.responsibleId && (
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-xs w-fit ${isDarkMode ? 'bg-indigo-950/30 border-indigo-900 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                            <div className="size-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] shrink-0">
                              <User size={12} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[9px] opacity-70 uppercase leading-none mb-0.5">Responsável</span>
                              <span className="leading-none truncate">{collaborators.find(c => c.id === transfer.responsibleId)?.name || 'Desconhecido'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleOpenModal(transfer)} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`} title="Editar"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(transfer.id)} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-rose-900/30 text-rose-400' : 'hover:bg-rose-50 text-rose-500'}`} title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <div className="mb-4 flex-1">
                      <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">Solicitante</div>
                      <h4 className="font-bold text-base sm:text-lg mb-1 text-slate-900 dark:text-slate-100">{transfer.requesterName}</h4>
                      <p className={`text-xs sm:text-sm whitespace-pre-wrap line-clamp-3 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {transfer.description}
                      </p>
                    </div>

                    <div className={`pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      <div className={`text-xs flex items-center gap-1.5 mb-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Clock size={13} />
                        <span>{new Date(transfer.requestDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(['Solicitado', 'Em separação', 'Separado', 'Enviado', 'Desistiu'] as TransferStatus[]).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(transfer.id, status)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors border whitespace-nowrap ${
                              transfer.status === status 
                                ? STATUS_COLORS[status] 
                                : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {viewMode === 'kanban' && (
              <div className="flex gap-4 overflow-x-auto pb-6 max-w-full mx-auto w-full min-h-[70vh] snap-x scrollbar-hide">
                {(['Solicitado', 'Em separação', 'Separado', 'Enviado', 'Desistiu'] as TransferStatus[]).map(colStatus => {
                  const items = filteredTransfers.filter(t => t.status === colStatus);
                  return (
                    <div key={colStatus} className={`flex-1 min-w-[280px] max-w-[320px] rounded-2xl p-3 snap-center flex flex-col ${isDarkMode ? 'bg-slate-900/40 border border-slate-800' : 'bg-slate-100/50 border border-slate-200/50'}`}>
                      <div className="flex items-center justify-between mb-4 px-1">
                        <div className="flex items-center gap-2">
                          <div className={`size-2 rounded-full ${
                            colStatus === 'Solicitado' ? 'bg-slate-500' :
                            colStatus === 'Em separação' ? 'bg-amber-500' :
                            colStatus === 'Separado' ? 'bg-blue-500' :
                            colStatus === 'Enviado' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`} />
                          <h3 className={`font-bold text-[11px] uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {colStatus}
                          </h3>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-white text-slate-400 shadow-sm'}`}>
                          {items.length}
                        </span>
                      </div>
                      
                      <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        {items.length === 0 ? (
                          <div className={`flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'}`}>
                            <Package size={24} className="mb-2 opacity-20" />
                            <p className="text-[10px] font-medium uppercase tracking-tighter italic">Vazio</p>
                          </div>
                        ) : (
                          items.map(transfer => (
                            <motion.div
                              key={transfer.id}
                              layoutId={transfer.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`group p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                    #{transfer.sequentialNumber.toString().padStart(4, '0')}
                                  </span>
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-tighter ${TYPE_COLORS[transfer.type || 'solicitada']}`}>
                                    {transfer.type === 'solicitada' && transfer.responsibleId === user?.id ? 'Recebida' : TYPE_LABELS[transfer.type || 'solicitada']}
                                  </span>
                                  {transfer.responsibleId && (
                                    <div className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                      <User size={10} />
                                      {collaborators.find(c => c.id === transfer.responsibleId)?.name.split(' ')[0] || '...'}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleOpenModal(transfer)} className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><Edit2 size={12} /></button>
                                  <button onClick={() => handleDelete(transfer.id)} className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-rose-900/30 text-rose-400' : 'hover:bg-rose-50 text-rose-500'}`}><Trash2 size={12} /></button>
                                </div>
                              </div>
                              
                              <h4 className={`font-bold text-sm mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{transfer.requesterName}</h4>
                              <p className={`text-xs whitespace-pre-wrap mb-3 line-clamp-2 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                {transfer.description}
                              </p>
                              
                              <div className="flex items-center justify-between mt-auto pt-3 border-t border-dashed border-slate-200 dark:border-slate-800">
                                <div className="flex flex-col gap-1">
                                  <div className={`text-[9px] font-bold flex items-center gap-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                                    <Clock size={10} />
                                    {new Date(transfer.requestDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                  {colStatus === 'Em separação' && (
                                    <button 
                                      onClick={() => handleStatusChange(transfer.id, 'Separado')}
                                      className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                                      title="Marcar como Separado"
                                    >
                                      <Package size={14} />
                                    </button>
                                  )}
                                  {colStatus === 'Separado' && (
                                    <button 
                                      onClick={() => handleStatusChange(transfer.id, 'Enviado')}
                                      className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                                      title="Marcar como Enviado"
                                    >
                                      <Send size={14} />
                                    </button>
                                  )}
                                  {colStatus !== 'Desistiu' && colStatus !== 'Enviado' && (
                                    <button 
                                      onClick={() => handleStatusChange(transfer.id, 'Desistiu')}
                                      className={`p-1.5 rounded-lg border transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-rose-900/20 text-rose-500' : 'border-slate-200 hover:bg-rose-50 text-rose-500'}`}
                                      title="Cancelar"
                                    >
                                      <XCircle size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {viewMode === 'table' && (
              <div className={`max-w-7xl mx-auto w-full rounded-2xl border overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={`text-xs uppercase ${isDarkMode ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                      <tr>
                        <th className="px-4 py-3 font-bold">ID</th>
                        <th className="px-4 py-3 font-bold">Tipo</th>
                        <th className="px-4 py-3 font-bold">Solicitante</th>
                        <th className="px-4 py-3 font-bold">Produtos</th>
                        <th className="px-4 py-3 font-bold">Data</th>
                        <th className="px-4 py-3 font-bold">Responsável</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 font-bold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                      {filteredTransfers.map(transfer => (
                        <tr key={transfer.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 font-mono text-xs">{transfer.sequentialNumber.toString().padStart(4, '0')}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${TYPE_COLORS[transfer.type || 'solicitada']}`}>
                              {TYPE_LABELS[transfer.type || 'solicitada']}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold">{transfer.requesterName}</td>
                          <td className="px-4 py-3 max-w-[200px] truncate" title={transfer.description}>{transfer.description}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{new Date(transfer.requestDate).toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {transfer.responsibleId ? (
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                <User size={12} />
                                {collaborators.find(c => c.id === transfer.responsibleId)?.name || 'Desconhecido'}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_COLORS[transfer.status]}`}>
                              {STATUS_ICONS[transfer.status]}
                              {transfer.status}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleOpenModal(transfer)} className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}><Edit2 size={14} /></button>
                              <button onClick={() => handleDelete(transfer.id)} className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-rose-900/30 text-rose-400' : 'hover:bg-rose-100 text-rose-500'}`}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal for Create/Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
            >
              <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className="text-lg font-bold">
                  {editingTransfer ? 'Editar Transferência' : 'Nova Transferência'}
                </h3>
                <button 
                  onClick={handleCloseModal}
                  className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Tipo de Transferência *
                  </label>
                  <div className={`flex p-1 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button
                      type="button"
                      onClick={() => setTransferType('solicitada')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        transferType === 'solicitada'
                          ? (isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm')
                          : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')
                      }`}
                    >
                      Solicitada
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferType('recebida')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        transferType === 'recebida'
                          ? (isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm')
                          : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')
                      }`}
                    >
                      Recebida
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nome do Solicitante *
                  </label>
                  <input
                    type="text"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="Ex: João Silva (Matriz)"
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-600/20 transition-all ${
                      isDarkMode 
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                    }`}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={`block text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Produtos Solicitados *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      <Plus size={14} /> Adicionar Produto
                    </button>
                  </div>

                  {requestedItems.map((item, index) => {
                    const searchTerm = (item.name || item.code || '').toLowerCase().trim();
                    const matchingProducts = searchTerm
                      ? catalogProducts.filter(p => 
                          p.name?.toLowerCase().includes(searchTerm) ||
                          p.code?.toLowerCase().includes(searchTerm) ||
                          p.additionalCode?.toLowerCase().includes(searchTerm)
                        ).slice(0, 8)
                      : [];

                    return (
                      <div key={item.id} className={`p-3 rounded-xl border relative space-y-2.5 transition-all ${
                        isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50/90 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Item #{index + 1}
                          </span>
                          {requestedItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-rose-500 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                              title="Remover item"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          {/* Código */}
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Código</label>
                            <input
                              type="text"
                              value={item.code}
                              onChange={(e) => handleItemCodeChange(index, e.target.value)}
                              placeholder="Ex: 353"
                              className={`w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none font-mono ${
                                isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                              }`}
                            />
                          </div>

                          {/* Nome do Produto com Autocomplete do Catálogo */}
                          <div className="sm:col-span-5 relative">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Nome / Peça do Catálogo *</label>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleItemNameChange(index, e.target.value)}
                              onFocus={() => setFocusedItemIndex(index)}
                              placeholder="Buscar produto no catálogo..."
                              className={`w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none ${
                                isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                              }`}
                              required
                            />

                            {/* Dropdown do Catálogo de Peças */}
                            {focusedItemIndex === index && matchingProducts.length > 0 && (
                              <div className={`absolute z-30 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border shadow-xl ${
                                isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                              }`}>
                                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase bg-slate-500/5">
                                  Catálogo de Peças
                                </div>
                                {matchingProducts.map((prod) => (
                                  <div
                                    key={prod.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      selectCatalogProduct(index, prod);
                                    }}
                                    className={`p-2 text-xs cursor-pointer border-b last:border-0 transition-colors ${
                                      isDarkMode ? 'hover:bg-slate-800 border-slate-800 text-slate-200' : 'hover:bg-blue-50 border-slate-100 text-slate-800'
                                    }`}
                                  >
                                    <div className="font-bold flex items-center justify-between gap-2">
                                      <span className="truncate">{prod.name}</span>
                                      <span className="text-[10px] font-mono text-blue-500 shrink-0">Cód: {prod.code}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                                      <span>Ref: {prod.additionalCode || 'N/A'}</span>
                                      <span>Estoque: {prod.stock}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Referência */}
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Referência</label>
                            <input
                              type="text"
                              value={item.reference}
                              onChange={(e) => handleItemReferenceChange(index, e.target.value)}
                              placeholder="Ex: 289"
                              className={`w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none font-mono ${
                                isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                              }`}
                            />
                          </div>

                          {/* Quantidade */}
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Qtd *</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemQtyChange(index, parseInt(e.target.value, 10) || 1)}
                              className={`w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none font-bold ${
                                isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                              }`}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Data da Solicitação *
                    </label>
                    <input
                      type="date"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-600/20 transition-all ${
                        isDarkMode 
                          ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                      }`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Status Inicial
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TransferStatus)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-600/20 transition-all appearance-none ${
                        isDarkMode 
                          ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                      }`}
                    >
                      <option value="Solicitado">Solicitado</option>
                      <option value="Em separação">Em separação</option>
                      <option value="Separado">Separado</option>
                      <option value="Enviado">Enviado</option>
                      <option value="Desistiu">Desistiu</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                    <label className={`block text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Responsável pela Separação
                    </label>
                    <span className="text-[10px] text-blue-500 font-semibold">
                      Estoque, Admin, Gerência ou Supervisor ativos
                    </span>
                  </div>
                  <select
                    value={responsibleId}
                    onChange={(e) => setResponsibleId(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-600/20 transition-all appearance-none cursor-pointer ${
                      isDarkMode 
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="">Selecione um responsável...</option>
                    {separationCollaborators.length === 0 ? (
                      <option disabled value="">Nenhum colaborador ativo do Estoque, Administrador, Gerência ou Supervisor encontrado</option>
                    ) : (
                      separationCollaborators.map(collaborator => (
                        <option key={collaborator.id} value={collaborator.id}>
                          {collaborator.name}
                        </option>
                      ))
                    )}
                  </select>
                  <p className={`mt-1 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Apenas colaboradores ativos do Estoque, Administrador, Gerência e Supervisor podem ser designados para a separação.
                  </p>
                </div>
              </form>

              <div className={`p-4 border-t flex gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold transition-colors ${
                    isDarkMode 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl font-bold transition-colors shadow-sm"
                >
                  {editingTransfer ? 'Salvar Alterações' : 'Criar Transferência'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
            >
              <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className="text-lg font-bold">Configurações de Visibilidade</h3>
                <button 
                  onClick={() => setIsSettingsModalOpen(false)}
                  className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Por padrão, Administradores, Gerentes e Supervisores visualizam todas as transferências de todos os usuários. Para os demais colaboradores, apenas as transferências solicitadas ou recebidas por eles são exibidas.
                </p>
                
                <div className="space-y-2">
                  {[
                    { id: 'estoque', label: 'Estoque' },
                    { id: 'vendedor', label: 'Vendedor' },
                    { id: 'entregador', label: 'Entregador' },
                    { id: 'user', label: 'Colaborador (Padrão)' }
                  ].map(roleOption => (
                    <label key={roleOption.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={visibleRoles.includes(roleOption.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setVisibleRoles([...visibleRoles, roleOption.id]);
                          } else {
                            setVisibleRoles(visibleRoles.filter(r => r !== roleOption.id));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600"
                      />
                      <span className="font-medium">{roleOption.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={`p-4 border-t flex justify-end gap-2 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`relative w-full max-w-sm p-6 rounded-3xl shadow-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Transferência Enviada!</h3>
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>A solicitação foi marcada como enviada com sucesso.</p>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`relative w-full max-w-sm p-6 rounded-3xl shadow-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="size-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Excluir Transferência</h3>
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Tem certeza que deseja excluir este pedido de transferência? Esta ação não pode ser desfeita.</p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setIsDeleteModalOpen(false)}
                    className={`flex-1 py-3 rounded-xl font-bold transition-colors ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button for New Transfer (Apenas desktop/telas médias e grandes) */}
      <motion.button 
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(37, 99, 235, 0.4)" }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleOpenModal()}
        className={`hidden md:flex fixed bottom-8 right-4 z-40 items-center justify-center gap-2 px-6 h-14 rounded-full font-bold shadow-[0_10px_30px_-10px_rgba(37,99,235,0.6)] transition-all border-4 cursor-pointer ${
          isDarkMode 
            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-slate-950' 
            : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-white'
        }`}
        title="Criar Nova Transferência"
      >
        <Plus size={22} />
        <span className="text-sm font-black tracking-wide">Nova Transferência</span>
      </motion.button>
    </div>
  );
}
