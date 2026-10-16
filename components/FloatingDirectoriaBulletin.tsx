'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Paperclip, 
  Image as ImageIcon, 
  X, 
  Trash2, 
  UploadCloud, 
  Sparkles, 
  Maximize2, 
  Download, 
  ExternalLink, 
  Plus, 
  Clipboard, 
  Check, 
  Loader2,
  Calendar,
  User,
  Megaphone,
  Pin,
  ChevronDown,
  Info,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import { useUI } from '@/hooks/useUI';
import { supabase } from '@/lib/supabase';

export interface BoardPrint {
  id: string;
  title: string;
  image_url: string;
  author_name: string;
  author_id?: string;
  author_role?: string;
  notes?: string;
  is_pinned?: boolean;
  created_at: string;
}

const STORAGE_KEY = 'board_bulletin_prints_v1';
const SEEN_PRINT_IDS_KEY = 'board_bulletin_seen_ids_v1';

export function FloatingDirectoriaBulletin() {
  const pathname = usePathname();
  const { isDarkMode } = useTheme();
  const { user, isAuthenticated, isAdmin, role } = useRole();
  const { showToast } = useUI();

  // Apenas Administrador, Gerente e Supervisor podem postar mensagens, fotos e prints
  const canPublish = isAdmin || role === 'gerente' || role === 'supervisor';

  const [isOpen, setIsOpen] = useState(false);
  const [prints, setPrints] = useState<BoardPrint[]>([]);
  const [seenPrintIds, setSeenPrintIds] = useState<string[]>([]);
  const [selectedPrint, setSelectedPrint] = useState<BoardPrint | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isPinnedInput, setIsPinnedInput] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Load seen IDs on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SEEN_PRINT_IDS_KEY);
      if (stored) {
        setSeenPrintIds(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Erro ao carregar mensagens vistas do mural:', e);
    }
  }, []);

  // Load prints on mount
  useEffect(() => {
    loadPrints();
  }, []);

  const loadPrints = async () => {
    try {
      // 1. Try fetching from Supabase system_settings
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'DIRECTORIA_BULLETIN_BOARD')
        .single();

      if (!error && data?.value && Array.isArray(data.value)) {
        setPrints(data.value);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value));
        return;
      }
    } catch (e) {
      console.warn('Fallback para armazenamento local do mural da diretoria');
    }

    // 2. Fallback to localStorage
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        setPrints(JSON.parse(cached));
      }
    } catch (e) {
      console.error('Erro ao ler cache local de prints:', e);
    }
  };

  const syncPrints = async (updated: BoardPrint[]) => {
    setPrints(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}

    try {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'DIRECTORIA_BULLETIN_BOARD',
          value: updated
        }, { onConflict: 'key' });
    } catch (e) {
      console.warn('Aviso: salvo localmente no mural da diretoria');
    }
  };

  // Paste Event Listener (Ctrl + V / Cmd + V) anywhere when modal is open (somente quem tem permissão pode colar)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      if (!canPublish) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            showToast('Print colado da área de transferência!', 'success');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen, canPublish]);

  const handleImageFile = (file: File) => {
    if (!canPublish) {
      showToast('Apenas administradores, gerentes e supervisores podem adicionar prints.', 'error');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecione um arquivo de imagem.', 'error');
      return;
    }

    // Check size < 10MB
    if (file.size > 10 * 1024 * 1024) {
      showToast('A imagem deve ter no máximo 10MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPreviewImage(base64);
      if (!titleInput) {
        setTitleInput(`Comunicado Diretoria (${new Date().toLocaleDateString('pt-BR')})`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePrint = async () => {
    if (!canPublish) {
      showToast('Você não tem permissão para publicar comunicados no mural da diretoria.', 'error');
      return;
    }

    if (!previewImage) {
      showToast('Por favor cole ou selecione uma imagem.', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      const roleLabel = isAdmin ? 'Administrador' : (role === 'gerente' ? 'Gerência' : (role === 'supervisor' ? 'Supervisão' : 'Diretoria'));
      const newPrint: BoardPrint = {
        id: 'print_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: titleInput.trim() || `Comunicado Diretoria (${new Date().toLocaleDateString('pt-BR')})`,
        image_url: previewImage,
        author_name: user?.name ? `${user.name} (${roleLabel})` : roleLabel,
        author_id: user?.id,
        author_role: role,
        notes: notesInput.trim() || undefined,
        is_pinned: isPinnedInput,
        created_at: new Date().toISOString()
      };

      const updated = [newPrint, ...prints];
      await syncPrints(updated);

      // Marca o novo print como visto pelo autor que acabou de criá-lo
      markPrintAsSeen(newPrint.id);

      setPreviewImage(null);
      setTitleInput('');
      setNotesInput('');
      showToast('Print da diretoria publicado com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro ao salvar print:', err);
      showToast('Erro ao publicar print. Tente novamente.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePrint = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canPublish) {
      showToast('Apenas a gestão pode remover comunicados.', 'error');
      return;
    }
    const updated = prints.filter(p => p.id !== id);
    await syncPrints(updated);
    if (selectedPrint?.id === id) {
      setSelectedPrint(null);
    }
    showToast('Print removido do mural.', 'info');
  };

  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canPublish) {
      showToast('Apenas a gestão pode fixar comunicados.', 'error');
      return;
    }
    const updated = prints.map(p => p.id === id ? { ...p, is_pinned: !p.is_pinned } : p);
    await syncPrints(updated);
  };

  // Marca um ou mais prints como lidos
  const markPrintAsSeen = (id: string) => {
    setSeenPrintIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(SEEN_PRINT_IDS_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const markAllPrintsAsSeen = () => {
    const allIds = prints.map(p => p.id);
    setSeenPrintIds(allIds);
    try {
      localStorage.setItem(SEEN_PRINT_IDS_KEY, JSON.stringify(allIds));
    } catch (e) {}
  };

  // Abertura do modal do mural
  const handleOpenModal = () => {
    setIsOpen(true);
    // Ao abrir o mural da diretoria, todas as mensagens são consideradas visualizadas
    markAllPrintsAsSeen();
  };

  // Abertura de um print específico em tela cheia
  const handleOpenPrint = (item: BoardPrint) => {
    setSelectedPrint(item);
    markPrintAsSeen(item.id);
  };

  // Quantidade de mensagens novas (não vistas)
  const unreadCount = useMemo(() => {
    return prints.filter(p => !seenPrintIds.includes(p.id)).length;
  }, [prints, seenPrintIds]);

  // Verificar se estamos estritamente na tela inicial (Dashboard /)
  const isHomePage = pathname === '/' || pathname === '';

  // O balão flutuante só deve aparecer na tela inicial e apenas se autenticado
  if (!isAuthenticated || !isHomePage) {
    return (
      <>
        {/* Renderiza apenas os modais caso estejam abertos por algum gatilho */}
        <AnimatePresence>
          {selectedPrint && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPrint(null)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative w-full max-w-5xl max-h-[95vh] flex flex-col rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 text-white z-10 shadow-2xl"
              >
                <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/60">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base truncate">{selectedPrint.title}</h3>
                    <p className="text-[11px] text-slate-400">
                      Postado por {selectedPrint.author_name} • {new Date(selectedPrint.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={selectedPrint.image_url}
                      download={`diretoria_${selectedPrint.id}.png`}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Baixar imagem"
                    >
                      <Download size={18} />
                    </a>
                    <button
                      onClick={() => setSelectedPrint(null)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPrint.image_url}
                    alt={selectedPrint.title}
                    className="max-h-[70vh] w-auto object-contain rounded-xl shadow-2xl"
                  />
                </div>
                {selectedPrint.notes && (
                  <div className="p-4 border-t border-slate-800 bg-slate-900/80 text-xs">
                    <span className="font-bold text-orange-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                      Observações repassadas:
                    </span>
                    <p className="text-slate-300 leading-relaxed">{selectedPrint.notes}</p>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      {/* Botão Flutuante (Floating Action Button) - Exibido EXCLUSIVAMENTE na tela inicial */}
      <div className="fixed bottom-20 md:bottom-6 right-5 z-40">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleOpenModal}
          className="group flex items-center gap-2.5 px-4 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black text-xs uppercase tracking-wider rounded-full shadow-2xl shadow-orange-500/40 border-2 border-white/30 backdrop-blur-md transition-all cursor-pointer"
          title="Mural de Prints da Diretoria (Avisos e Metas)"
        >
          <div className="relative">
            <Megaphone size={18} className={unreadCount > 0 ? "animate-bounce" : ""} />
            {/* Notificação de nova mensagem: desaparece quando o usuário abre as mensagens */}
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-white text-orange-600 font-black text-[10px] min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center shadow-md animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="hidden sm:inline font-bold">Mural Diretoria</span>
        </motion.button>
      </div>

      {/* Modal Principal do Mural de Prints */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[32px] overflow-hidden border shadow-2xl ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
              }`}
            >
              {/* Top Header */}
              <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                    <Megaphone size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-black truncate">Mural de Prints da Diretoria</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                        {prints.length} {prints.length === 1 ? 'registro' : 'registros'}
                      </span>
                      {canPublish ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <ShieldCheck size={11} /> Permissão de Publicação
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/20 flex items-center gap-1">
                          <Lock size={10} /> Modo Visualização
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {canPublish 
                        ? 'Envio e publicação de prints, avisos e metas exclusivo da Gestão (Admin / Gerente / Supervisor)'
                        : 'Mural de comunicados e diretrizes emitidos pela gestão e diretoria'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body Content */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* Área de Colagem / Upload - EXCLUSIVA PARA ADMIN, GERENTE E SUPERVISOR */}
                {canPublish ? (
                  <div
                    ref={pasteAreaRef}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleImageFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`p-5 rounded-3xl border-2 border-dashed transition-all ${
                      isDragOver 
                        ? 'border-orange-500 bg-orange-500/10' 
                        : (isDarkMode ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700' : 'border-slate-200 bg-slate-50/80 hover:border-slate-300')
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImageFile(e.target.files[0]);
                        }
                      }}
                    />

                    {!previewImage ? (
                      <div className="flex flex-col items-center justify-center text-center py-4">
                        <div className="size-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3">
                          <UploadCloud size={28} />
                        </div>
                        <h4 className="font-bold text-sm mb-1">
                          Pressione <kbd className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-xs font-mono font-black">Ctrl + V</kbd> para colar qualquer print
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                          Ou arraste uma captura de tela para esta área, ou escolha do seu computador / celular.
                        </p>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 active:scale-95 flex items-center gap-1.5"
                        >
                          <ImageIcon size={15} />
                          <span>Selecionar Arquivo</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <div className="relative max-w-xs aspect-video w-full rounded-2xl overflow-hidden border border-slate-700 bg-black flex items-center justify-center shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={previewImage} 
                              alt="Prévia do print" 
                              className="max-h-full max-w-full object-contain"
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewImage(null)}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-rose-600 text-white transition-colors"
                              title="Remover imagem"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="flex-1 w-full space-y-3">
                            <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                                Título do Comunicado
                              </label>
                              <input
                                type="text"
                                value={titleInput}
                                onChange={(e) => setTitleInput(e.target.value)}
                                placeholder="Ex: Metas Semanais, Aviso de Feriado, Nova Diretriz..."
                                className={`w-full h-10 px-3.5 rounded-xl border text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500 ${
                                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                                Observações ou Mensagem da Diretoria (Opcional)
                              </label>
                              <textarea
                                rows={2}
                                value={notesInput}
                                onChange={(e) => setNotesInput(e.target.value)}
                                placeholder="Digite observações sobre o print, prazos ou quem deve cumprir..."
                                className={`w-full p-2.5 rounded-xl border text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500 resize-none ${
                                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              />
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                                <input
                                  type="checkbox"
                                  checked={isPinnedInput}
                                  onChange={(e) => setIsPinnedInput(e.target.checked)}
                                  className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
                                />
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                  Fixar no topo do mural
                                </span>
                              </label>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(null)}
                                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={isUploading}
                                  onClick={handleSavePrint}
                                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                  <span>Publicar no Mural</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Banner informativo para colaboradores que apenas visualizam */
                  <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
                    isDarkMode ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200/80 text-slate-600'
                  }`}>
                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 shrink-0">
                      <Lock size={16} />
                    </div>
                    <p className="text-xs leading-relaxed">
                      A publicação de mensagens, metas e prints neste mural é restrita aos <strong>Administradores, Gerentes e Supervisores</strong>. Você pode clicar em qualquer print abaixo para visualizá-lo em tela cheia e acompanhar os comunicados oficiais.
                    </p>
                  </div>
                )}

                {/* Lista de Prints do Mural */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <span>Prints & Comunicados Salvos</span>
                      <span className="text-xs text-slate-400 font-normal">({prints.length})</span>
                    </h3>
                  </div>

                  {prints.length === 0 ? (
                    <div className="text-center py-12 border border-dashed rounded-3xl border-slate-200 dark:border-slate-800">
                      <div className="size-16 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-3">
                        <ImageIcon size={30} />
                      </div>
                      <p className="font-bold text-sm">Nenhum print publicado ainda</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {canPublish 
                          ? 'Copie um print da tela e pressione Ctrl+V para começar a guardar os comunicados da diretoria.'
                          : 'Nenhum comunicado oficial foi publicado pela diretoria até o momento.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {prints.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleOpenPrint(item)}
                          className={`group relative rounded-2xl border overflow-hidden transition-all hover:scale-[1.02] cursor-pointer flex flex-col justify-between ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-orange-500/50' : 'bg-white border-slate-200 hover:border-orange-300 shadow-sm'
                          }`}
                        >
                          {/* Pin Indicator */}
                          {item.is_pinned && (
                            <div className="absolute top-2.5 left-2.5 z-10 p-1.5 rounded-lg bg-orange-500 text-white shadow-md">
                              <Pin size={12} />
                            </div>
                          )}

                          {/* Action Buttons Top Right (Apenas para Gestão: Admin, Gerente e Supervisor) */}
                          {canPublish && (
                            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => handleTogglePin(item.id, e)}
                                title={item.is_pinned ? 'Desafixar' : 'Fixar'}
                                className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 backdrop-blur-xs"
                              >
                                <Pin size={13} className={item.is_pinned ? 'text-orange-400' : 'text-white'} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeletePrint(item.id, e)}
                                title="Excluir"
                                className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-rose-600 backdrop-blur-xs transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}

                          {/* Image Thumbnail */}
                          <div className="relative aspect-video w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                            <div className="absolute bottom-2 right-2 p-1 rounded-md bg-black/70 text-white text-[10px] font-bold flex items-center gap-1">
                              <Maximize2 size={11} /> Expandir
                            </div>
                          </div>

                          {/* Info Footer */}
                          <div className="p-3.5 space-y-1.5">
                            <p className="font-bold text-xs truncate" title={item.title}>
                              {item.title}
                            </p>
                            {item.notes && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                                {item.notes}
                              </p>
                            )}
                            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
                              <span className="truncate">{item.author_name}</span>
                              <span className="shrink-0">{new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Visualizador em Tela Cheia (Zoom da Imagem) */}
      <AnimatePresence>
        {selectedPrint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPrint(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-5xl max-h-[95vh] flex flex-col rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 text-white z-10 shadow-2xl"
            >
              {/* Header do Zoom */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/60">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base truncate">{selectedPrint.title}</h3>
                  <p className="text-[11px] text-slate-400">
                    Postado por {selectedPrint.author_name} • {new Date(selectedPrint.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={selectedPrint.image_url}
                    download={`diretoria_${selectedPrint.id}.png`}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Baixar imagem"
                  >
                    <Download size={18} />
                  </a>
                  <button
                    onClick={() => setSelectedPrint(null)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Imagem em Alta Resolução */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPrint.image_url}
                  alt={selectedPrint.title}
                  className="max-h-[70vh] w-auto object-contain rounded-xl shadow-2xl"
                />
              </div>

              {/* Observações da Diretoria se houver */}
              {selectedPrint.notes && (
                <div className="p-4 border-t border-slate-800 bg-slate-900/80 text-xs">
                  <span className="font-bold text-orange-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                    Observações repassadas:
                  </span>
                  <p className="text-slate-300 leading-relaxed">{selectedPrint.notes}</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
