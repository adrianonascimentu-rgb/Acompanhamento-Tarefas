'use client';

import React, { useState, useEffect } from 'react';
import { Package, Search, Plus, Trash2, CheckCircle2, AlertCircle, Sparkles, X, Layers } from 'lucide-react';
import { CatalogProduct, findProductByCode, searchCatalogProducts, formatCurrency, formatStock } from '@/lib/catalogProducts';

export interface DeliveryItemRow {
  id: string;
  code: string;
  description: string;
  quantity: number | string;
  unitPrice?: number;
  stock?: number;
  manufacturer?: string;
  matchedFromCatalog?: boolean;
}

interface DeliveryProductItemsInputProps {
  isDarkMode: boolean;
  value: string; // The combined product string in formData.product
  onChange: (combinedProductText: string, calculatedTotalValue?: number) => void;
  onApplyTotalValue?: (total: number) => void;
}

// Helper to parse existing product text into item rows
export function parseProductTextToRows(text: string): DeliveryItemRow[] {
  if (!text || !text.trim()) {
    return [{
      id: 'item-1',
      code: '',
      description: '',
      quantity: 1,
      matchedFromCatalog: false
    }];
  }

  // Split by newline or bullet points
  const lines = text.split(/\n|•/).map(l => l.trim()).filter(Boolean);
  
  const parsedRows: DeliveryItemRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Try to extract code, description, quantity
    // Patterns:
    // "[Cód 353] CONCHA HOTEL (Qtd: 2)"
    // "[Cód: 353] CONCHA HOTEL - Qtd: 2"
    // "CONCHA HOTEL (Cód: 353, Qtd: 2)"
    // "2x CONCHA HOTEL (Cód: 353)"
    let code = '';
    let quantity: number | string = 1;
    let description = line;

    // Check for [Cód ...]
    const codeMatch = line.match(/\[C[oó]d:?\s*([^\]]+)\]/i) || line.match(/\(C[oó]d:?\s*([^\)]+)\)/i);
    if (codeMatch) {
      code = codeMatch[1].trim();
      description = description.replace(codeMatch[0], '').trim();
    }

    // Check for Qtd / Quantidade / Nx
    const qtdMatch = line.match(/Qtd:?\s*(\d+)/i) || line.match(/Quantidade:?\s*(\d+)/i) || line.match(/^(\d+)x\s+/i);
    if (qtdMatch) {
      quantity = parseInt(qtdMatch[1], 10) || 1;
      description = description.replace(qtdMatch[0], '').trim();
    }

    // Clean up trailing/leading dashes or parentheses
    description = description.replace(/^-\s*/, '').replace(/-\s*$/, '').replace(/^\(\s*/, '').replace(/\s*\)$/, '').trim();

    // Check if code matches catalog product to enrich details
    let unitPrice: number | undefined;
    let stock: number | undefined;
    let manufacturer: string | undefined;
    let matched = false;

    if (code) {
      const found = findProductByCode(code);
      if (found) {
        matched = true;
        unitPrice = found.price;
        stock = found.stock;
        manufacturer = found.manufacturer;
        if (!description) {
          description = found.name;
        }
      }
    }

    parsedRows.push({
      id: `item-${i + 1}-${Date.now()}`,
      code,
      description: description || line,
      quantity,
      unitPrice,
      stock,
      manufacturer,
      matchedFromCatalog: matched
    });
  }

  return parsedRows.length > 0 ? parsedRows : [{
    id: 'item-1',
    code: '',
    description: text,
    quantity: 1,
    matchedFromCatalog: false
  }];
}

// Helper to format rows back into combined string
export function formatRowsToProductText(rows: DeliveryItemRow[]): string {
  const validRows = rows.filter(r => r.description.trim() || r.code.trim());
  if (validRows.length === 0) return '';

  if (validRows.length === 1) {
    const r = validRows[0];
    const qty = Number(r.quantity) || 1;
    let text = '';
    if (r.code.trim()) {
      text += `[Cód ${r.code.trim()}] `;
    }
    text += r.description.trim() || 'Produto';
    if (qty > 1) {
      text += ` (Qtd: ${qty})`;
    }
    return text;
  }

  return validRows.map(r => {
    const qty = Number(r.quantity) || 1;
    let line = `• `;
    if (r.code.trim()) {
      line += `[Cód ${r.code.trim()}] `;
    }
    line += r.description.trim() || 'Produto';
    line += ` (Qtd: ${qty})`;
    return line;
  }).join('\n');
}

