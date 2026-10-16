'use client';

import React, { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useRole } from '@/hooks/useRole';
import { useDeadlineChecker } from '@/hooks/useDeadlineChecker';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check, AlertCircle, Smartphone, Laptop } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import Link from 'next/link';
import { registerPushNotification } from '@/lib/push';

export function NotificationManager() {
  const { isAuthenticated, isAdmin, user } = useRole();
  const { notifications } = useNotifications();
  const { isDarkMode } = useTheme();
  const [showPrompt, setShowPrompt] = useState(false);
  const { isRecursionError } = useDeadlineChecker();

  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined' && user?.id) {
      // Registrar Service Worker para notificações em segundo plano
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          // Se já tem permissão concedida, garante que o token do dispositivo está sincronizado no Supabase
          if ('Notification' in window && Notification.permission === 'granted') {
            registerPushNotification(user.id);
          }
        }).catch(err => {
          console.warn('Aviso: Registro do Service Worker indisponível:', err?.message || err);
        });
      }

      if ('Notification' in window) {
        const savedPush = localStorage.getItem('push_enabled');
        if (Notification.permission === 'default' && savedPush !== 'false') {
          // Exibir prompt com delay suave
          const timer = setTimeout(() => setShowPrompt(true), 2500);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [isAuthenticated, user?.id]);

  const handleEnable = async () => {
    try {
      localStorage.setItem('push_enabled', 'true');
      const res = await registerPushNotification(user?.id);
      
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('🔔 Notificações Ativadas!', {
            body: 'Você receberá alertas instantâneos no celular e computador sempre que uma nova rotina ou tarefa for atribuída.',
            icon: '/icons/icon-192.png'
          });
        } catch (nErr) {
          console.warn('Aviso ao exibir notificação local:', nErr);
        }
      }
    } catch (err) {
      console.warn('Aviso ao ativar push notifications:', err);
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('push_enabled', 'false');
    setShowPrompt(false);
  };

  return (
    <>
      {/* Global Recursion Error Warning for Admins */}
      <AnimatePresence>
        {isRecursionError && isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-lg p-3 rounded-xl bg-rose-500 text-white shadow-xl z-[200] flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold">Erro de Recursão RLS Detectado!</p>
              <p className="text-[10px] opacity-90">Vá ao Dashboard para copiar o SQL de correção.</p>
            </div>
            <Link href="/" className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold transition-colors">
              Ir para Dashboard
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 100, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 100, x: '-50%' }}
            className={`fixed bottom-24 left-1/2 w-[92%] max-w-md p-5 rounded-3xl border shadow-2xl z-[100] flex flex-col gap-4 backdrop-blur-xl ${
              isDarkMode ? 'bg-slate-900/95 border-slate-800 text-white shadow-blue-500/10' : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-400/20'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 shrink-0">
                <Bell size={22} className="animate-bounce" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <h4 className="text-sm font-black tracking-tight">Ativar Notificações de Tarefas & Rotinas?</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Receba alertas instantâneos sempre que uma nova tarefa ou rotina for inserida e atribuída a você, no <strong>computador</strong> e no <strong>celular</strong>.
                </p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                  <span className="flex items-center gap-1"><Laptop size={12} /> Computador</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Smartphone size={12} /> Celular / Smartphone</span>
                </div>
              </div>
              <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-2.5">
              <button 
                onClick={handleEnable}
                className="flex-1 h-11 bg-blue-600 text-white text-xs font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <Check size={16} />
                Ativar Notificações
              </button>
              <button 
                onClick={handleDismiss}
                className={`px-4 h-11 text-xs font-bold rounded-2xl transition-all ${
                  isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Depois
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
