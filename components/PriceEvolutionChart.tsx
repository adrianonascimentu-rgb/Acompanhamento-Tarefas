'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { TrendingUp, Store, Filter, BarChart2, Tag, CalendarDays, DollarSign, Activity } from 'lucide-react';

export interface PriceResearchItem {
  id: string;
  created_at: string;
  product_code: string | null;
  product_name: string | null;
  full_price: number | null;
  cash_price: number | null;
  store_name: string | null;
}

interface PriceEvolutionChartProps {
  items: PriceResearchItem[];
  title?: string;
  subtitle?: string;
}

export default function PriceEvolutionChart({
  items,
  title = 'Evolução Média de Preços dos Produtos',
  subtitle = 'Acompanhamento temporal da variação do Preço Cheio e Preço à Vista',
}: PriceEvolutionChartProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [groupByDay, setGroupByDay] = useState<boolean>(true);
  const [chartType, setChartType] = useState<'line' | 'area' | 'scatter'>('line');

  // Extrair lista única de produtos para o filtro
  const uniqueProducts = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const label = item.product_name || item.product_code || 'Sem Nome';
      set.add(label);
    });
    return Array.from(set).sort();
  }, [items]);

  // Extrair lista única de lojas concorrentes para o filtro
  const uniqueStores = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.store_name) set.add(item.store_name);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtrar dados brutos por produto e loja selecionados
  const filteredData = useMemo(() => {
    return items.filter((item) => {
      const prodLabel = item.product_name || item.product_code || 'Sem Nome';
      const matchProd = selectedProduct === 'ALL' || prodLabel === selectedProduct;
      const matchStore = selectedStore === 'ALL' || item.store_name === selectedStore;
      return matchProd && matchStore;
    });
  }, [items, selectedProduct, selectedStore]);

  // Processar e agrupar dados cronologicamente para o gráfico de linhas Recharts
  const chartData = useMemo(() => {
    const sorted = [...filteredData].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    if (!groupByDay) {
      return sorted.map((item) => {
        const dateObj = new Date(item.created_at);
        const formattedDate = dateObj.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });

        const exactDateFormatted = dateObj.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return {
          id: item.id,
          dateLabel: formattedDate,
          exactDate: exactDateFormatted,
          fullPrice: item.full_price ? Number(item.full_price) : null,
          cashPrice: item.cash_price ? Number(item.cash_price) : null,
          product: item.product_name || item.product_code || 'Produto',
          store: item.store_name || 'Concorrente',
          count: 1,
        };
      });
    }

    // Agrupamento por dia (YYYY-MM-DD) para calcular a média de preços do dia
    const groupedMap = new Map<
      string,
      {
        dayKey: string;
        dateLabel: string;
        fullPriceSum: number;
        fullPriceCount: number;
        cashPriceSum: number;
        cashPriceCount: number;
        stores: Set<string>;
        products: Set<string>;
      }
    >();

    sorted.forEach((item) => {
      const dateObj = new Date(item.created_at);
      const dayKey = dateObj.toISOString().split('T')[0];
      const dateLabel = dateObj.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });

      if (!groupedMap.has(dayKey)) {
        groupedMap.set(dayKey, {
          dayKey,
          dateLabel,
          fullPriceSum: 0,
          fullPriceCount: 0,
          cashPriceSum: 0,
          cashPriceCount: 0,
          stores: new Set(),
          products: new Set(),
        });
      }

      const grp = groupedMap.get(dayKey)!;

      if (item.full_price !== null && item.full_price !== undefined) {
        grp.fullPriceSum += Number(item.full_price);
        grp.fullPriceCount += 1;
      }

      if (item.cash_price !== null && item.cash_price !== undefined) {
        grp.cashPriceSum += Number(item.cash_price);
        grp.cashPriceCount += 1;
      }

      if (item.store_name) grp.stores.add(item.store_name);
      const prodName = item.product_name || item.product_code;
      if (prodName) grp.products.add(prodName);
    });

    return Array.from(groupedMap.values()).map((grp) => ({
      id: grp.dayKey,
      dateLabel: grp.dateLabel,
      fullPrice: grp.fullPriceCount > 0 ? Number((grp.fullPriceSum / grp.fullPriceCount).toFixed(2)) : null,
      cashPrice: grp.cashPriceCount > 0 ? Number((grp.cashPriceSum / grp.cashPriceCount).toFixed(2)) : null,
      product: Array.from(grp.products).join(', ') || 'Produto',
      store: Array.from(grp.stores).join(', ') || 'Várias Lojas',
      count: Math.max(grp.fullPriceCount, grp.cashPriceCount),
    }));
  }, [filteredData, groupByDay]);

  // Cálculo de Regressão Linear (Linha de Tendência) e Volatilidade (Desvio Padrão)
  const volatilityAnalytics = useMemo(() => {
    if (chartData.length < 2) {
      return {
        trendlineData: chartData.map(d => ({ ...d, fullTrend: d.fullPrice, cashTrend: d.cashPrice })),
        stdDevCash: 0,
        stdDevFull: 0,
        cashSlope: 0,
        fullSlope: 0,
      };
    }

    // Regressão para Preço à Vista
    const cashPoints = chartData
      .map((d, index) => ({ x: index, y: d.cashPrice }))
      .filter((p): p is { x: number; y: number } => p.y !== null);

    let cashSlope = 0;
    let cashIntercept = 0;
    if (cashPoints.length >= 2) {
      const n = cashPoints.length;
      const sumX = cashPoints.reduce((acc, p) => acc + p.x, 0);
      const sumY = cashPoints.reduce((acc, p) => acc + p.y, 0);
      const sumXY = cashPoints.reduce((acc, p) => acc + p.x * p.y, 0);
      const sumXX = cashPoints.reduce((acc, p) => acc + p.x * p.x, 0);

      const denom = n * sumXX - sumX * sumX;
      cashSlope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      cashIntercept = (sumY - cashSlope * sumX) / n;
    }

    // Regressão para Preço Cheio
    const fullPoints = chartData
      .map((d, index) => ({ x: index, y: d.fullPrice }))
      .filter((p): p is { x: number; y: number } => p.y !== null);

    let fullSlope = 0;
    let fullIntercept = 0;
    if (fullPoints.length >= 2) {
      const n = fullPoints.length;
      const sumX = fullPoints.reduce((acc, p) => acc + p.x, 0);
      const sumY = fullPoints.reduce((acc, p) => acc + p.y, 0);
      const sumXY = fullPoints.reduce((acc, p) => acc + p.x * p.y, 0);
      const sumXX = fullPoints.reduce((acc, p) => acc + p.x * p.x, 0);

      const denom = n * sumXX - sumX * sumX;
      fullSlope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      fullIntercept = (sumY - fullSlope * sumX) / n;
    }

    // Cálculo do Desvio Padrão (Volatilidade)
    const cashVals = cashPoints.map(p => p.y);
    const avgCash = cashVals.length ? cashVals.reduce((a, b) => a + b, 0) / cashVals.length : 0;
    const stdDevCash = cashVals.length
      ? Math.sqrt(cashVals.reduce((sq, n) => sq + Math.pow(n - avgCash, 2), 0) / cashVals.length)
      : 0;

    const fullVals = fullPoints.map(p => p.y);
    const avgFull = fullVals.length ? fullVals.reduce((a, b) => a + b, 0) / fullVals.length : 0;
    const stdDevFull = fullVals.length
      ? Math.sqrt(fullVals.reduce((sq, n) => sq + Math.pow(n - avgFull, 2), 0) / fullVals.length)
      : 0;

    const trendlineData = chartData.map((d, idx) => ({
      ...d,
      cashTrend: cashPoints.length >= 2 ? Number((cashSlope * idx + cashIntercept).toFixed(2)) : d.cashPrice,
      fullTrend: fullPoints.length >= 2 ? Number((fullSlope * idx + fullIntercept).toFixed(2)) : d.fullPrice,
    }));

    return { trendlineData, stdDevCash, stdDevFull, cashSlope, fullSlope };
  }, [chartData]);

  // Estatísticas do período
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { avgFull: 0, avgCash: 0, maxDiscount: 0, count: 0 };
    }

    let sumFull = 0;
    let countFull = 0;
    let sumCash = 0;
    let countCash = 0;
    let maxDisc = 0;

    chartData.forEach((d) => {
      if (d.fullPrice !== null) {
        sumFull += d.fullPrice;
        countFull++;
      }
      if (d.cashPrice !== null) {
        sumCash += d.cashPrice;
        countCash++;
      }
      if (d.fullPrice && d.cashPrice && d.fullPrice > 0) {
        const disc = ((d.fullPrice - d.cashPrice) / d.fullPrice) * 100;
        if (disc > maxDisc) maxDisc = disc;
      }
    });

    return {
      avgFull: countFull > 0 ? sumFull / countFull : 0,
      avgCash: countCash > 0 ? sumCash / countCash : 0,
      maxDiscount: maxDisc,
      count: chartData.length,
    };
  }, [chartData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-slate-100 p-4 rounded-xl shadow-2xl text-xs space-y-2.5 min-w-[240px] z-50">
          {/* Header: Exact Date & Time */}
          <div className="font-bold border-b border-slate-800 pb-2 text-slate-200 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-blue-400">
              <CalendarDays className="w-4 h-4 shrink-0 text-blue-400" />
              Data Exata: {data.exactDate || data.dateLabel}
            </span>
            {data.count > 1 && (
              <span className="text-[10px] text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800/60 font-semibold">
                {data.count} pesquisas
              </span>
            )}
          </div>

          {/* Store Name Badge */}
          <div className="flex items-center gap-2 bg-slate-800/70 p-2 rounded-lg border border-slate-700/50">
            <Store className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="overflow-hidden">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Loja / Concorrente</span>
              <span className="font-bold text-slate-100 text-xs truncate block">{data.store || 'Não informada'}</span>
            </div>
          </div>

          {/* Product Name */}
          {data.product && (
            <div className="flex items-center gap-2 px-1">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-300 truncate">{data.product}</span>
            </div>
          )}

          {/* Prices Breakdown */}
          <div className="pt-2 space-y-1.5 font-semibold border-t border-slate-800/80">
            <div className="flex justify-between items-center text-blue-400 bg-blue-950/30 px-2 py-1 rounded-md">
              <span className="text-slate-300 font-medium">Preço Cheio:</span>
              <span className="font-bold text-blue-400">
                {data.fullPrice !== null ? `R$ ${data.fullPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded-md">
              <span className="text-slate-300 font-medium">Preço à Vista:</span>
              <span className="font-bold text-emerald-400">
                {data.cashPrice !== null ? `R$ ${data.cashPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
              </span>
            </div>
            {data.fullPrice && data.cashPrice && data.fullPrice > data.cashPrice && (
              <div className="text-[10px] text-emerald-400 text-right font-medium pr-1">
                Economia: R$ {(data.fullPrice - data.cashPrice).toFixed(2)} ({(((data.fullPrice - data.cashPrice) / data.fullPrice) * 100).toFixed(1)}% desc.)
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Product Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[160px] truncate"
            >
              <option value="ALL">Todos os Produtos</option>
              {uniqueProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Store Filter */}
          {uniqueStores.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="ALL">Todas as Lojas</option>
                {uniqueStores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group By Day Toggle */}
          <button
            onClick={() => setGroupByDay(!groupByDay)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              groupByDay
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
            title="Agrupar médias de preço por dia"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {groupByDay ? 'Média Diária' : 'Individual'}
          </button>

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setChartType('line')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                chartType === 'line'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Linha
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                chartType === 'area'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Área
            </button>
            <button
              onClick={() => setChartType('scatter')}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                chartType === 'scatter'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Activity className="w-3 h-3" />
              Dispersão & Tendência
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-blue-500" />
            Média Preço Cheio
          </span>
          <span className="text-sm sm:text-base font-extrabold text-blue-600 dark:text-blue-400">
            R$ {stats.avgFull.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-500" />
            Média Preço à Vista
          </span>
          <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400">
            R$ {stats.avgCash.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Maior Desconto
          </span>
          <span className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400">
            {stats.maxDiscount.toFixed(1)}%
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3 text-indigo-500" />
            Volatilidade (σ)
          </span>
          <span className="text-sm sm:text-base font-extrabold text-indigo-600 dark:text-indigo-400">
            ± R$ {volatilityAnalytics.stdDevCash.toFixed(2)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            {groupByDay ? 'Pontos no Tempo' : 'Total Amostras'}
          </span>
          <span className="text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-300">
            {stats.count}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full pt-2">
        {chartData.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs gap-2">
            <BarChart2 className="w-8 h-8 text-slate-300 dark:text-slate-700" />
            <span>Nenhum registro de preço disponível para os filtros selecionados.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) => (
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {value === 'fullPrice' ? 'Média Preço Cheio' : 'Média Preço à Vista'}
                    </span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="fullPrice"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#3b82f6' }}
                  activeDot={{ r: 6 }}
                  name="fullPrice"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="cashPrice"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981' }}
                  activeDot={{ r: 6 }}
                  name="cashPrice"
                  connectNulls
                />
              </LineChart>
            ) : chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="fullPriceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="cashPriceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) => (
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {value === 'fullPrice' ? 'Média Preço Cheio' : 'Média Preço à Vista'}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="fullPrice"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#fullPriceGrad)"
                  name="fullPrice"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="cashPrice"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#cashPriceGrad)"
                  name="cashPrice"
                  connectNulls
                />
              </AreaChart>
            ) : (
              /* Gráfico de Dispersão (Scatter) com Linha de Tendência de Regressão Linear */
              <ComposedChart data={volatilityAnalytics.trendlineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                <ZAxis type="number" range={[50, 150]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) => {
                    if (value === 'fullPrice') return <span className="text-blue-500 font-semibold">Amostras Preço Cheio</span>;
                    if (value === 'cashPrice') return <span className="text-emerald-500 font-semibold">Amostras Preço à Vista</span>;
                    if (value === 'fullTrend') return <span className="text-blue-400 dark:text-blue-300 font-medium italic">Tendência Preço Cheio</span>;
                    if (value === 'cashTrend') return <span className="text-emerald-400 dark:text-emerald-300 font-medium italic">Tendência Preço à Vista</span>;
                    return value;
                  }}
                />
                {/* Pontos de Dispersão */}
                <Scatter
                  name="fullPrice"
                  dataKey="fullPrice"
                  fill="#3b82f6"
                  opacity={0.85}
                />
                <Scatter
                  name="cashPrice"
                  dataKey="cashPrice"
                  fill="#10b981"
                  opacity={0.85}
                />
                {/* Linhas de Tendência (Regressão Linear) */}
                <Line
                  type="monotone"
                  dataKey="fullTrend"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={false}
                  name="fullTrend"
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cashTrend"
                  stroke="#059669"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={false}
                  name="cashTrend"
                  activeDot={false}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
