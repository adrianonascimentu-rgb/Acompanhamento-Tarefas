'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  Legend, LineChart, Line, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, ShoppingBag, Users, DollarSign, Plus, Search, Filter, 
  Calendar, ChevronRight, Package, ArrowUpRight, ArrowDownRight,
  MoreVertical, Download, Share2, Activity, ShoppingCart, CreditCard, ShieldCheck, Settings, Check, X
} from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { LoginForm } from '@/components/auth/LoginForm';
import { GsapSalesProgressBar } from '@/components/dashboard/GsapSalesProgressBar';
import { exportSalesDashboardToPDF } from '@/lib/exportPdf';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function SalesModulePage() {
  const { isDarkMode } = useTheme();
  const { role, user, isAdmin, canAccessSales, isAuthenticated, login } = useRole();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'products' | 'sellers'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [salesResults, setSalesResults] = useState<any[]>([]);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSellerSettingsModal, setShowSellerSettingsModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<any>(null);
  const [sellerMonthlySettings, setSellerMonthlySettings] = useState<any[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Form states
  const [newSale, setNewSale] = useState({
    customer_name: '',
    seller_id: '',
    payment_method: 'Cartão',
    items: [] as any[]
  });

  const [newProduct, setNewProduct] = useState({
    name: '',
    price: 0,
    category: 'Geral',
    stock_quantity: 0
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          seller:profiles(name),
          items:sale_items(
            *,
            product:products(name)
          )
        `)
        .order('sale_date', { ascending: false });

      if (salesError && salesError.code !== 'PGRST116') {
        console.error('Error fetching sales:', salesError);
      } else {
        setSales(salesData || []);
      }

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (productsError && productsError.code !== 'PGRST116') {
        console.error('Error fetching products:', productsError);
      } else {
        setProducts(productsData || []);
      }

      // Fetch sellers
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .or('type.eq.vendedor,can_access_sales.eq.true')
        .order('name');

      if (profilesError) throw profilesError;
      setSellers(profilesData || []);

      // Fetch sales results (targets and results)
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const { data: resultsData, error: resultsError } = await supabase
        .from('sales_results')
        .select('*')
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (resultsError && resultsError.code !== 'PGRST116') {
        console.error('Error fetching sales results:', resultsError);
      } else {
        setSalesResults(resultsData || []);
      }

    } catch (error: any) {
      console.error('Error fetching data:', error?.message || error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && canAccessSales) {
      fetchData();
    }
  }, [isAuthenticated, canAccessSales, fetchData]);

  const handleAddSale = async () => {
    try {
      if (!newSale.customer_name || !newSale.seller_id || newSale.items.length === 0) {
        alert('Preencha todos os campos obrigatórios');
        return;
      }

      const totalValue = newSale.items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          customer_name: newSale.customer_name,
          seller_id: newSale.seller_id,
          payment_method: newSale.payment_method,
          total_value: totalValue,
          status: 'completed'
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      const itemsToInsert = newSale.items.map(item => ({
        sale_id: saleData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      setShowSaleModal(false);
      setNewSale({ customer_name: '', seller_id: '', payment_method: 'Cartão', items: [] });
      fetchData();
    } catch (error: any) {
      console.error('Error adding sale:', error);
      alert('Erro ao adicionar venda: ' + error.message);
    }
  };

  const handleAddProduct = async () => {
    try {
      if (!newProduct.name || newProduct.price <= 0) {
        alert('Preencha o nome e o preço do produto');
        return;
      }

      const { error } = await supabase
        .from('products')
        .insert([newProduct]);

      if (error) throw error;

      setShowProductModal(false);
      setNewProduct({ name: '', price: 0, category: 'Geral', stock_quantity: 0 });
      fetchData();
    } catch (error: any) {
      console.error('Error adding product:', error);
      alert('Erro ao adicionar produto: ' + error.message);
    }
  };

  const handleOpenSellerSettings = async (seller: any) => {
    setSelectedSeller(seller);
    setIsSavingSettings(true);
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('sales_results')
        .select('*')
        .eq('collaborator_id', seller.id)
        .eq('year', currentYear);

      if (error) throw error;

      // Initialize all 12 months
      const months = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const existing = data?.find(r => r.month === month);
        return existing || {
          collaborator_id: seller.id,
          month,
          year: currentYear,
          is_visible: true,
          has_target: true,
          result_2025: 0,
          target_suggestion: 0,
          target_2026: 0,
          result_2026: 0
        };
      });

      setSellerMonthlySettings(months);
      setShowSellerSettingsModal(true);
    } catch (error) {
      console.error('Error fetching seller settings:', error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveSellerSettings = async () => {
    setIsSavingSettings(true);
    try {
      const recordsToSave = sellerMonthlySettings.map(setting => ({
        ...setting,
        id: setting.id || crypto.randomUUID()
      }));

      const { error } = await supabase
        .from('sales_results')
        .upsert(recordsToSave, { onConflict: 'collaborator_id,month,year' });

      if (error) throw error;
      setShowSellerSettingsModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving seller settings:', error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (!isAuthenticated) return <LoginForm onLogin={login} />;
  if (!canAccessSales) return <div className="p-4">Acesso negado.</div>;

  // Dashboard Stats
  const totalRevenue = sales.reduce((acc, s) => acc + (s.total_value || 0), 0);
  const totalSales = sales.length;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  const handleTriggerPDFExport = () => {
    exportSalesDashboardToPDF({
      title: 'Relatório de Desempenho do Dashboard de Vendas',
      period: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      totalRevenue,
      totalSales,
      avgTicket,
      activeProductsCount: products.length,
      salesBySeller,
      salesResults: salesResults.map(r => ({
        name: r.collaborator?.name || r.collaborator_id || 'Vendedor',
        res2025: r.result_2025 || 0,
        meta2026: r.target_2026 || 0,
        res2026: r.result_2026 || 0,
      })),
      recentTransactions: sales.slice(0, 10).map(s => ({
        customer_name: s.customer_name || 'Cliente',
        seller_name: s.seller?.name || 'Vendedor',
        sale_date: format(new Date(s.sale_date), 'dd/MM/yyyy HH:mm'),
        total_value: s.total_value || 0,
        payment_method: s.payment_method || 'Cartão',
      }))
    });
  };
  
  // Sales over time (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    const daySales = sales.filter(s => {
      const saleDate = new Date(s.sale_date);
      return isWithinInterval(saleDate, { start: startOfDay(date), end: endOfDay(date) });
    });
    return {
      name: format(date, 'dd/MM', { locale: ptBR }),
      value: daySales.reduce((acc, s) => acc + (s.total_value || 0), 0)
    };
  }).reverse();

  // Sales by Category
  const categoryData = products.reduce((acc: any[], p) => {
    const cat = p.category || 'Outros';
    const existing = acc.find(a => a.name === cat);
    if (existing) {
      existing.value += sales.filter(s => s.items?.some((i: any) => i.product_id === p.id)).length;
    } else {
      acc.push({ name: cat, value: 1 });
    }
    return acc;
  }, []);

  // Sales by Seller
  const salesBySeller = sellers.map(seller => {
    const sellerSales = sales.filter(s => s.seller_id === seller.id);
    return {
      name: seller.name?.split(' ')[0] || 'Vendedor',
      value: sellerSales.reduce((acc, s) => acc + (s.total_value || 0), 0)
    };
  }).sort((a, b) => b.value - a.value);

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receita Total', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { label: 'Vendas Realizadas', value: totalSales, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Ticket Médio', value: `R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-100' },
          { label: 'Produtos Ativos', value: products.length, icon: Package, color: 'text-purple-600', bg: 'bg-purple-100' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}
          >
            <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
            <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* GSAP Sales Progress vs Target Feature Card */}
      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} space-y-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Metas & Receita de Vendas</h3>
              <p className="text-[11px] text-slate-400 font-medium">Animação suave de faturamento vs. metas via GSAP</p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-900/50">
            Mês Atual
          </span>
        </div>

        <GsapSalesProgressBar
          currentRevenue={totalRevenue}
          targetGoal={salesResults.reduce((acc, curr) => acc + (parseFloat(curr.target_2026 || curr.goal) || 0), 0) || 120000}
          label="Progresso da Meta Global de Faturamento"
          subtitle="Acompanhamento em tempo real de receita acumulada x meta do mês"
          isDarkMode={isDarkMode}
          showDetails={true}
          barHeight="h-3.5"
          colorScheme="emerald"
        />

        {/* Sellers Mini Progress Bars */}
        {sellers.length > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Progresso por Vendedor
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sellers.slice(0, 4).map((seller, idx) => {
                const sellerSales = sales.filter(s => s.seller_id === seller.id);
                const sellerRevenue = sellerSales.reduce((acc, s) => acc + (s.total_value || 0), 0);
                const resultObj = salesResults.find(r => r.collaborator_id === seller.id);
                const sellerTarget = resultObj?.target_2026 || 25000;
                
                return (
                  <div key={seller.id} className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-100'}`}>
                    <GsapSalesProgressBar
                      currentRevenue={sellerRevenue}
                      targetGoal={sellerTarget}
                      label={seller.name}
                      isDarkMode={isDarkMode}
                      showDetails={true}
                      barHeight="h-2.5"
                      colorScheme={idx % 2 === 0 ? 'blue' : 'purple'}
                      delay={0.2 + idx * 0.1}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600" />
            Vendas (Últimos 7 dias)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR')}`}
                />
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
            <Package size={16} className="text-blue-600" />
            Vendas por Categoria
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.length > 0 ? categoryData : [{ name: 'Sem dados', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sales by Seller Chart */}
      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
          <Users size={16} className="text-blue-600" />
          Volume de Vendas por Vendedor
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesBySeller} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} width={80} />
              <Tooltip 
                contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR')}`}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={32}>
                {salesBySeller.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Sales List */}
      <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Vendas Recentes</h3>
          <button onClick={() => setActiveTab('transactions')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
            Ver Todas <ChevronRight size={12} />
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sales.slice(0, 5).map((sale) => (
            <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <ShoppingCart size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold">{sale.customer_name}</p>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                    {sale.seller?.name} • {format(new Date(sale.sale_date), 'dd MMM, HH:mm', { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-emerald-600">R$ {sale.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{sale.payment_method}</p>
              </div>
            </div>
          ))}
          {sales.length === 0 && (
            <div className="p-10 text-center text-slate-400">
              <p className="text-sm font-medium">Nenhuma venda registrada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por cliente ou vendedor..." 
            className="bg-transparent border-none outline-none text-sm w-full"
          />
        </div>
        <button className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <Filter size={20} className="text-slate-400" />
        </button>
      </div>

      <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Vendedor</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Valor</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Pagamento</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 text-xs font-medium text-slate-500">
                    {format(new Date(sale.sale_date), 'dd/MM/yyyy')}
                  </td>
                  <td className="p-4 text-sm font-bold">{sale.customer_name}</td>
                  <td className="p-4 text-sm font-medium text-slate-600 dark:text-slate-300">{sale.seller?.name}</td>
                  <td className="p-4 text-sm font-black text-emerald-600">R$ {sale.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                      {sale.payment_method}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
                      <MoreVertical size={16} className="text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className={`flex-1 max-w-md flex items-center gap-2 px-4 py-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar produtos..." 
            className="bg-transparent border-none outline-none text-sm w-full"
          />
        </div>
        <button 
          onClick={() => setShowProductModal(true)}
          className="ml-4 flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/20"
        >
          <Plus size={18} />
          Novo Produto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <Package size={24} className="text-blue-600" />
              </div>
              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                {product.category}
              </span>
            </div>
            <h4 className="text-lg font-black mb-1">{product.name}</h4>
            <p className="text-2xl font-black text-emerald-600 mb-4">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${product.stock_quantity > 10 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-xs font-bold text-slate-400">{product.stock_quantity} em estoque</span>
              </div>
              <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <MoreVertical size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSellers = () => (
    <div className="space-y-6">
      {/* Cards View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sellers.map((seller) => {
          const result = salesResults.find(r => r.collaborator_id === seller.id);
          
          // If not visible for current month, skip for non-admins
          if (!isAdmin && result && result.is_visible === false) return null;

          const sellerSales = sales.filter(s => s.seller_id === seller.id);
          const currentResult = result?.is_visible === false ? 0 : sellerSales.reduce((acc, s) => acc + (s.total_value || 0), 0);
          const target = result?.has_target === false ? 0 : (result?.target_2026 || 0);
          const progress = target > 0 ? (currentResult / target) * 100 : 0;

          return (
            <div key={seller.id} className={`p-6 rounded-[32px] border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} ${result?.is_visible === false ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="size-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-xl overflow-hidden relative">
                    {seller.avatar_url ? (
                      <Image 
                        src={seller.avatar_url} 
                        alt={seller.name} 
                        fill 
                        className="object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      seller.name?.charAt(0)
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 size-5 rounded-lg bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                    <ShieldCheck size={12} className="text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-black text-lg leading-tight">{seller.name}</h4>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vendedor Ativo</p>
                    {result?.is_visible === false && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 dark:bg-amber-900/30">Oculto</span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => handleOpenSellerSettings(seller)}
                    className={`ml-auto p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}
                  >
                    <Settings size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Resultado Atual</p>
                    <p className="text-xl font-black text-emerald-600">
                      {result?.is_visible === false ? '---' : `R$ ${currentResult.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Meta Mensal</p>
                    <p className="text-sm font-bold text-slate-500">
                      {result?.has_target === false ? 'Sem Meta' : `R$ ${target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </p>
                  </div>
                </div>

                {result?.has_target !== false && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Progresso da Meta</span>
                      <span className={progress >= 100 ? 'text-emerald-500' : 'text-blue-500'}>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="text-center p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50">
                  <p className="text-lg font-black">{sellerSales.length}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Vendas</p>
                </div>
                <div className="text-center p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50">
                  <p className="text-lg font-black text-blue-600">R$ {(sellerSales.length > 0 ? currentResult / sellerSales.length : 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Ticket Médio</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Table View (as requested by user image) */}
      <div className={`overflow-hidden rounded-[32px] border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Resultados e Metas Detalhados</h3>
          <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px] font-black uppercase tracking-widest">
            Março 2026
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Colaborador</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Resultado 2025</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Sugestão Meta</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Meta 2026</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Resultado 2026</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Atingimento</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((seller) => {
                const result = salesResults.find(r => r.collaborator_id === seller.id);
                
                // If not visible for current month, skip for non-admins
                if (!isAdmin && result && result.is_visible === false) return null;

                const atingimento = (result?.has_target !== false && result?.target_2026 > 0) ? (result?.result_2026 / result?.target_2026) * 100 : 0;
                
                return (
                  <tr key={seller.id} className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'} ${result?.is_visible === false ? 'opacity-60' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs overflow-hidden relative">
                          {seller.avatar_url ? (
                            <Image src={seller.avatar_url} alt={seller.name} fill className="object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            seller.name?.charAt(0)
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{seller.name}</span>
                          {result?.is_visible === false && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-600">Oculto</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-right text-slate-500">
                      {result?.is_visible === false ? '---' : `R$ ${(result?.result_2025 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="p-4 text-sm text-right text-slate-400 italic">
                      {result?.has_target === false ? '---' : `R$ ${(result?.target_suggestion || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="p-4 text-sm text-right font-bold">
                      {result?.has_target === false ? 'Sem Meta' : `R$ ${(result?.target_2026 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="p-4 text-sm text-right font-black text-emerald-600">
                      {result?.is_visible === false ? '---' : `R$ ${(result?.result_2026 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="p-4 text-right min-w-[140px]">
                      {result?.has_target !== false ? (
                        <GsapSalesProgressBar
                          currentRevenue={result?.result_2026 || 0}
                          targetGoal={result?.target_2026 || 0}
                          isDarkMode={isDarkMode}
                          showDetails={false}
                          barHeight="h-2"
                          colorScheme={atingimento >= 100 ? 'emerald' : 'blue'}
                        />
                      ) : (
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSellerSettingsModal = () => (
    <AnimatePresence>
      {showSellerSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div>
                <h3 className="text-2xl font-black">Gestão de Vendas</h3>
                <p className="text-blue-100 text-sm font-bold opacity-80">{selectedSeller?.name}</p>
              </div>
              <button 
                onClick={() => setShowSellerSettingsModal(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <div className="col-span-4">Mês</div>
                  <div className="col-span-4 text-center">Exibir Resultado</div>
                  <div className="col-span-4 text-center">Incluir Meta</div>
                </div>
                
                {sellerMonthlySettings.map((setting, index) => (
                  <div 
                    key={setting.month} 
                    className={`grid grid-cols-12 gap-4 items-center p-4 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-black text-xs">
                        {setting.month}
                      </div>
                      <span className="font-bold text-sm">
                        {format(new Date(setting.year, setting.month - 1), 'MMMM', { locale: ptBR })}
                      </span>
                    </div>
                    
                    <div className="col-span-4 flex justify-center">
                      <button
                        onClick={() => {
                          const newSettings = [...sellerMonthlySettings];
                          newSettings[index].is_visible = !newSettings[index].is_visible;
                          setSellerMonthlySettings(newSettings);
                        }}
                        className={`size-10 rounded-xl flex items-center justify-center transition-all ${
                          setting.is_visible 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        {setting.is_visible ? <Check size={20} /> : <X size={20} />}
                      </button>
                    </div>

                    <div className="col-span-4 flex justify-center">
                      <button
                        onClick={() => {
                          const newSettings = [...sellerMonthlySettings];
                          newSettings[index].has_target = !newSettings[index].has_target;
                          setSellerMonthlySettings(newSettings);
                        }}
                        className={`size-10 rounded-xl flex items-center justify-center transition-all ${
                          setting.has_target 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        {setting.has_target ? <Check size={20} /> : <X size={20} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex gap-4">
              <button
                onClick={() => setShowSellerSettingsModal(false)}
                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSellerSettings}
                disabled={isSavingSettings}
                className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all"
              >
                {isSavingSettings ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div id="sales-dashboard" className={`flex flex-col min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`flex items-center justify-between p-4 border-b sticky top-0 z-10 ${isDarkMode ? 'border-slate-800 bg-slate-900/80 backdrop-blur-md' : 'border-slate-100 bg-white/80 backdrop-blur-md'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Módulo de Vendas</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gestão e Performance</p>
          </div>
        </div>

        <div className="actions-bar flex items-center gap-2">
          <button
            onClick={handleTriggerPDFExport}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Exportar dados do dashboard para relatório PDF"
          >
            <Download size={16} className="text-blue-400" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>

          <button 
            onClick={() => setShowSaleModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nova Venda</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32 p-4">
        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'transactions', label: 'Vendas', icon: CreditCard },
            { id: 'products', label: 'Produtos', icon: Package },
            { id: 'sellers', label: 'Vendedores', icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Activity className="animate-spin mb-4" size={32} />
            <p className="text-sm font-medium">Carregando dados de vendas...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'transactions' && renderTransactions()}
              {activeTab === 'products' && renderProducts()}
              {activeTab === 'sellers' && renderSellers()}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Sale Modal */}
      <AnimatePresence>
        {showSaleModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className={`w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] p-8 ${isDarkMode ? 'bg-slate-900' : 'bg-white'} shadow-2xl`}
            >
              <h2 className="text-2xl font-black mb-6">Nova Venda</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Cliente</label>
                  <input 
                    type="text" 
                    value={newSale.customer_name}
                    onChange={(e) => setNewSale({...newSale, customer_name: e.target.value})}
                    placeholder="Nome do cliente"
                    className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} outline-none font-bold`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Vendedor</label>
                  <select 
                    value={newSale.seller_id}
                    onChange={(e) => setNewSale({...newSale, seller_id: e.target.value})}
                    className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} outline-none font-bold`}
                  >
                    <option value="">Selecione o vendedor</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Produtos</label>
                  <div className="space-y-2">
                    {products.slice(0, 3).map(p => (
                      <button 
                        key={p.id}
                        onClick={() => {
                          const existing = newSale.items.find(i => i.product_id === p.id);
                          if (existing) {
                            setNewSale({...newSale, items: newSale.items.map(i => i.product_id === p.id ? {...i, quantity: i.quantity + 1} : i)});
                          } else {
                            setNewSale({...newSale, items: [...newSale.items, { product_id: p.id, quantity: 1, unit_price: p.price, name: p.name }]});
                          }
                        }}
                        className={`w-full p-3 rounded-xl border flex justify-between items-center ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'}`}
                      >
                        <span className="text-sm font-bold">{p.name}</span>
                        <span className="text-xs font-black text-emerald-600">R$ {p.price.toLocaleString('pt-BR')}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {newSale.items.length > 0 && (
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Itens Selecionados</p>
                    {newSale.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold">{item.quantity}x {item.name}</span>
                        <span className="text-xs font-black">R$ {(item.unit_price * item.quantity).toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowSaleModal(false)}
                    className={`flex-1 p-4 rounded-2xl font-bold text-sm ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleAddSale}
                    className="flex-1 p-4 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/20"
                  >
                    Finalizar Venda
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Modal */}
      <AnimatePresence>
        {showProductModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className={`w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] p-8 ${isDarkMode ? 'bg-slate-900' : 'bg-white'} shadow-2xl`}
            >
              <h2 className="text-2xl font-black mb-6">Novo Produto</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nome do Produto</label>
                  <input 
                    type="text" 
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="Ex: Teclado Mecânico"
                    className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} outline-none font-bold`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Preço (R$)</label>
                    <input 
                      type="number" 
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                      className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} outline-none font-bold`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Estoque</label>
                    <input 
                      type="number" 
                      value={newProduct.stock_quantity}
                      onChange={(e) => setNewProduct({...newProduct, stock_quantity: parseInt(e.target.value)})}
                      className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} outline-none font-bold`}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Categoria</label>
                  <select 
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    className={`w-full p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} outline-none font-bold`}
                  >
                    <option value="Geral">Geral</option>
                    <option value="Eletrônicos">Eletrônicos</option>
                    <option value="Móveis">Móveis</option>
                    <option value="Acessórios">Acessórios</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowProductModal(false)}
                    className={`flex-1 p-4 rounded-2xl font-bold text-sm ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleAddProduct}
                    className="flex-1 p-4 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-600/20"
                  >
                    Salvar Produto
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {renderSellerSettingsModal()}
      
      <BottomNav />
    </div>
  );
}
