'use client';

import React, { useState, useRef, useMemo } from 'react';
import { authFetch } from '@/lib/authFetch';
import { 
  FileUp, 
  UploadCloud, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  RefreshCw, 
  Layers, 
  Sparkles, 
  Boxes, 
  Tag, 
  Building2, 
  ArrowRight, 
  FileText, 
  Eye, 
  Check, 
  PlusCircle, 
  ShieldCheck, 
  Lock,
  Search,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { CatalogProduct, formatCurrency, formatStock, inferCategory } from '@/lib/catalogProducts';

interface ExtractedProduct {
  code: string;
  name: string;
  additionalCode: string;
  stock: number;
  manufacturer: string;
  price: number;
}

interface ProductDiff {
  type: 'new' | 'updated' | 'unchanged';
  item: CatalogProduct;
  oldItem?: CatalogProduct;
  changes?: {
    field: string;
    oldVal: any;
    newVal: any;
  }[];
}

interface PdfUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProducts: CatalogProduct[];
  onApplyUpdate: (updatedCatalog: CatalogProduct[], summary: { newCount: number; updatedCount: number; totalCount: number }) => void;
  userRole?: string;
  userName?: string;
  isAdmin?: boolean;
}

export default function PdfUploadModal({
  isOpen,
  onClose,
  currentProducts,
  onApplyUpdate,
  userRole = '',
  userName = 'Usuário',
  isAdmin = false,
}: PdfUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Analysis result
  const [extractedList, setExtractedList] = useState<ExtractedProduct[] | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'new' | 'updated' | 'unchanged'>('all');
  const [previewSearch, setPreviewSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Check role authorization
  const normalizedRole = (userRole || '').toLowerCase();
  const isAuthorized = 
    isAdmin || 
    normalizedRole === 'admin' || 
    normalizedRole === 'administrador' || 
    normalizedRole === 'gerente' || 
    normalizedRole === 'supervisor' ||
    normalizedRole === 'estoque' ||
    normalizedRole === 'diretoria' ||
    normalizedRole === 'gestor';

  // Compute diffs between extracted products and current catalog
  const diffs: ProductDiff[] = useMemo(() => {
    if (!extractedList) return [];

    const existingMap = new Map<string, CatalogProduct>();
    currentProducts.forEach(p => {
      existingMap.set(p.code.toLowerCase().trim(), p);
    });

    return extractedList.map(extracted => {
      const existing = existingMap.get(extracted.code.toLowerCase().trim());
      const newCategory = inferCategory(extracted.name, extracted.manufacturer);

      const newItem: CatalogProduct = {
        id: extracted.code,
        code: extracted.code,
        name: extracted.name,
        additionalCode: extracted.additionalCode || '-',
        stock: extracted.stock,
        manufacturer: extracted.manufacturer,
        price: extracted.price,
        category: newCategory,
      };

      if (!existing) {
        return {
          type: 'new',
          item: newItem,
        };
      }

      // Check for changes
      const changes: { field: string; oldVal: any; newVal: any }[] = [];
      if (existing.price !== extracted.price) {
        changes.push({ field: 'Preço', oldVal: existing.price, newVal: extracted.price });
      }
      if (existing.stock !== extracted.stock) {
        changes.push({ field: 'Estoque', oldVal: existing.stock, newVal: extracted.stock });
      }
      if (existing.additionalCode !== extracted.additionalCode && extracted.additionalCode !== '-') {
        changes.push({ field: 'Referência', oldVal: existing.additionalCode, newVal: extracted.additionalCode });
      }
      if (existing.manufacturer !== extracted.manufacturer) {
        changes.push({ field: 'Fabricante', oldVal: existing.manufacturer, newVal: extracted.manufacturer });
      }
      if (existing.name !== extracted.name) {
        changes.push({ field: 'Descrição', oldVal: existing.name, newVal: extracted.name });
      }

      if (changes.length > 0) {
        return {
          type: 'updated',
          item: newItem,
          oldItem: existing,
          changes,
        };
      }

      return {
        type: 'unchanged',
        item: existing,
      };
    });
  }, [extractedList, currentProducts]);

  const stats = useMemo(() => {
    const total = diffs.length;
    const newItems = diffs.filter(d => d.type === 'new');
    const updatedItems = diffs.filter(d => d.type === 'updated');
    const unchangedItems = diffs.filter(d => d.type === 'unchanged');
    return {
      total,
      newCount: newItems.length,
      updatedCount: updatedItems.length,
      unchangedCount: unchangedItems.length,
    };
  }, [diffs]);

  const filteredDiffs = useMemo(() => {
    return diffs.filter(d => {
      if (previewFilter !== 'all' && d.type !== previewFilter) return false;
      if (!previewSearch) return true;
      const term = previewSearch.toLowerCase().trim();
      return (
        d.item.name.toLowerCase().includes(term) ||
        d.item.code.toLowerCase().includes(term) ||
        d.item.additionalCode.toLowerCase().includes(term) ||
        d.item.manufacturer.toLowerCase().includes(term)
      );
    });
  }, [diffs, previewFilter, previewSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredDiffs.length / pageSize));
  const paginatedDiffs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDiffs.slice(start, start + pageSize);
  }, [filteredDiffs, currentPage, pageSize]);

  const handleFileSelect = (selected: File) => {
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Por favor, selecione exclusivamente um arquivo no formato PDF (.pdf).');
      return;
    }
    setFile(selected);
    setErrorMessage(null);
    setExtractedList(null);
  };

  const handleProcessPdf = async () => {
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);
    setLoadingStep('Preparando e codificando arquivo PDF...');

    try {
      // Convert file to Base64 in browser for highest network reliability
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          const data = res.includes(',') ? res.split(',')[1] : res;
          resolve(data);
        };
        reader.onerror = () => reject(new Error('Falha ao ler o arquivo PDF no navegador.'));
        reader.readAsDataURL(file);
      });

      setLoadingStep('Enviando documento para processamento com Inteligência Artificial...');

      const res = await authFetch('/api/catalog/import-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfBase64: base64Data,
          mimeType: file.type || 'application/pdf',
          fileName: file.name,
        }),
      });

      setLoadingStep('Interpretando produtos, referências, estoques e preços...');
      const responseText = await res.text();

      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        if (responseText.includes('<!doctype') || responseText.includes('<html') || responseText.trim().startsWith('<')) {
          throw new Error(`O servidor retornou uma página de erro (Status ${res.status}). O serviço pode estar sobrecarregado temporariamente. Por favor, tente novamente em instantes.`);
        }
        throw new Error(`Resposta não estruturada do servidor: ${responseText.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `Erro ao processar o PDF (Status ${res.status})`);
      }

      if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
        throw new Error('Nenhum produto ou peça foi localizado na formatação da tabela do arquivo enviado.');
      }

      setExtractedList(data.products);
      setSuccessMessage(`${data.products.length} itens extraídos com sucesso do PDF!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Erro na importação do PDF:', err);
      setErrorMessage(err?.message || 'Falha ao processar o arquivo PDF. Verifique se o arquivo possui uma tabela legível.');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleApply = () => {
    if (!diffs.length) return;

    // Build merged catalog
    // Start with existing products
    const productMap = new Map<string, CatalogProduct>();
    currentProducts.forEach(p => {
      productMap.set(p.code.toLowerCase().trim(), p);
    });

    // Update with newly parsed/updated products
    diffs.forEach(d => {
      if (d.type === 'new' || d.type === 'updated') {
        productMap.set(d.item.code.toLowerCase().trim(), d.item);
      }
    });

    const newCatalogList = Array.from(productMap.values());

    // Trigger confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}

    onApplyUpdate(newCatalogList, {
      newCount: stats.newCount,
      updatedCount: stats.updatedCount,
      totalCount: diffs.length,
    });

    // Reset and close
    setFile(null);
    setExtractedList(null);
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setExtractedList(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-blue-50/50 via-transparent to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20 flex items-center justify-center shrink-0">
              <FileUp size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Atualização do Catálogo via PDF
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  Admin / Gerência / Supervisão
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Envie o arquivo PDF de exportação para atualizar preços, referências, estoques e cadastrar automaticamente novos itens.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Access Permission Warning if not authorized */}
        {!isAuthorized ? (
          <div className="p-8 text-center space-y-4">
            <div className="size-16 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto">
              <Lock size={30} />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Permissão Restrita
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                A importação e atualização em lote via arquivo PDF está liberada exclusivamente para perfis de <strong>Administrador</strong>, <strong>Gerente</strong> e <strong>Supervisor</strong>.
              </p>
              <p className="text-[11px] text-slate-400">
                Seu perfil atual: <span className="font-semibold uppercase">{userRole || 'Vendedor'}</span>. Solicite a um administrador para realizar a carga.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Step 1: Upload or file loaded */}
            {!extractedList ? (
              <div className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]' 
                      : file 
                        ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 bg-slate-50/50 dark:bg-slate-950/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {file ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                        <FileText size={32} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • Documento PDF Selecionado
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
                        Clique para escolher outro arquivo
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="size-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                        <UploadCloud size={32} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          Arraste o arquivo PDF aqui ou <span className="text-blue-600 dark:text-blue-400 underline">clique para selecionar</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Formato suportado: Relatório/Exportação em PDF (Tabela de Preços, Produtos e Estoque)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Requirements info card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                    <Sparkles size={15} className="text-blue-500" />
                    <span>Como funciona a atualização inteligente:</span>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 list-disc list-inside">
                    <li><strong className="text-slate-700 dark:text-slate-300">Atualização Automática:</strong> Produtos já existentes terão preço, estoque e referência atualizados.</li>
                    <li><strong className="text-slate-700 dark:text-slate-300">Cadastro de Novos:</strong> Itens inéditos no PDF serão cadastrados automaticamente com todas as informações.</li>
                    <li><strong className="text-slate-700 dark:text-slate-300">Formatação Limpa:</strong> O sistema remove prefixos como "#" dos códigos automaticamente.</li>
                    <li><strong className="text-slate-700 dark:text-slate-300">Visualização Prévia:</strong> Você poderá revisar todas as alterações antes de confirmar a gravação.</li>
                  </ul>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-3">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Não foi possível processar o arquivo</p>
                      <p className="text-[11px] opacity-90 mt-0.5">{errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-center space-y-3">
                    <RefreshCw className="size-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        Processando PDF com Inteligência Artificial...
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                        {loadingStep}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Isso pode levar alguns segundos dependendo da quantidade de páginas e itens no documento.
                    </p>
                  </div>
                )}

                {/* Action Buttons for Step 1 */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleProcessPdf}
                    disabled={!file || isLoading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Extraindo Dados...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        <span>Analisar e Extrair Produtos</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Diff Preview & Confirmation */
              <div className="space-y-5">
                {/* Stats Header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Total no PDF</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">{stats.total}</span>
                    <span className="text-[10px] text-slate-400 block">Itens encontrados</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Novos Itens</span>
                      <PlusCircle size={14} className="text-emerald-500" />
                    </div>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.newCount}</span>
                    <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block">Serão cadastrados</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Atualizados</span>
                      <RefreshCw size={14} className="text-blue-500" />
                    </div>
                    <span className="text-xl font-black text-blue-600 dark:text-blue-400">{stats.updatedCount}</span>
                    <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 block">Preço / Estoque / Ref</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Inalterados</span>
                    <span className="text-xl font-black text-slate-700 dark:text-slate-300">{stats.unchangedCount}</span>
                    <span className="text-[10px] text-slate-400 block">Mesmos dados</span>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full sm:w-auto overflow-x-auto">
                    <button
                      onClick={() => { setPreviewFilter('all'); setCurrentPage(1); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        previewFilter === 'all'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Todos ({stats.total})
                    </button>
                    <button
                      onClick={() => { setPreviewFilter('new'); setCurrentPage(1); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        previewFilter === 'new'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-emerald-600 dark:text-emerald-400 hover:opacity-80'
                      }`}
                    >
                      Novos ({stats.newCount})
                    </button>
                    <button
                      onClick={() => { setPreviewFilter('updated'); setCurrentPage(1); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        previewFilter === 'updated'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-blue-600 dark:text-blue-400 hover:opacity-80'
                      }`}
                    >
                      Atualizados ({stats.updatedCount})
                    </button>
                    <button
                      onClick={() => { setPreviewFilter('unchanged'); setCurrentPage(1); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        previewFilter === 'unchanged'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Inalterados ({stats.unchangedCount})
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={previewSearch}
                      onChange={(e) => { setPreviewSearch(e.target.value); setCurrentPage(1); }}
                      placeholder="Filtrar na prévia..."
                      className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Table Preview */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3">Nome / Descrição</th>
                        <th className="py-2.5 px-3">Referência</th>
                        <th className="py-2.5 px-3">Fabricante</th>
                        <th className="py-2.5 px-3 text-right">Estoque</th>
                        <th className="py-2.5 px-3 text-right">Preço (10X)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                      {filteredDiffs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Nenhum item encontrado com os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        paginatedDiffs.map((diff, idx) => (
                          <tr 
                            key={`${diff.item.code}-${idx}`}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              diff.type === 'new' 
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20' 
                                : diff.type === 'updated' 
                                  ? 'bg-blue-50/40 dark:bg-blue-950/20' 
                                  : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {diff.type === 'new' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <PlusCircle size={10} /> Novo
                                </span>
                              )}
                              {diff.type === 'updated' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  <RefreshCw size={10} /> Atualizado
                                </span>
                              )}
                              {diff.type === 'unchanged' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                  <Check size={10} /> Sem alteração
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {diff.item.code}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                              {diff.item.name}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {diff.item.additionalCode}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {diff.item.manufacturer}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                              {diff.type === 'updated' && diff.oldItem && diff.oldItem.stock !== diff.item.stock ? (
                                <span className="flex items-center justify-end gap-1 text-blue-600 dark:text-blue-400">
                                  <span className="line-through text-slate-400 text-[10px]">
                                    {formatStock(diff.oldItem.stock)}
                                  </span>
                                  <ArrowRight size={10} />
                                  <span>{formatStock(diff.item.stock)}</span>
                                </span>
                              ) : (
                                <span className="text-slate-900 dark:text-white">
                                  {formatStock(diff.item.stock)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                              {diff.type === 'updated' && diff.oldItem && diff.oldItem.price !== diff.item.price ? (
                                <span className="flex items-center justify-end gap-1 text-blue-600 dark:text-blue-400">
                                  <span className="line-through text-slate-400 text-[10px]">
                                    {formatCurrency(diff.oldItem.price)}
                                  </span>
                                  <ArrowRight size={10} />
                                  <span>{formatCurrency(diff.item.price)}</span>
                                </span>
                              ) : (
                                <span className="text-slate-900 dark:text-white">
                                  {formatCurrency(diff.item.price)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls for Preview */}
                {filteredDiffs.length > pageSize && (
                  <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-slate-500 flex-wrap">
                    <span className="text-[11px]">
                      Exibindo <strong>{(currentPage - 1) * pageSize + 1}</strong> a <strong>{Math.min(currentPage * pageSize, filteredDiffs.length)}</strong> de <strong>{filteredDiffs.length}</strong> itens
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer"
                      >
                        «
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer"
                      >
                        Anterior
                      </button>
                      <span className="px-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer"
                      >
                        Próxima
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer"
                      >
                        »
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    onClick={handleReset}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-center"
                  >
                    Enviar Outro Arquivo PDF
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={onClose}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={handleApply}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 size={16} />
                      <span>Confirmar & Atualizar Catálogo ({stats.total} itens)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
