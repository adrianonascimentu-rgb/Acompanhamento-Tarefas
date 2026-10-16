'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Truck, 
  X, 
  ChevronRight, 
  Sparkles, 
  ChevronLeft, 
  MapPin, 
  BellOff, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatLocalDate, getTodayLocalDateString } from '@/lib/utils';

interface SpecialDelivery {
  id: string | number;
  date: string;
  shift?: string;
  driver?: string;
  vehicle?: string;
  neighborhood?: string;
  city?: string;
  address?: string;
  notes?: string;
  product?: string;
  status?: string;
  delivery_type?: string;
  is_special?: boolean;
}

interface SpecialDeliveryAlertBalloonProps {
  isDarkMode?: boolean;
}

export function SpecialDeliveryAlertBalloon({ isDarkMode }: SpecialDeliveryAlertBalloonProps) {
  const [specialDeliveries, setSpecialDeliveries] = useState<SpecialDelivery[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSpecialDeliveries = useCallback(async () => {
    try {
      const today = getTodayLocalDateString();
      
      // Query deliveries that are special and not finalized yet
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .neq('status', 'Finalizada')
        .gte('date', today)
        .order('date', { ascending: true });

      if (!error && data) {
        // Filter special deliveries either by delivery_type, is_special flag, or notes/product marker
        const specials = data.filter((d: any) => 
          d.delivery_type === 'especial' || 
          d.is_special === true || 
          d.notes?.includes('[ESPECIAL]') || 
          d.product?.includes('[ESPECIAL]') ||
          d.notes?.toLowerCase().includes('entrega especial') ||
          d.notes?.toLowerCase().includes('retirada especial')
        );
        setSpecialDeliveries(specials);
      } else {
        // Fallback: check all deliveries if column filter fails
        const { data: allData } = await supabase
          .from('deliveries')
          .select('*')
          .neq('status', 'Finalizada')
          .order('date', { ascending: true })
          .limit(30);

        if (allData) {
          const specials = allData.filter((d: any) => 
            d.delivery_type === 'especial' || 
            d.is_special === true || 
            d.notes?.includes('[ESPECIAL]') || 
            d.product?.includes('[ESPECIAL]') ||
            d.notes?.toLowerCase().includes('entrega especial') ||
            d.notes?.toLowerCase().includes('retirada especial')
          );
          setSpecialDeliveries(specials);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar entregas especiais:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpecialDeliveries();

    // Listen to realtime changes on deliveries table
    const channel = supabase
      .channel('special_deliveries_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        () => {
          fetchSpecialDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSpecialDeliveries]);

  // Check if current delivery has been dismissed in this session/localStorage
  const activeDelivery = specialDeliveries[currentIndex % (specialDeliveries.length || 1)];

  useEffect(() => {
    if (activeDelivery) {
      const dismissedKey = `dismissed_special_alert_${activeDelivery.id}_${activeDelivery.date}`;
      const wasDismissed = sessionStorage.getItem(dismissedKey);
      if (wasDismissed === 'true') {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    }
  }, [activeDelivery]);

  const handleDismiss = () => {
    if (activeDelivery) {
      const dismissedKey = `dismissed_special_alert_${activeDelivery.id}_${activeDelivery.date}`;
      sessionStorage.setItem(dismissedKey, 'true');
    }
    setIsDismissed(true);
  };

  const handleReopen = () => {
    if (activeDelivery) {
      const dismissedKey = `dismissed_special_alert_${activeDelivery.id}_${activeDelivery.date}`;
      sessionStorage.removeItem(dismissedKey);
    }
    setIsDismissed(false);
    setIsMinimized(false);
  };

  if (loading || specialDeliveries.length === 0) {
    return null;
  }

  // Minimized pill when dismissed
  if (isDismissed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-24 right-4 z-40"
      >
        <button
          onClick={handleReopen}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all border border-amber-300"
          title="Ver aviso de Entrega/Retirada Especial"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
          </span>
          <AlertTriangle size={14} />
          <span>Aviso: Entrega Especial ({specialDeliveries.length})</span>
        </button>
      </motion.div>
    );
  }

  const cleanNotes = activeDelivery.notes?.replace('[ESPECIAL]', '').trim();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.92 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: 1,
          x: [0, 0, -5, 5, -3, 3, -1, 1, 0],
          rotate: [0, 0, -1.2, 1.2, -0.8, 0.8, -0.4, 0.4, 0]
        }}
        exit={{ opacity: 0, y: 30, scale: 0.9 }}
        transition={{ 
          duration: 1.1,
          ease: "easeOut",
          times: [0, 0.3, 0.42, 0.54, 0.66, 0.78, 0.88, 0.95, 1],
          opacity: { duration: 0.4, ease: "easeOut" },
          y: { duration: 0.4, ease: "easeOut" }
        }}
        className="balao-flutuante-informativo fixed bottom-20 md:bottom-8 right-3 md:right-8 z-50 max-w-md w-[calc(100%-1.5rem)] sm:w-auto"
      >
        <div
          className={`balao-flutuante-informativo relative rounded-3xl p-5 border-2 shadow-[0_15px_50px_-10px_rgba(245,158,11,0.45)] backdrop-blur-xl transition-all overflow-hidden ${
            isDarkMode 
              ? 'bg-slate-900/95 border-amber-500 text-white' 
              : 'bg-white/95 border-amber-500 text-slate-900'
          }`}
        >
          {/* Animated Glowing Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 animate-pulse" />

          {/* Header Tag & Close Button */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-xs flex items-center gap-1">
                <Sparkles size={11} />
                Entrega / Retirada Especial
              </span>
              {specialDeliveries.length > 1 && (
                <span className="text-[10px] font-bold text-slate-400">
                  {currentIndex + 1} de {specialDeliveries.length}
                </span>
              )}
            </div>

            <button
              onClick={handleDismiss}
              className={`p-1.5 rounded-full transition-colors ${
                isDarkMode 
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-white' 
                  : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
              }`}
              title="Fechar aviso (já li)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Content Alert */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle size={22} className="animate-bounce" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm md:text-base leading-snug">
                  Bloqueio de Agenda para Entregas
                </h4>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  Por favor, NÃO marquem nenhuma entrega nesta data!
                </p>
              </div>
            </div>

            {/* Date and Shift Box */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
              isDarkMode ? 'bg-amber-950/30 border-amber-800/60' : 'bg-amber-50/80 border-amber-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <Calendar size={18} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Data Reservada</span>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                    {formatLocalDate(activeDelivery.date)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg">
                <Clock size={12} className="text-amber-500" />
                <span>{activeDelivery.shift || 'Dia Todo'}</span>
              </div>
            </div>

            {/* Delivery Info Snippet */}
            <div className="text-xs space-y-1.5 pt-1 text-slate-600 dark:text-slate-300">
              {activeDelivery.driver && (
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-amber-500 shrink-0" />
                  <span className="font-semibold">Motorista/Veículo:</span>
                  <span className="truncate">{activeDelivery.driver} {activeDelivery.vehicle ? `(${activeDelivery.vehicle})` : ''}</span>
                </div>
              )}
              {activeDelivery.neighborhood && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-rose-500 shrink-0" />
                  <span className="font-semibold">Local:</span>
                  <span className="truncate">{activeDelivery.neighborhood}, {activeDelivery.city}</span>
                </div>
              )}
              {cleanNotes && (
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] italic text-slate-500 dark:text-slate-400 line-clamp-2">
                  &ldquo;{cleanNotes}&rdquo;
                </div>
              )}
            </div>

            {/* Footer Navigation & Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
              {specialDeliveries.length > 1 ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : specialDeliveries.length - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentIndex(prev => (prev + 1) % specialDeliveries.length)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Próxima"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDismiss}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isDarkMode 
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-300' 
                      : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  Entendido, fechar
                </button>
                <Link
                  href={`/deliveries?status=all`}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm hover:brightness-105 active:scale-95 transition-all"
                >
                  <span>Ver Entregas</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
export default SpecialDeliveryAlertBalloon;
