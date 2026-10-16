'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowLeftRight, 
  ArrowRight, 
  Package, 
  Clock, 
  Send, 
  XCircle, 
  Plus, 
  RefreshCw, 
  Boxes,
  Layers,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';

interface TransfersSummaryCardProps {
  isDarkMode?: boolean;
}

interface TransferItem {
  id: string;
  sequential_number?: number;
  sequentialNumber?: number;
  requester_name?: string;
  requesterName?: string;
  requester_id?: string;
  requesterId?: string;
  responsible_id?: string;
  responsibleId?: string;
  description?: string;
  request_date?: string;
  requestDate?: string;
  status: 'Solicitado' | 'Em separação' | 'Separado' | 'Enviado' | 'Desistiu';
  created_at?: string;
  type?: 'solicitada' | 'recebida';
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  'Solicitado': {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    icon: Clock
  },
  'Em separação': {
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    icon: Clock
  },
  'Separado': {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: Package
  },
  'Enviado': {
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: Send
  },
  'Desistiu': {
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    icon: XCircle
  }
};

export function TransfersSummaryCard({ isDarkMode }: TransfersSummaryCardProps) {
  const { user, role: currentRole, isAdmin } = useRole();
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTransfers = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase
        .from('transfers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback to local storage
        const saved = typeof window !== 'undefined' ? localStorage.getItem('app_transfers') : null;
        if (saved) {
          try {
            setTransfers(JSON.parse(saved));
          } catch (e) {
            console.error('Error parsing local transfers', e);
          }
        }
      } else if (data) {
        setTransfers(data);
      }
    } catch (err) {
      console.error('Failed to load transfers for summary card:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();

    // Subscribe to realtime changes on transfers table
    const channel = supabase
      .channel('transfers-summary-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transfers' },
        () => {
          fetchTransfers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTransfers]);

  // Permissão especial: Apenas Administrador, Gerente e Supervisor visualizam todas as solicitações
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

  // Filtragem: Totais e solicitações individuais por colaborador vs consolidado para gestores
  const visibleTransfers = useMemo(() => {
    if (canViewAllTransfers) {
      return transfers;
    }

    const currentUserName = (user?.name || '').toLowerCase().trim();
    const currentUserId = user?.id || '';

    return transfers.filter(t => {
      const reqName = (t.requester_name || t.requesterName || '').toLowerCase().trim();
      const reqId = t.requester_id || t.requesterId || '';
      const respId = t.responsible_id || t.responsibleId || '';

      const isRequester = (reqId && currentUserId && reqId === currentUserId) || 
                          (reqName !== '' && currentUserName !== '' && reqName === currentUserName);
      const isRecipient = (respId && currentUserId && respId === currentUserId);

      return isRequester || isRecipient;
    });
  }, [transfers, canViewAllTransfers, user]);

  // Derived statistics sobre as transferências visíveis para o usuário
  const totalCount = visibleTransfers.length;
  const inSeparationCount = visibleTransfers.filter(t => t.status === 'Em separação' || t.status === 'Solicitado').length;
  const separatedCount = visibleTransfers.filter(t => t.status === 'Separado').length;
  const sentCount = visibleTransfers.filter(t => t.status === 'Enviado').length;
  const solicitadasCount = visibleTransfers.filter(t => t.type === 'solicitada' || !t.type).length;
  const recebidasCount = visibleTransfers.filter(t => t.type === 'recebida').length;

  const recentTransfers = visibleTransfers.slice(0, 4);

  return (
    <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col justify-between transition-all duration-200 ${
      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
    }`}>
      {/* Top Header Section */}
      <div>
        <div className="flex flex-col gap-3 mb-4">
          {/* Title and Top Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2.5 rounded-2xl shrink-0 ${
                isDarkMode 
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                  : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
              }`}>
                <ArrowLeftRight size={18} className="stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Nome "Transferências" somente com a primeira letra maiúscula e o restante minúsculo */}
                  <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100 truncate">
                    Transferências
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    isDarkMode ? 'bg-indigo-900/60 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                  }`}>
                    {canViewAllTransfers ? 'Geral' : 'Individual'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {canViewAllTransfers ? 'Visão consolidada de movimentações' : 'Seus totais e solicitações de movimentação'}
                </p>
              </div>
            </div>

            <button
              onClick={fetchTransfers}
              disabled={isRefreshing}
              title="Atualizar dados"
              aria-label="Atualizar dados de transferências"
              className={`p-2 rounded-xl border text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 transition-colors ${
                isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-indigo-500' : ''} />
            </button>
          </div>

          {/* Action Button */}
          <Link
            href="/transfers"
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
              isDarkMode
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
            }`}
          >
            <Layers size={14} />
            <span>Acessar Painel de Transferências</span>
            <ArrowRight size={13} className="shrink-0" />
          </Link>
        </div>

        {/* Quick KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {/* Total */}
          <div className={`p-2.5 sm:p-3 rounded-2xl border ${
            isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-100'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
              {canViewAllTransfers ? 'Total Geral' : 'Meu Total'}
            </span>
            <div className="flex items-baseline justify-between mt-1 gap-1">
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                {totalCount}
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 shrink-0">
                {solicitadasCount}s / {recebidasCount}r
              </span>
            </div>
          </div>

          {/* Em Separação */}
          <div className={`p-2.5 sm:p-3 rounded-2xl border ${
            isDarkMode ? 'bg-amber-950/20 border-amber-800/40' : 'bg-amber-50/70 border-amber-100'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block truncate">
              Em Separação
            </span>
            <div className="flex items-baseline justify-between mt-1 gap-1">
              <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                {inSeparationCount}
              </span>
              <Clock size={13} className="text-amber-500/70 shrink-0" />
            </div>
          </div>

          {/* Separadas */}
          <div className={`p-2.5 sm:p-3 rounded-2xl border ${
            isDarkMode ? 'bg-blue-950/20 border-blue-800/40' : 'bg-blue-50/70 border-blue-100'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block truncate">
              Separadas
            </span>
            <div className="flex items-baseline justify-between mt-1 gap-1">
              <span className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                {separatedCount}
              </span>
              <Package size={13} className="text-blue-500/70 shrink-0" />
            </div>
          </div>

          {/* Enviadas */}
          <div className={`p-2.5 sm:p-3 rounded-2xl border ${
            isDarkMode ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50/70 border-emerald-100'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block truncate">
              Enviadas
            </span>
            <div className="flex items-baseline justify-between mt-1 gap-1">
              <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {sentCount}
              </span>
              <Send size={13} className="text-emerald-500/70 shrink-0" />
            </div>
          </div>
        </div>

        {/* Recent Transfer Requests Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {canViewAllTransfers ? 'Últimas Solicitações (Geral)' : 'Minhas Últimas Solicitações'}
            </span>
            <Link 
              href="/transfers"
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Ver todas ({totalCount})</span>
              <ChevronRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="py-6 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw size={18} className="animate-spin text-indigo-500" />
              <span className="text-xs">Carregando dados...</span>
            </div>
          ) : recentTransfers.length === 0 ? (
            <div className={`p-5 rounded-2xl border text-center ${
              isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/60 border-slate-100'
            }`}>
              <Boxes size={26} className="mx-auto text-slate-400 mb-2 opacity-60" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {canViewAllTransfers ? 'Nenhuma transferência registrada' : 'Você ainda não possui transferências registradas'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-3">
                Crie uma nova solicitação para movimentar o estoque.
              </p>
              <Link
                href="/transfers?new=true"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <Plus size={13} />
                <span>Nova Transferência</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentTransfers.map((item, idx) => {
                const seq = item.sequential_number ?? item.sequentialNumber ?? (idx + 1);
                const requester = item.requester_name ?? item.requesterName ?? 'Não informado';
                const date = item.request_date ?? item.requestDate ?? item.created_at ?? '';
                const type = item.type ?? 'solicitada';
                const statusStyle = STATUS_CONFIG[item.status] || STATUS_CONFIG['Solicitado'];
                const StatusIcon = statusStyle.icon;

                return (
                  <Link
                    key={item.id || idx}
                    href="/transfers"
                    className={`block p-2.5 rounded-2xl border transition-all active:scale-[0.99] ${
                      isDarkMode 
                        ? 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700' 
                        : 'bg-white border-slate-100 hover:bg-slate-50/80 hover:border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] sm:text-[11px] font-bold shrink-0 ${
                          isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-slate-100 text-indigo-600'
                        }`}>
                          #{String(seq).padStart(3, '0')}
                        </span>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px] sm:max-w-[200px]">
                              {requester}
                            </span>
                            <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded-sm uppercase shrink-0 ${
                              type === 'recebida'
                                ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            }`}>
                              {type === 'recebida' ? 'Recebida' : 'Solicitada'}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                          <StatusIcon size={9} />
                          <span>{item.status}</span>
                        </span>
                        {date && (
                          <span className="text-[9px] sm:text-[10px] text-slate-400">
                            {date.includes('T') ? date.split('T')[0] : date}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer CTA */}
      <div className={`mt-3.5 pt-2.5 border-t flex items-center justify-between gap-2 ${
        isDarkMode ? 'border-slate-800' : 'border-slate-100'
      }`}>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
          <Boxes size={13} className="text-indigo-500 shrink-0" />
          <span className="truncate">{canViewAllTransfers ? 'Controle geral de estoque' : 'Meu controle de estoque'}</span>
        </div>
        <Link
          href="/transfers"
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 inline-flex items-center gap-1 shrink-0 transition-colors"
        >
          <span>Acessar Transferências</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
