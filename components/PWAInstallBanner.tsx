'use client';

import { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, installApp } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || !isInstallable || dismissed) {
    return null;
  }

  return (
    <>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 shrink-0" />
          <span className="font-medium">Instale o app AgenteX no celular para acesso rápido e offline</span>
        </div>
        <div className="flex items-center gap-2">
          {isIOS ? (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="bg-white text-blue-600 font-semibold px-2.5 py-1 rounded-md text-[11px] active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              Como Instalar
            </button>
          ) : (
            <button
              onClick={installApp}
              className="bg-white text-blue-600 font-semibold px-2.5 py-1 rounded-md text-[11px] active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              Instalar App
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-white/80 hover:text-white"
            title="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal instrução para iOS */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 max-w-sm w-full text-zinc-900 dark:text-zinc-100 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Instalar no iPhone / iPad</h3>
              <button onClick={() => setShowIOSGuide(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Para instalar este aplicativo no iOS via Safari:
            </p>
            <ol className="text-xs space-y-2 text-zinc-700 dark:text-zinc-300">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Toque no botão <Share className="w-3.5 h-3.5 inline mx-1 text-blue-500" /> <b>Compartilhar</b> no Safari</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Role para baixo e selecione <PlusSquare className="w-3.5 h-3.5 inline mx-1" /> <b>Adicionar à Tela de Início</b></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">3</span>
                <span>Toque em <b>Adicionar</b> no canto superior direito</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full mt-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
