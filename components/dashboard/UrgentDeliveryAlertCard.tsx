'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, MapPin, Truck, ChevronRight, CheckCircle2, Package, User } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getTodayLocalDateString } from '@/lib/utils';
import { useRole } from '@/hooks/useRole';

interface UrgentDeliveryAlertCardProps {
  isDarkMode?: boolean;
}

interface DeliveryItem {
  id: string | number;
  date: string;
  shift?: string;
  vehicle?: string;
  driver?: string;
  value?: number;
  neighborhood?: string;
  city?: string;
  product?: string;
  seller?: string;
  status: string;
  notes?: string;
  address?: string;
  phone?: string;
}

export function UrgentDeliveryAlertCard({ isDarkMode }: UrgentDeliveryAlertCardProps) {
  const { canAccessDeliveries } = useRole();
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const todayStr = getTodayLocalDateString();

  const fetchUnfinishedDeliveries = useCallback(async () => {
    if (!canAccessDeliveries) {
      setDeliveries([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Query deliveries for today that are not finalized
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('date', todayStr)
        .neq('status', 'Finalizada')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setDeliveries(data);
      } else {
        // Fallback: check if there are any overdue unfinished deliveries (e.g. pending from previous days or today)
        const { data: fallbackData } = await supabase
          .from('deliveries')
          .select('*')
          .neq('status', 'Finalizada')
          .order('date', { ascending: false })
          .limit(5);

        setDeliveries(fallbackData || []);
      }
    } catch (err) {
      console.error('Error fetching critical deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, [canAccessDeliveries, todayStr]);

  useEffect(() => {
    if (!canAccessDeliveries) {
      setDeliveries([]);
      setLoading(false);
      return;
    }

    fetchUnfinishedDeliveries();

    // Listen to realtime changes on deliveries table
    const channel = supabase
      .channel('urgent_deliveries_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        () => {
          fetchUnfinishedDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccessDeliveries, fetchUnfinishedDeliveries]);

  // Se o usuário não estiver habilitado para a função de entregas, o painel de alerta não deve aparecer
  if (!canAccessDeliveries) {
    return null;
  }

  // Current active delivery in carousel or list
  const activeDelivery = deliveries.length > 0 ? deliveries[currentIndex % deliveries.length] : null;

  return (
    <div
      className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
        isDarkMode
          ? 'bg-rose-950/20 border-rose-900/50 shadow-rose-950/20'
          : 'bg-gradient-to-br from-rose-50/80 via-white to-amber-50/60 border-rose-200/80 shadow-xs'
      }`}
    >
      {/* Background accent glow */}
      <div className="absolute -top-10 -right-10 w-28 h-28 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className={deliveries.length > 0 ? 'animate-pulse' : ''} />
            </div>
            <div>
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 tracking-wide uppercase">
                Alerta de Entrega
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Entregas do dia pendentes de finalização
              </p>
            </div>
          </div>

          {loading ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 animate-pulse">
              Carregando...
            </span>
          ) : deliveries.length > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
              {deliveries.length} {deliveries.length === 1 ? 'Pendente Hoje' : 'Pendentes Hoje'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 size={12} />
              Em dia
            </span>
          )}
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="my-3 p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-100 dark:border-rose-900/30 space-y-2.5 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
          </div>
        ) : deliveries.length > 0 && activeDelivery ? (
          <div className="my-3 p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-rose-100 dark:border-rose-900/40 shadow-xs space-y-2.5">
            {/* Top row: Status, Shift and Navigator */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                  {activeDelivery.status || 'Pendente'}
                </span>
                {activeDelivery.shift && (
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Turno: {activeDelivery.shift}
                  </span>
                )}
              </div>

              {deliveries.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                    {currentIndex + 1} de {deliveries.length}
                  </span>
                  <div className="flex gap-1 ml-1">
                    <button
                      type="button"
                      onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : deliveries.length - 1))}
                      className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold leading-none"
                      title="Anterior"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentIndex(prev => (prev + 1) % deliveries.length)}
                      className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold leading-none"
                      title="Próxima"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Product description */}
            <div className="flex items-start gap-2">
              <Package size={15} className="text-rose-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                  {activeDelivery.product || 'Produto não especificado'}
                </p>
                {activeDelivery.value ? (
                  <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    R$ {Number(activeDelivery.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Address & Destination */}
            <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="line-clamp-1">
                {[activeDelivery.address, activeDelivery.neighborhood, activeDelivery.city]
                  .filter(Boolean)
                  .join(', ') || 'Endereço a confirmar'}
              </p>
            </div>

            {/* Footer details: Driver, Vehicle and Seller */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Truck size={12} className="text-slate-400" />
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {activeDelivery.driver || 'Sem motorista'}
                </span>
                {activeDelivery.vehicle && (
                  <span className="text-slate-400 truncate max-w-[120px]">
                    ({activeDelivery.vehicle})
                  </span>
                )}
              </div>

              {activeDelivery.seller && (
                <div className="flex items-center gap-1">
                  <User size={11} className="text-slate-400" />
                  <span>Vendedor: <strong className="text-slate-700 dark:text-slate-300">{activeDelivery.seller}</strong></span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="my-3 p-4 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-emerald-100 dark:border-emerald-950/40 text-center space-y-1.5">
            <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Todas as entregas de hoje foram finalizadas!
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Nenhuma entrega em aberto com vencimento para hoje.
            </p>
          </div>
        )}
      </div>

      {/* Link to deliveries page */}
      <div className="pt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-medium">
          Origem: Módulo Entregas
        </span>
        <Link
          href="/deliveries?status=pending"
          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors group"
        >
          <span>Acessar aba Entregas</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
