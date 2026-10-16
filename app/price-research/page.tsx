'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Tag, Search, Trash2, RefreshCw, PlusCircle, Store, Calendar, DollarSign, Package, Filter, SlidersHorizontal, RotateCcw, X } from 'lucide-react';
import PriceResearchForm from '@/components/PriceResearchForm';
import PriceEvolutionChart from '@/components/PriceEvolutionChart';

interface PriceResearchItem {
  id: string;
  created_at: string;
  product_code: string | null;
  product_name: string | null;
  full_price: number | null;
  cash_price: number | null;
  store_name: string | null;
}

export default function PriceResearchPage() {
  const [items, setItems] = useState<PriceResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estados dos Filtros Avançados
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState('ALL');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);

  // Estados para Destaque Interativo pela Legenda na Tabela
  const [legendHighlight, setLegendHighlight] = useState<'all' | 'min' | 'max' | 'regular'>('all');
  const [hoveredLegend, setHoveredLegend] = useState<'min' | 'max' | 'regular' | null>(null);
  const [focusedProductCode, setFocusedProductCode] = useState<string | null>(null);
  const [hoveredProductCode, setHoveredProductCode] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/competitor-prices');
      const json = await res.json();
      if (res.ok && json.data) {
        setItems(json.data);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico de preços:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta pesquisa de preço?')) return;
    setDeletingId(id);
    try {
      // Tenta passar o ID tanto na query quanto no body para máxima compatibilidade
      const res = await fetch(`/api/competitor-prices?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      
      const json = await res.json().catch(() => ({}));
      
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
      } else {
        console.error('Erro ao excluir item:', json);
        const errorMsg = json.error || json.message || res.statusText;
        alert(`Não foi possível excluir: ${errorMsg}\n\nVerifique se você tem permissão ou se a tabela foi criada corretamente.`);
      }
    } catch (err: any) {
      console.error('Erro ao se comunicar com o servidor:', err);
      alert('Erro de conexão: ' + (err?.message || 'O servidor não respondeu.'));
    } finally {
      setDeletingId(null);
    }
  };

  // Lista única de lojas para o filtro
  const uniqueStores = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.store_name) set.add(i.store_name);
    });
    return Array.from(set).sort();
  }, [items]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedStoreFilter('ALL');
    setMinPrice('');
    setMaxPrice('');
  };

  const hasActiveFilters = Boolean(
    searchQuery || startDate || endDate || (selectedStoreFilter && selectedStoreFilter !== 'ALL') || minPrice || maxPrice
  );

  // Calcular Menor e Maior Preço por produto em janela de 15 dias baseado no Código do Produto
  const getItemPriceExtremes15Days = useCallback(
    (targetItem: PriceResearchItem) => {
      const codeKey = (targetItem.product_code || targetItem.product_name || 'SEM_CODIGO')
        .trim()
        .toLowerCase();

      if (!codeKey) {
        return { isMinCash: false, isMaxCash: false, isMinFull: false, isMaxFull: false };
      }

      const targetTime = new Date(targetItem.created_at).getTime();
      const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

      // Filtrar amostras do mesmo código de produto dentro da janela de 15 dias (antes ou depois)
      const windowItems = items.filter(other => {
        const otherCodeKey = (other.product_code || other.product_name || 'SEM_CODIGO')
          .trim()
          .toLowerCase();

        if (otherCodeKey !== codeKey) return false;

        const otherTime = new Date(other.created_at).getTime();
        return Math.abs(targetTime - otherTime) <= FIFTEEN_DAYS_MS;
      });

      // Extrair preços de caixa (à vista) e cheios na janela
      const cashPrices = windowItems
        .map(i => (i.cash_price !== null && i.cash_price !== undefined ? Number(i.cash_price) : null))
        .filter((v): v is number => v !== null);

      const fullPrices = windowItems
        .map(i => (i.full_price !== null && i.full_price !== undefined ? Number(i.full_price) : null))
        .filter((v): v is number => v !== null);

      // Avaliação Preço À Vista
      let isMinCash = false;
      let isMaxCash = false;
      if (cashPrices.length > 1 && targetItem.cash_price !== null && targetItem.cash_price !== undefined) {
        const val = Number(targetItem.cash_price);
        const minCash = Math.min(...cashPrices);
        const maxCash = Math.max(...cashPrices);
        if (minCash < maxCash) {
          if (val === minCash) isMinCash = true;
          else if (val === maxCash) isMaxCash = true;
        }
      }

      // Avaliação Preço Cheio
      let isMinFull = false;
      let isMaxFull = false;
      if (fullPrices.length > 1 && targetItem.full_price !== null && targetItem.full_price !== undefined) {
        const val = Number(targetItem.full_price);
        const minFull = Math.min(...fullPrices);
        const maxFull = Math.max(...fullPrices);
        if (minFull < maxFull) {
          if (val === minFull) isMinFull = true;
          else if (val === maxFull) isMaxFull = true;
        }
      }

      return { isMinCash, isMaxCash, isMinFull, isMaxFull };
    },
    [items]
  );

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Busca por texto
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = (item.product_name || '').toLowerCase().includes(q);
        const matchCode = (item.product_code || '').toLowerCase().includes(q);
        const matchStore = (item.store_name || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchStore) return false;
      }

      // 2. Intervalo de Datas
      if (startDate) {
        const itemDate = new Date(item.created_at);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) return false;
      }

      if (endDate) {
        const itemDate = new Date(item.created_at);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }

      // 3. Nome da Loja
      if (selectedStoreFilter && selectedStoreFilter !== 'ALL') {
        if ((item.store_name || '').toLowerCase() !== selectedStoreFilter.toLowerCase()) {
          return false;
        }
      }

      // 4. Faixa de Preço (verifica preço à vista ou preço cheio)
      const priceVal = item.cash_price !== null && item.cash_price !== undefined
        ? item.cash_price
        : item.full_price;

      if (minPrice !== '' && !isNaN(Number(minPrice))) {
        if (priceVal === null || priceVal < Number(minPrice)) return false;
      }

      if (maxPrice !== '' && !isNaN(Number(maxPrice))) {
        if (priceVal === null || priceVal > Number(maxPrice)) return false;
      }

      return true;
    });
  }, [items, searchQuery, startDate, endDate, selectedStoreFilter, minPrice, maxPrice]);

  // Contadores dinâmicos para a legenda interativa
  const legendCounts = useMemo(() => {
    let minCount = 0;
    let maxCount = 0;
    let regularCount = 0;
    filteredItems.forEach(item => {
      if (focusedProductCode) {
        const code = (item.product_code || item.product_name || 'SEM_CODIGO').trim().toLowerCase();
        if (code !== focusedProductCode.toLowerCase()) return;
      }
      const { isMinCash, isMaxCash, isMinFull, isMaxFull } = getItemPriceExtremes15Days(item);
      if (isMinCash || isMinFull) minCount++;
      if (isMaxCash || isMaxFull) maxCount++;
      if (!isMinCash && !isMaxCash && !isMinFull && !isMaxFull) regularCount++;
    });
    return { minCount, maxCount, regularCount };
  }, [filteredItems, getItemPriceExtremes15Days, focusedProductCode]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Voltar ao Painel"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h1 className="text-xl font-extrabold tracking-tight">Pesquisa de Preços de Concorrentes</h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Registre e acompanhe preços praticados por concorrentes no mercado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              {showForm ? 'Ocultar Formulário' : 'Nova Pesquisa'}
            </button>

            <button
              onClick={fetchItems}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
              title="Atualizar Dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Form Section */}
        {showForm && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <PriceResearchForm onSuccess={fetchItems} />
          </div>
        )}

        {/* History Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6">
          {/* Data Visualization Chart (Recharts) directly at the top of history section */}
          <PriceEvolutionChart 
            items={filteredItems} 
            title="Variação de Preços por Produto ao Longo do Tempo"
            subtitle="Gráfico com a evolução histórica de preços para os produtos filtrados"
          />

          {/* Painel de Filtros Avançados */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Filtros Avançados de Pesquisa
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/50 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Limpar Filtros
                  </button>
                )}
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  {showAdvancedFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                </button>
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* Intervalo de Datas */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-500" />
                    Intervalo de Datas
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      title="Data Inicial"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      title="Data Final"
                    />
                  </div>
                </div>

                {/* Loja / Concorrente */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Store className="w-3 h-3 text-emerald-500" />
                    Loja Concorrente
                  </label>
                  <select
                    value={selectedStoreFilter}
                    onChange={e => setSelectedStoreFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">Todas as Lojas</option>
                    {uniqueStores.map(store => (
                      <option key={store} value={store}>
                        {store}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Faixa de Preço */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-amber-500" />
                    Faixa de Preço (R$)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={e => setMinPrice(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={e => setMaxPrice(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Busca Rápida por Nome/Código */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Search className="w-3 h-3 text-blue-500" />
                    Produto ou Código
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Nome do produto ou código..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <Store className="w-4 h-4 text-slate-500" />
                Histórico de Pesquisas Registradas ({filteredItems.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {hasActiveFilters ? 'Exibindo pesquisas filtradas pelo painel acima.' : 'Últimas pesquisas enviadas pela equipe comercial.'}
              </p>
            </div>

            {/* Legenda Interativa Clicável e com Hover (Janela de 15 dias) */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold mr-1">
                Destacar (clique ou passe o mouse):
              </span>

              {/* Botão Menor Preço */}
              <button
                type="button"
                onMouseEnter={() => setHoveredLegend('min')}
                onMouseLeave={() => setHoveredLegend(null)}
                onClick={() => setLegendHighlight(prev => prev === 'min' ? 'all' : 'min')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer select-none ${
                  (hoveredLegend === 'min' || legendHighlight === 'min')
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-400/50 scale-[1.03]'
                    : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                }`}
                title="Passe o mouse ou clique para destacar todas as linhas com Menor Preço"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"></span>
                <span>Menor Preço</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  (hoveredLegend === 'min' || legendHighlight === 'min')
                    ? 'bg-emerald-800 text-white'
                    : 'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                }`}>
                  {legendCounts.minCount}
                </span>
              </button>

              {/* Botão Maior Preço */}
              <button
                type="button"
                onMouseEnter={() => setHoveredLegend('max')}
                onMouseLeave={() => setHoveredLegend(null)}
                onClick={() => setLegendHighlight(prev => prev === 'max' ? 'all' : 'max')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer select-none ${
                  (hoveredLegend === 'max' || legendHighlight === 'max')
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-400/50 scale-[1.03]'
                    : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                }`}
                title="Passe o mouse ou clique para destacar todas as linhas com Maior Preço"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900"></span>
                <span>Maior Preço</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  (hoveredLegend === 'max' || legendHighlight === 'max')
                    ? 'bg-rose-800 text-white'
                    : 'bg-rose-200/70 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                }`}>
                  {legendCounts.maxCount}
                </span>
              </button>

              {/* Botão Preço Regular */}
              <button
                type="button"
                onMouseEnter={() => setHoveredLegend('regular')}
                onMouseLeave={() => setHoveredLegend(null)}
                onClick={() => setLegendHighlight(prev => prev === 'regular' ? 'all' : 'regular')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer select-none ${
                  (hoveredLegend === 'regular' || legendHighlight === 'regular')
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 shadow-sm ring-2 ring-slate-400/50 scale-[1.03]'
                    : 'text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Passe o mouse ou clique para destacar todas as linhas de Preço Regular"
              >
                <span className="w-2 h-2 rounded-full bg-slate-800 dark:bg-slate-200"></span>
                <span>Regular</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  (hoveredLegend === 'regular' || legendHighlight === 'regular')
                    ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {legendCounts.regularCount}
                </span>
              </button>

              {/* Tag informativa de Foco por Item */}
              {focusedProductCode && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                  <span>Item: {focusedProductCode}</span>
                  <button
                    onClick={() => setFocusedProductCode(null)}
                    className="p-0.5 hover:bg-blue-200/50 dark:hover:bg-blue-800/50 rounded"
                    title="Remover foco do item"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Botão de Limpar Destaques */}
              {(legendHighlight !== 'all' || focusedProductCode) && (
                <button
                  onClick={() => {
                    setLegendHighlight('all');
                    setFocusedProductCode(null);
                  }}
                  className="px-2 py-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline ml-1 cursor-pointer"
                >
                  Limpar Destaque
                </button>
              )}
            </div>
          </div>

          {/* Table / List */}
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              Carregando pesquisas gravadas...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              {searchQuery ? 'Nenhuma pesquisa encontrada com este filtro.' : 'Nenhuma pesquisa de preço registrada ainda.'}
            </div>
          ) : (
            <div className="overflow-x-auto price-research-history-table">
              <table className="w-full text-left text-xs price-research-history-table">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3 px-2">Data/Hora</th>
                    <th className="pb-3 px-2">Código</th>
                    <th className="pb-3 px-2">Produto</th>
                    <th className="pb-3 px-2 text-right">Preço Cheio</th>
                    <th className="pb-3 px-2 text-right">Preço À Vista</th>
                    <th className="pb-3 px-2">Loja Concorrente</th>
                    <th className="pb-3 px-2 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredItems.map(item => {
                    const { isMinCash, isMaxCash, isMinFull, isMaxFull } = getItemPriceExtremes15Days(item);

                    // Identificador para agrupar o item específico
                    const itemCode = (item.product_code || item.product_name || 'SEM_CODIGO').trim();
                    const activeType = hoveredLegend || (legendHighlight !== 'all' ? legendHighlight : null);
                    const currentFocused = hoveredProductCode || focusedProductCode;

                    const isProductMatch = !currentFocused || itemCode.toLowerCase() === currentFocused.toLowerCase();
                    const isMinRow = isMinCash || isMinFull;
                    const isMaxRow = isMaxCash || isMaxFull;
                    const isRegularRow = !isMinRow && !isMaxRow;

                    // Avaliação de destaque
                    let isHighlighted = false;
                    let isDimmed = false;

                    if (activeType) {
                      const matchesType = activeType === 'min' ? isMinRow : activeType === 'max' ? isMaxRow : isRegularRow;
                      if (matchesType && isProductMatch) {
                        isHighlighted = true;
                      } else {
                        isDimmed = true;
                      }
                    } else if (currentFocused) {
                      if (isProductMatch) {
                        isHighlighted = true;
                      } else {
                        isDimmed = true;
                      }
                    }

                    return (
                      <tr
                        key={item.id}
                        onMouseEnter={() => setHoveredProductCode(itemCode)}
                        onMouseLeave={() => setHoveredProductCode(null)}
                        onClick={() => setFocusedProductCode(prev => prev === itemCode ? null : itemCode)}
                        className={`transition-all duration-200 cursor-pointer select-none ${
                          isHighlighted
                            ? isMinRow
                              ? 'bg-emerald-500/15 dark:bg-emerald-950/60 ring-2 ring-emerald-500/70 border-l-4 border-l-emerald-600 shadow-xs z-10 relative font-semibold'
                              : isMaxRow
                              ? 'bg-rose-500/15 dark:bg-rose-950/60 ring-2 ring-rose-500/70 border-l-4 border-l-rose-600 shadow-xs z-10 relative font-semibold'
                              : 'bg-blue-500/10 dark:bg-blue-950/40 ring-2 ring-blue-500/50 border-l-4 border-l-blue-600 shadow-xs z-10 relative font-semibold'
                            : isDimmed
                            ? 'opacity-25 dark:opacity-20 filter grayscale-[40%]'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        }`}
                        title={
                          focusedProductCode === itemCode
                            ? `Item "${itemCode}" fixado! Clique para liberar o foco.`
                            : `Passe o mouse ou clique nesta linha para destacar o menor/maior preço do item "${itemCode}".`
                        }
                      >
                        <td className="py-3 px-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(item.created_at).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </div>
                        </td>

                        <td className="py-3 px-2 font-mono text-slate-900 dark:text-slate-100 font-medium">
                          {item.product_code ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 font-bold border border-slate-200 dark:border-slate-700">
                              {item.product_code}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>

                        <td className="py-3 px-2 font-medium text-slate-900 dark:text-slate-100">
                          {item.product_name || <span className="text-slate-400 italic">Não informado</span>}
                        </td>

                        {/* Preço Cheio: Verde (Menor), Vermelho (Maior), Preto (Regular) */}
                        <td className="py-3 px-2 text-right">
                          {item.full_price !== null && item.full_price !== undefined ? (
                            <span className={`inline-flex items-center gap-1 ${
                              isMinFull
                                ? 'text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 shadow-2xs'
                                : isMaxFull
                                ? 'text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800/80 shadow-2xs'
                                : 'text-slate-900 dark:text-slate-100 font-medium'
                            }`}>
                              R$ {Number(item.full_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              {isMinFull && (
                                <span className="text-[9px] bg-emerald-600 text-white px-1 py-0.2 rounded font-extrabold uppercase tracking-wider">Menor</span>
                              )}
                              {isMaxFull && (
                                <span className="text-[9px] bg-rose-600 text-white px-1 py-0.2 rounded font-extrabold uppercase tracking-wider">Maior</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic">-</span>
                          )}
                        </td>

                        {/* Preço à Vista: Verde (Menor), Vermelho (Maior), Preto (Regular) */}
                        <td className="py-3 px-2 text-right">
                          {item.cash_price !== null && item.cash_price !== undefined ? (
                            <span className={`inline-flex items-center gap-1 ${
                              isMinCash
                                ? 'text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 shadow-2xs'
                                : isMaxCash
                                ? 'text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800/80 shadow-2xs'
                                : 'text-slate-900 dark:text-slate-100 font-medium'
                            }`}>
                              R$ {Number(item.cash_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              {isMinCash && (
                                <span className="text-[9px] bg-emerald-600 text-white px-1 py-0.2 rounded font-extrabold uppercase tracking-wider">Menor</span>
                              )}
                              {isMaxCash && (
                                <span className="text-[9px] bg-rose-600 text-white px-1 py-0.2 rounded font-extrabold uppercase tracking-wider">Maior</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic">-</span>
                          )}
                        </td>

                        <td className="py-3 px-2 font-medium text-slate-700 dark:text-slate-300">
                          {item.store_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              <Store className="w-3 h-3 text-slate-400" />
                              {item.store_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>

                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                            disabled={deletingId === item.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