export function DeliveryProductItemsInput({
  isDarkMode,
  value,
  onChange,
  onApplyTotalValue
}: DeliveryProductItemsInputProps) {
  const [rows, setRows] = useState<DeliveryItemRow[]>(() => parseProductTextToRows(value));
  const [activeSearchRowIndex, setActiveSearchRowIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogProduct[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  // Sync rows when value changes externally (e.g. form reset or initial edit load)
  useEffect(() => {
    const formattedCurrent = formatRowsToProductText(rows);
    if (value !== formattedCurrent && (!value && rows.length === 1 && !rows[0].code && !rows[0].description)) {
      setRows(parseProductTextToRows(value));
    }
  }, [value]);

  const updateRowsAndNotify = (newRows: DeliveryItemRow[]) => {
    setRows(newRows);
    const combinedText = formatRowsToProductText(newRows);
    
    // Calculate estimated total value
    let totalEstimated = 0;
    let hasPrice = false;
    newRows.forEach(r => {
      if (r.unitPrice && r.unitPrice > 0) {
        const qty = typeof r.quantity === 'number' ? r.quantity : parseFloat(r.quantity) || 1;
        totalEstimated += r.unitPrice * qty;
        hasPrice = true;
      }
    });

    onChange(combinedText, hasPrice ? totalEstimated : undefined);
  };

  const handleCodeChange = (index: number, codeValue: string) => {
    const updated = [...rows];
    const row = { ...updated[index], code: codeValue };

    // Auto-lookup in Catalog database
    if (codeValue.trim()) {
      const found = findProductByCode(codeValue.trim());
      if (found) {
        row.description = found.name;
        row.unitPrice = found.price;
        row.stock = found.stock;
        row.manufacturer = found.manufacturer;
        row.matchedFromCatalog = true;
      } else {
        row.matchedFromCatalog = false;
        row.unitPrice = undefined;
        row.stock = undefined;
        row.manufacturer = undefined;
      }
    } else {
      row.matchedFromCatalog = false;
      row.unitPrice = undefined;
      row.stock = undefined;
      row.manufacturer = undefined;
    }

    updated[index] = row;
    updateRowsAndNotify(updated);
  };

  const handleSelectProduct = (index: number, prod: CatalogProduct) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      code: prod.code || prod.additionalCode || prod.id,
      description: prod.name,
      unitPrice: prod.price,
      stock: prod.stock,
      manufacturer: prod.manufacturer,
      matchedFromCatalog: true
    };
    updateRowsAndNotify(updated);
    setActiveSearchRowIndex(null);
    setIsCatalogModalOpen(false);
  };

  const handleDescriptionChange = (index: number, desc: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], description: desc };
    updateRowsAndNotify(updated);
  };

  const handleQuantityChange = (index: number, qty: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], quantity: qty };
    updateRowsAndNotify(updated);
  };

  const handleAddRow = () => {
    const newRow: DeliveryItemRow = {
      id: `item-${rows.length + 1}-${Date.now()}`,
      code: '',
      description: '',
      quantity: 1,
      matchedFromCatalog: false
    };
    updateRowsAndNotify([...rows, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      // Reset first row
      updateRowsAndNotify([{
        id: 'item-1',
        code: '',
        description: '',
        quantity: 1,
        matchedFromCatalog: false
      }]);
      return;
    }
    const updated = rows.filter((_, i) => i !== index);
    updateRowsAndNotify(updated);
  };

  // Live search for catalog search popup
  useEffect(() => {
    if (searchQuery.trim()) {
      setSearchResults(searchCatalogProducts(searchQuery, 12));
    } else {
      setSearchResults(searchCatalogProducts('', 12));
    }
  }, [searchQuery]);

  const totalCalculated = rows.reduce((acc, r) => {
    if (r.unitPrice && r.unitPrice > 0) {
      const q = typeof r.quantity === 'number' ? r.quantity : parseFloat(r.quantity) || 1;
      return acc + (r.unitPrice * q);
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-3 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-slate-900/60">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
            <Package size={15} />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-blue-950 dark:text-blue-200">
              Produtos & Itens da Entrega
            </label>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Informe o Código para preenchimento automático do Catálogo de Peças & Produtos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setIsCatalogModalOpen(true);
          }}
          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/70 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 transition-colors flex items-center gap-1 cursor-pointer"
          title="Pesquisar itens no Catálogo de Peças"
        >
          <Search size={12} />
          <span>Consultar Catálogo</span>
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div 
            key={row.id}
            className={`p-3 rounded-xl border transition-all ${
              row.matchedFromCatalog
                ? isDarkMode 
                  ? 'bg-slate-800/90 border-emerald-500/40 ring-1 ring-emerald-500/20' 
                  : 'bg-white border-emerald-300 ring-1 ring-emerald-200 shadow-xs'
                : isDarkMode 
                  ? 'bg-slate-800/70 border-slate-700' 
                  : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="size-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Item #{index + 1}
                </span>
              </div>

              {row.matchedFromCatalog ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                  Catálogo: {row.manufacturer || 'Localizado'}
                </span>
              ) : row.code.trim() ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                  <AlertCircle size={11} />
                  Cód manual
                </span>
              ) : null}
            </div>

            {/* Grid for Code, Description, Quantity */}
            <div className="grid grid-cols-12 gap-2">
              {/* Código */}
              <div className="col-span-12 sm:col-span-3">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Código
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: 353, 616"
                    value={row.code}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    className={`w-full h-10 px-3 text-xs font-mono font-bold rounded-lg border outline-none transition-all ${
                      row.matchedFromCatalog
                        ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                        : isDarkMode 
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                  {row.code && (
                    <button
                      type="button"
                      onClick={() => handleCodeChange(index, '')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Descrição */}
              <div className="col-span-12 sm:col-span-6">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Descrição do Produto <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="Nome/detalhes da peça ou produto"
                  value={row.description}
                  onChange={(e) => handleDescriptionChange(index, e.target.value)}
                  className={`w-full h-10 px-3 text-xs font-semibold rounded-lg border outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Quantidade */}
              <div className="col-span-8 sm:col-span-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Qtd
                </label>
                <input
                  required
                  type="number"
                  min="0.1"
                  step="any"
                  placeholder="1"
                  value={row.quantity}
                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                  className={`w-full h-10 px-3 text-xs font-bold text-center rounded-lg border outline-none transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Action / Delete */}
              <div className="col-span-4 sm:col-span-1 flex items-end justify-center pb-0.5">
                <button
                  type="button"
                  onClick={() => handleRemoveRow(index)}
                  disabled={rows.length === 1 && !row.code && !row.description}
                  className="h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40"
                  title="Remover produto"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Extra Info when found in Catalog */}
            {row.matchedFromCatalog && (
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                  {row.stock !== undefined && (
                    <span>Estoque: <strong className={row.stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>{formatStock(row.stock)} un</strong></span>
                  )}
                  {row.unitPrice !== undefined && row.unitPrice > 0 && (
                    <span>Preço Unitário: <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(row.unitPrice)}</strong></span>
                  )}
                </div>

                {row.unitPrice && row.unitPrice > 0 && (
                  <div className="font-bold text-blue-700 dark:text-blue-300">
                    Subtotal: {formatCurrency(row.unitPrice * (typeof row.quantity === 'number' ? row.quantity : parseFloat(row.quantity) || 1))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Controls: Add Row + Total summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleAddRow}
          className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <Plus size={14} />
          <span>Adicionar outro Produto</span>
        </button>

        {totalCalculated > 0 && onApplyTotalValue && (
          <button
            type="button"
            onClick={() => onApplyTotalValue(totalCalculated)}
            className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Preencher campo Valor da Venda com a soma dos itens"
          >
            <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span>Usar Total: {formatCurrency(totalCalculated)}</span>
          </button>
        )}
      </div>

      {/* Catalog Search & Select Modal */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className={`relative w-full max-w-xl rounded-3xl p-5 shadow-2xl border max-h-[85vh] flex flex-col ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                  <Layers size={18} />
                </div>
                <div>
                  <h4 className="text-base font-bold">Catálogo de Peças & Produtos</h4>
                  <p className="text-xs text-slate-500">Selecione um produto para inserir automaticamente na entrega</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                autoFocus
                placeholder="Buscar por código, nome da peça ou fabricante..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-11 pl-10 pr-4 rounded-xl border outline-none text-sm font-medium ${
                  isDarkMode 
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-400' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                }`}
              />
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {searchResults.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhum produto encontrado com "{searchQuery}".
                </div>
              ) : (
                searchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      // Add to the first empty row or append
                      const emptyIndex = rows.findIndex(r => !r.code && !r.description);
                      if (emptyIndex !== -1) {
                        handleSelectProduct(emptyIndex, p);
                      } else {
                        const newRow: DeliveryItemRow = {
                          id: `item-${rows.length + 1}-${Date.now()}`,
                          code: p.code || p.additionalCode || p.id,
                          description: p.name,
                          quantity: 1,
                          unitPrice: p.price,
                          stock: p.stock,
                          manufacturer: p.manufacturer,
                          matchedFromCatalog: true
                        };
                        updateRowsAndNotify([...rows, newRow]);
                        setIsCatalogModalOpen(false);
                      }
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isDarkMode 
                        ? 'bg-slate-800/80 border-slate-700 hover:border-blue-500 hover:bg-slate-800' 
                        : 'bg-slate-50 hover:bg-blue-50/60 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[11px] font-bold">
                          Cód: {p.code}
                        </span>
                        {p.manufacturer && (
                          <span className="text-[10px] font-bold text-slate-500">
                            {p.manufacturer}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold truncate mt-1 text-slate-800 dark:text-slate-100">
                        {p.name}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.price)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Estoque: {formatStock(p.stock)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
