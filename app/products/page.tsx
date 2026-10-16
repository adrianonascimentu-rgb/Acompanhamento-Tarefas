'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Package, 
  Tag, 
  Building2, 
  Boxes, 
  Hash, 
  Copy, 
  Check, 
  MessageCircle, 
  Download, 
  Printer, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Plus, 
  ExternalLink,
  ChevronRight,
  Info,
  Sparkles,
  Calculator,
  RefreshCw,
  X,
  Layers,
  ShoppingBag,
  TrendingUp,
  FileUp,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import PdfUploadModal from '@/components/catalog/PdfUploadModal';
import { 
  CatalogProduct, 
  INITIAL_CATALOG_PRODUCTS, 
  formatCurrency, 
  formatStock,
  inferCategory 
} from '@/lib/catalogProducts';

export default function ProductsCatalogPage() {
  const { isDarkMode } = useTheme();
  const { user, isAdmin } = useRole();

  // Products state (loads from localStorage or initial dataset)
  const [products, setProducts] = useState<CatalogProduct[]>(INITIAL_CATALOG_PRODUCTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'price_asc' | 'price_desc' | 'stock_desc' | 'code_asc'>('name_asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Selected product for detail modal / simulation
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // New product modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    code: '',
    name: '',
    additionalCode: '',
    stock: 1,
    manufacturer: '',
    price: 0
  });

  // PDF Upload Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [lastSyncBanner, setLastSyncBanner] = useState<{
    message: string;
    timestamp: string;
  } | null>(null);

  const currentUserRole = (user?.role || user?.type || '').toLowerCase();
  const isManagerOrAdmin = 
    isAdmin || 
    currentUserRole === 'admin' || 
    currentUserRole === 'administrador' || 
    currentUserRole === 'gerente' || 
    currentUserRole === 'supervisor' || 
    currentUserRole === 'estoque' ||
    currentUserRole === 'diretoria' ||
    currentUserRole === 'gestor';

  // Load persisted products and sync info from localStorage if any
  useEffect(() => {
    try {
      const saved = localStorage.getItem('app_custom_catalog_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
        }
      }

      const savedSync = localStorage.getItem('app_catalog_last_pdf_import');
      if (savedSync) {
        const parsedSync = JSON.parse(savedSync);
        if (parsedSync?.message) {
          setLastSyncBanner(parsedSync);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar catálogo salvo:', e);
    }
  }, []);

  const saveProducts = (updated: CatalogProduct[]) => {
    setProducts(updated);
    try {
      localStorage.setItem('app_custom_catalog_products', JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar catálogo no localStorage:', e);
    }
  };

  const handlePdfUpdateSuccess = (
    updatedCatalog: CatalogProduct[],
    summary: { newCount: number; updatedCount: number; totalCount: number }
  ) => {
    saveProducts(updatedCatalog);
    const syncInfo = {
      message: `Catálogo atualizado com sucesso via PDF: ${summary.newCount} novos itens cadastrados e ${summary.updatedCount} produtos atualizados de um total de ${summary.totalCount} itens.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setLastSyncBanner(syncInfo);
    try {
      localStorage.setItem('app_catalog_last_pdf_import', JSON.stringify(syncInfo));
    } catch {}
  };

  // Distinct manufacturers
  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.manufacturer) set.add(p.manufacturer.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const [catalogPage, setCatalogPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search term matching code, name, additionalCode (ref), manufacturer
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = 
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        p.additionalCode.toLowerCase().includes(term) ||
        p.manufacturer.toLowerCase().includes(term) ||
        (p.category && p.category.toLowerCase().includes(term));

      // Manufacturer filter
      const matchManufacturer = 
        selectedManufacturer === 'all' || 
        p.manufacturer.trim().toLowerCase() === selectedManufacturer.toLowerCase();

      // Category filter
      const matchCategory = 
        selectedCategory === 'all' || 
        p.category === selectedCategory;

      // Stock filter
      let matchStock = true;
      if (stockFilter === 'in_stock') matchStock = p.stock > 0;
      else if (stockFilter === 'low_stock') matchStock = p.stock > 0 && p.stock <= 3;
      else if (stockFilter === 'out_of_stock') matchStock = p.stock === 0;

      return matchSearch && matchManufacturer && matchCategory && matchStock;
    }).sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'stock_desc') return b.stock - a.stock;
      if (sortBy === 'code_asc') return a.code.localeCompare(b.code, undefined, { numeric: true });
      return 0;
    });
  }, [products, searchTerm, selectedManufacturer, selectedCategory, stockFilter, sortBy]);

  const totalCatalogPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(() => {
    const start = (catalogPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, catalogPage, itemsPerPage]);

  // Statistics
  const stats = useMemo(() => {
    const totalItems = products.length;
    const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
    const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
    const avgPrice = totalItems > 0 ? products.reduce((acc, p) => acc + p.price, 0) / totalItems : 0;
    return { totalItems, totalStock, totalValue, avgPrice };
  }, [products]);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleShareWhatsApp = (product: CatalogProduct) => {
    const parcela10x = (product.price / 10).toFixed(2).replace('.', ',');
    const aVistaPix = (product.price * 0.95).toFixed(2).replace('.', ','); // 5% de desconto no PIX
    const message = `Olá! Segue cotação do produto:\n\n📦 *${product.name}*\n🏷️ *Código:* ${product.code}\n🔢 *Referência:* ${product.additionalCode}\n🏭 *Fabricante:* ${product.manufacturer}\n📊 *Estoque Disponível:* ${formatStock(product.stock)} un\n\n💳 *Preço em até 10x:* ${formatCurrency(product.price)} (10x de R$ ${parcela10x})\n⚡ *À Vista no PIX (5% OFF):* R$ ${aVistaPix}\n\n_Campos Equipamentos e Refrigeração_`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleExportCSV = () => {
    const headers = ['Código', 'Nome do Produto', 'Referência (Cód. Adicional 1)', 'Fabricante', 'Estoque', 'Preço (10X)', 'Categoria'];
    const rows = filteredProducts.map(p => [
      `"${p.code}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.additionalCode}"`,
      `"${p.manufacturer}"`,
      p.stock,
      p.price.toFixed(2).replace('.', ','),
      `"${p.category || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalogo_produtos_campos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.code || !newProduct.name || !newProduct.manufacturer) {
      alert('Por favor, preencha código, nome e fabricante.');
      return;
    }

    const item: CatalogProduct = {
      id: newProduct.code.trim(),
      code: newProduct.code.trim(),
      name: newProduct.name.trim().toUpperCase(),
      additionalCode: newProduct.additionalCode.trim() || '-',
      stock: Number(newProduct.stock) || 0,
      manufacturer: newProduct.manufacturer.trim().toUpperCase(),
      price: Number(newProduct.price) || 0,
      category: inferCategory(newProduct.name, newProduct.manufacturer)
    };

    const updated = [item, ...products.filter(p => p.code !== item.code)];
    saveProducts(updated);
    setIsAddModalOpen(false);
    setNewProduct({
      code: '',
      name: '',
      additionalCode: '',
      stock: 1,
      manufacturer: '',
      price: 0
    });
  };

  return (
    <div className={`min-h-screen p-4 sm:p-8 transition-colors duration-300 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20 flex items-center justify-center shrink-0">
              <Package size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Catálogo de Peças & Produtos</h1>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
                Consulta rápida de nome do produto, preço, referência, fabricante e estoque em tempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Import / Update via PDF Button */}
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
              title="Atualizar produtos e cadastrar novos itens via arquivo PDF (Admin, Gerente ou Supervisor)"
            >
              <FileUp size={16} />
              <span>Atualizar via PDF</span>
              {isManagerOrAdmin && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[9px] font-black uppercase tracking-wider">
                  Gestão
                </span>
              )}
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>Novo Produto</span>
            </button>

            <button
              onClick={handleExportCSV}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isDarkMode 
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200' 
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs'
              }`}
              title="Exportar dados filtrados para arquivo CSV"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isDarkMode 
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200' 
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs'
              }`}
              title="Imprimir visualização atual"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>

        {/* Recent Sync / Update Notification Banner */}
        {lastSyncBanner && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <div>
                <span className="font-bold">{lastSyncBanner.message}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">
                  (Sincronizado às {lastSyncBanner.timestamp})
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setLastSyncBanner(null);
                try { localStorage.removeItem('app_catalog_last_pdf_import'); } catch {}
              }}
              className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-300 text-xs transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total de Itens</span>
              <Layers size={16} className="text-blue-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black">{stats.totalItems.toLocaleString('pt-BR')}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Cadastrados no sistema</p>
          </div>

          <div className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Estoque Físico Total</span>
              <Boxes size={16} className="text-emerald-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatStock(stats.totalStock)}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Unidades e peças disponíveis</p>
          </div>

          <div className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Fabricantes</span>
              <Building2 size={16} className="text-indigo-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black">{manufacturers.length}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Marcas homologadas</p>
          </div>

          <div className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Preço Médio</span>
              <Tag size={16} className="text-purple-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
              {formatCurrency(stats.avgPrice)}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Base de cálculo (10X)</p>
          </div>
        </div>

        {/* Search & Filter Controls Card */}
        <div className={`p-5 rounded-3xl border space-y-4 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
        }`}>
          {/* Main Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCatalogPage(1); }}
              placeholder="Buscar por nome do produto, referência (código adicional), código ou fabricante..."
              className={`w-full h-12 pl-11 pr-10 rounded-2xl border text-sm outline-none transition-all ${
                isDarkMode 
                  ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' 
                  : 'bg-slate-50/80 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'
              }`}
            />
            {searchTerm && (
              <button 
                onClick={() => { setSearchTerm(''); setCatalogPage(1); }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Manufacturer Filter */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Fabricante
              </label>
              <select
                value={selectedManufacturer}
                onChange={(e) => { setSelectedManufacturer(e.target.value); setCatalogPage(1); }}
                className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">Todos os Fabricantes ({manufacturers.length})</option>
                {manufacturers.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Categoria
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setCatalogPage(1); }}
                className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">Todas as Categorias ({categories.length})</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Stock Filter */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Status do Estoque
              </label>
              <select
                value={stockFilter}
                onChange={(e) => { setStockFilter(e.target.value as any); setCatalogPage(1); }}
                className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">Todos os Status</option>
                <option value="in_stock">Em Estoque (&gt; 0)</option>
                <option value="low_stock">Baixo Estoque (1 a 3 un)</option>
                <option value="out_of_stock">Estoque Zerado (0)</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Ordenar Por
              </label>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as any); setCatalogPage(1); }}
                className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="name_asc">Nome do Produto (A - Z)</option>
                <option value="price_asc">Menor Preço</option>
                <option value="price_desc">Maior Preço</option>
                <option value="stock_desc">Maior Estoque</option>
                <option value="code_asc">Código Numérico</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips & View Mode Toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="font-bold">
                Exibindo {filteredProducts.length} de {products.length} produtos
              </span>
              {(searchTerm || selectedManufacturer !== 'all' || selectedCategory !== 'all' || stockFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedManufacturer('all');
                    setSelectedCategory('all');
                    setStockFilter('all');
                  }}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer ml-1"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Tabela
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        {/* Products Results View */}
        {filteredProducts.length === 0 ? (
          <div className={`p-12 rounded-3xl border text-center space-y-3 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
          }`}>
            <Package size={40} className="mx-auto text-slate-400 opacity-60" />
            <h3 className="font-bold text-base">Nenhum produto encontrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Nenhum item corresponde aos critérios pesquisados. Tente ajustar o termo de busca ou redefinir os filtros de fabricante e estoque.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className={`rounded-3xl border overflow-hidden ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b text-[11px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    <th className="py-3.5 px-4">Código</th>
                    <th className="py-3.5 px-4">Nome do Produto</th>
                    <th className="py-3.5 px-4">Referência (Cód. Adicional)</th>
                    <th className="py-3.5 px-4">Fabricante</th>
                    <th className="py-3.5 px-4 text-center">Estoque</th>
                    <th className="py-3.5 px-4 text-right">Preço (10X)</th>
                    <th className="py-3.5 px-4 text-right">À Vista (PIX -5%)</th>
                    <th className="py-3.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedProducts.map((p) => {
                    const price10x = p.price;
                    const pricePix = p.price * 0.95;
                    const isLowStock = p.stock > 0 && p.stock <= 2;
                    const isZeroStock = p.stock === 0;

                    return (
                      <tr
                        key={p.code}
                        className={`transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20 ${
                          isZeroStock ? 'opacity-60' : ''
                        }`}
                      >
                        {/* Código */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {p.code}
                        </td>

                        {/* Nome do Produto & Categoria */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 max-w-xs sm:max-w-md">
                            {p.name}
                          </div>
                          {p.category && (
                            <span className="inline-block mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                              {p.category}
                            </span>
                          )}
                        </td>

                        {/* Referência (Código Adicional 1) */}
                        <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 group">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-[11px]">
                              {p.additionalCode || '-'}
                            </span>
                            {p.additionalCode && p.additionalCode !== '-' && (
                              <button
                                onClick={() => copyToClipboard(p.additionalCode, `ref_${p.code}`)}
                                title="Copiar código de referência"
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-opacity cursor-pointer"
                              >
                                {copiedField === `ref_${p.code}` ? (
                                  <Check size={12} className="text-emerald-500" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Fabricante */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                            {p.manufacturer}
                          </span>
                        </td>

                        {/* Estoque */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black tabular-nums ${
                            isZeroStock
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : isLowStock
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {formatStock(p.stock)}
                          </span>
                        </td>

                        {/* Preço 10X */}
                        <td className="py-3.5 px-4 text-right font-black tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          <div className="text-sm">{formatCurrency(price10x)}</div>
                          <div className="text-[10px] font-semibold text-slate-400">10x de {formatCurrency(price10x / 10)}</div>
                        </td>

                        {/* Preço À Vista */}
                        <td className="py-3.5 px-4 text-right font-black tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          <div className="text-sm">{formatCurrency(pricePix)}</div>
                          <div className="text-[10px] font-semibold text-emerald-500 opacity-80">PIX / Dinheiro</div>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedProduct(p)}
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                              title="Ver Detalhes e Simulação de Parcelas"
                            >
                              <Calculator size={14} />
                            </button>
                            <button
                              onClick={() => handleShareWhatsApp(p)}
                              className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
                              title="Enviar Cotação por WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedProducts.map((p) => {
              const price10x = p.price;
              const pricePix = p.price * 0.95;
              const isLowStock = p.stock > 0 && p.stock <= 2;
              const isZeroStock = p.stock === 0;

              return (
                <motion.div
                  key={p.code}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-5 rounded-3xl border flex flex-col justify-between transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 hover:border-slate-700' 
                      : 'bg-white border-slate-100 shadow-xs hover:border-slate-200 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        {p.code}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {p.manufacturer}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
                        {p.name}
                      </h3>
                      {p.category && (
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{p.category}</p>
                      )}
                    </div>

                    <div className={`p-3 rounded-2xl border space-y-1.5 ${
                      isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Referência:</span>
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-200">
                          <span>{p.additionalCode || '-'}</span>
                          {p.additionalCode && p.additionalCode !== '-' && (
                            <button
                              onClick={() => copyToClipboard(p.additionalCode, `card_ref_${p.code}`)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 cursor-pointer"
                            >
                              {copiedField === `card_ref_${p.code}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Estoque:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                          isZeroStock
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : isLowStock
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {formatStock(p.stock)} un
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
                    <div>
                      <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                        {formatCurrency(price10x)}
                      </div>
                      <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        À vista: {formatCurrency(pricePix)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(p)}
                        className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                        title="Compartilhar Cotação"
                      >
                        <MessageCircle size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Catalog Pagination Controls */}
        {filteredProducts.length > 0 && (
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            <div className="flex items-center gap-2">
              <span>
                Exibindo <strong>{(catalogPage - 1) * itemsPerPage + 1}</strong> a <strong>{Math.min(catalogPage * itemsPerPage, filteredProducts.length)}</strong> de <strong>{filteredProducts.length}</strong> produtos
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCatalogPage(1);
                  }}
                  className={`h-7 px-2 rounded-lg border text-xs font-bold outline-none cursor-pointer ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCatalogPage(1)}
                disabled={catalogPage === 1}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer"
                title="Primeira Página"
              >
                « Primeira
              </button>
              <button
                onClick={() => setCatalogPage(p => Math.max(1, p - 1))}
                disabled={catalogPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer"
              >
                Anterior
              </button>
              <span className="px-3 font-bold text-slate-900 dark:text-slate-100">
                Página {catalogPage} de {totalCatalogPages}
              </span>
              <button
                onClick={() => setCatalogPage(p => Math.min(totalCatalogPages, p + 1))}
                disabled={catalogPage === totalCatalogPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer"
              >
                Próxima
              </button>
              <button
                onClick={() => setCatalogPage(totalCatalogPages)}
                disabled={catalogPage === totalCatalogPages}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer"
                title="Última Página"
              >
                Última »
              </button>
            </div>
          </div>
        )}

        {/* Product Detail & Simulator Modal */}
        <AnimatePresence>
          {selectedProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className={`w-full max-w-lg rounded-3xl border p-6 space-y-6 max-h-[90vh] overflow-y-auto ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
                }`}
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        Código: {selectedProduct.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        {selectedProduct.manufacturer}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold mt-1">
                      {selectedProduct.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Key Attributes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3.5 rounded-2xl border ${
                    isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                  }`}>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Referência / Cód. Adicional</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold text-xs">{selectedProduct.additionalCode || '-'}</span>
                      <button
                        onClick={() => copyToClipboard(selectedProduct.additionalCode, 'modal_ref')}
                        className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer"
                        title="Copiar referência"
                      >
                        {copiedField === 'modal_ref' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-2xl border ${
                    isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                  }`}>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Estoque Físico</span>
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatStock(selectedProduct.stock)} un
                    </div>
                  </div>
                </div>

                {/* Price & Installments Calculator */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                }`}>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Calculator size={16} className="text-blue-500" />
                    <span>Simulação de Condições de Pagamento</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Preço de Tabela (PB- 10X)</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {formatCurrency(selectedProduct.price)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">10x de {formatCurrency(selectedProduct.price / 10)}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold">À Vista no PIX (-5%)</span>
                      <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(selectedProduct.price * 0.95)}
                      </span>
                      <span className="text-[10px] text-emerald-600 opacity-80 block mt-0.5">Economia de {formatCurrency(selectedProduct.price * 0.05)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(selectedProduct)}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <MessageCircle size={16} />
                    <span>Enviar Cotação WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add New Product Modal */}
        <AnimatePresence>
          {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`w-full max-w-md rounded-3xl border p-6 space-y-4 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base">Cadastrar Novo Produto / Peça</h3>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleAddProductSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Código</label>
                    <input
                      type="text"
                      required
                      value={newProduct.code}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, code: e.target.value }))}
                      placeholder="Ex: 311827"
                      className={`w-full h-10 px-3 rounded-xl border outline-none font-mono ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nome do Produto</label>
                    <input
                      type="text"
                      required
                      value={newProduct.name}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: TERMOSTATO DUPLEX R22"
                      className={`w-full h-10 px-3 rounded-xl border outline-none uppercase ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Código Adicional / Ref</label>
                      <input
                        type="text"
                        value={newProduct.additionalCode}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, additionalCode: e.target.value }))}
                        placeholder="Ex: AGT-992"
                        className={`w-full h-10 px-3 rounded-xl border outline-none font-mono ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fabricante</label>
                      <input
                        type="text"
                        required
                        value={newProduct.manufacturer}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, manufacturer: e.target.value }))}
                        placeholder="Ex: ELECTROLUX"
                        className={`w-full h-10 px-3 rounded-xl border outline-none uppercase ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Estoque (sem grade)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={newProduct.stock}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, stock: parseFloat(e.target.value) || 0 }))}
                        className={`w-full h-10 px-3 rounded-xl border outline-none font-mono ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Preço PB- 10X (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={newProduct.price}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                        className={`w-full h-10 px-3 rounded-xl border outline-none font-mono ${
                          isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex items-center gap-2">
                    <button
                      type="submit"
                      className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
                    >
                      Salvar Produto no Catálogo
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className={`h-11 px-4 rounded-xl border font-bold transition-all cursor-pointer ${
                        isDarkMode ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* PDF Import & Batch Update Modal */}
        <PdfUploadModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          currentProducts={products}
          onApplyUpdate={handlePdfUpdateSuccess}
          userRole={user?.role || user?.type || ''}
          userName={user?.name || user?.username || 'Usuário'}
          isAdmin={isAdmin}
        />

      </div>
    </div>
  );
}
