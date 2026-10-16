'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Wifi, WifiOff, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '@/lib/supabase';

interface NetworkMonitorProps {
  isDarkMode?: boolean;
}

export function NetworkMonitor({ isDarkMode }: NetworkMonitorProps) {
  const [latency, setLatency] = useState<number | null>(null);
  const [status, setStatus] = useState<'optimal' | 'average' | 'slow' | 'offline'>('optimal');
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [history, setHistory] = useState<number[]>([]);

  const measureLatency = useCallback(async () => {
    const start = performance.now();
    try {
      // First try quick local health endpoint
      const res = await fetch('/api/health', { cache: 'no-store' });
      const end = performance.now();
      const rtt = Math.max(1, Math.round(end - start));

      if (res.ok) {
        setLatency(rtt);
        setLastCheck(new Date());
        setHistory(prev => [...prev.slice(-19), rtt]);

        if (rtt < 150) setStatus('optimal');
        else if (rtt < 400) setStatus('average');
        else setStatus('slow');
      } else {
        setStatus('offline');
        setLatency(null);
      }
    } catch {
      setStatus('offline');
      setLatency(null);
    }
  }, []);

  useEffect(() => {
    measureLatency();
    const interval = setInterval(measureLatency, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [measureLatency]);

  const getStatusColor = () => {
    switch (status) {
      case 'optimal': return 'text-emerald-500';
      case 'average': return 'text-amber-500';
      case 'slow': return 'text-rose-500';
      case 'offline': return 'text-slate-500';
    }
  };

  const getStatusBg = () => {
    switch (status) {
      case 'optimal': return 'bg-emerald-500/10';
      case 'average': return 'bg-amber-500/10';
      case 'slow': return 'bg-rose-500/10';
      case 'offline': return 'bg-slate-500/10';
    }
  };

  return (
    <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${getStatusBg()} ${getStatusColor()}`}>
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">API Performance</h3>
            <p className="text-[10px] opacity-50">Supabase Latency</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`size-2 rounded-full animate-pulse ${status === 'offline' ? 'bg-slate-500' : (status === 'slow' ? 'bg-rose-500' : 'bg-emerald-500')}`} />
          <span className={`text-[10px] font-bold uppercase ${getStatusColor()}`}>
            {status === 'offline' ? 'Desconectado' : (status === 'optimal' ? 'Excelente' : (status === 'average' ? 'Normal' : 'Lento'))}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black tabular-nums">
              {latency !== null ? latency : '--'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">ms</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">
            Latência Atual
          </p>
        </div>
        
        <div className="flex gap-0.5 items-end h-8">
          {history.map((val, i) => {
            const h = Math.min(100, (val / 500) * 100);
            return (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                className={`w-1 rounded-t-full ${
                  val < 150 ? 'bg-emerald-500/40' : (val < 400 ? 'bg-amber-500/40' : 'bg-rose-500/40')
                }`}
              />
            );
          })}
        </div>
      </div>

      <div className={`p-2 rounded-xl flex items-center justify-between text-[9px] font-bold uppercase tracking-tight ${isDarkMode ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
        <div className="flex items-center gap-1">
          <Zap size={10} className="text-amber-500" />
          <span>Última Verificação: {lastCheck.toLocaleTimeString()}</span>
        </div>
        <button 
          onClick={() => measureLatency()}
          className="text-blue-600 hover:text-blue-700 transition-colors"
        >
          Testar Agora
        </button>
      </div>
    </div>
  );
}
