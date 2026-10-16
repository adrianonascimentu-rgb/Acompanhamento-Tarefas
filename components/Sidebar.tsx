'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  ClipboardList, 
  ListTodo,
  Users, 
  Target, 
  Truck, 
  ArrowRightLeft, 
  ShieldCheck, 
  Settings, 
  LogOut, 
  BarChart3, 
  MessageCircle, 
  TrendingUp, 
  Share2,
  Sun,
  Moon,
  Zap,
  Radio,
  Tag,
  Package
} from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { useUI } from '@/hooks/useUI';
import { useDataPrefetch } from '@/hooks/useDataPrefetch';
import { supabase } from '@/lib/supabase';

export function Sidebar() {
  const pathname = usePathname();
  const { prefetchRoute } = useDataPrefetch();
  const [appName, setAppName] = React.useState('AgenteX');

  React.useEffect(() => {
    async function loadAppName() {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'app_short_name')
          .single();
        if (data?.value) {
          const val = typeof data.value === 'string' ? data.value : JSON.stringify(data.value).replace(/^"|"$/g, '');
          if (val) setAppName(val);
        }
      } catch (e) {}
    }
    loadAppName();
  }, []);
  const { 
    role, 
    isAdmin, 
    user, 
    canAccessLeads, 
    canAccessDeliveries, 
    canAccessTransfers, 
    canAccessWarranties, 
    canAccessReports, 
    canAccessWhatsapp, 
    canAccessSales, 
    canAccessSocialMedia, 
    logout 
  } = useRole();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { showSettingsModal } = useUI();

  const handleLogout = () => {
    setIsLoggingOut(true);
    logout();
  };

  if (!user) return null;

  // Grouped Navigation structure for modern scannability
  const sections = [
    {
      title: 'Principal',
      items: [
        { href: '/', icon: Home, label: 'Início', active: pathname === '/' },
        { href: '/products', icon: Package, label: 'Catálogo de Peças', active: pathname?.startsWith('/products') },
        { href: '/tasks', icon: ClipboardList, label: 'Tarefas', active: pathname?.startsWith('/tasks') },
        { href: '/demands', icon: ListTodo, label: 'Demandas', active: pathname?.startsWith('/demands') },
        { href: '/routes', icon: Truck, label: 'Rotas & GPS', active: pathname?.startsWith('/routes') },
      ]
    },
    {
      title: 'Comunicação & CRM',
      items: [
        ...(canAccessWhatsapp ? [{ href: '/whatsapp', icon: MessageCircle, label: 'WhatsApp', active: pathname?.startsWith('/whatsapp') }] : []),
        ...(canAccessLeads ? [{ href: '/leads', icon: Target, label: 'Leads', active: pathname?.startsWith('/leads') }] : []),
        ...(canAccessSocialMedia ? [{ href: '/social-media', icon: Share2, label: 'Redes Sociais', active: pathname?.startsWith('/social-media') }] : []),
      ]
    },
    {
      title: 'Operações',
      items: [
        ...(canAccessDeliveries ? [{ href: '/deliveries', icon: Truck, label: 'Entregas', active: pathname?.startsWith('/deliveries') }] : []),
        { href: '/reports/truck-history', icon: Truck, label: 'Caminhão Reposição', active: pathname?.startsWith('/reports/truck-history') },
        ...(canAccessTransfers ? [{ href: '/transfers', icon: ArrowRightLeft, label: 'Transferências', active: pathname?.startsWith('/transfers') }] : []),
        ...(canAccessWarranties ? [{ href: '/warranties', icon: ShieldCheck, label: 'Garantias', active: pathname?.startsWith('/warranties') }] : []),
        { href: '/price-research', icon: Tag, label: 'Pesquisa de Preço', active: pathname?.startsWith('/price-research') },
      ]
    },
    {
      title: 'Resultados',
      items: [
        ...(canAccessSales ? [{ href: '/sales-results', icon: TrendingUp, label: 'Vendas', active: pathname?.startsWith('/sales') }] : []),
        ...(canAccessReports ? [{ href: '/reports', icon: BarChart3, label: 'Relatórios', active: pathname?.startsWith('/reports') }] : []),
      ]
    },
    {
      title: 'Administração',
      items: [
        ...(isAdmin ? [{ href: '/painel-ao-vivo', icon: Radio, label: 'Painel Ao Vivo', active: pathname?.startsWith('/painel-ao-vivo') || pathname?.startsWith('/admin/dashboard') }] : []),
        ...(isAdmin ? [{ href: '/collaborators', icon: Users, label: 'Equipe', active: pathname?.startsWith('/collaborators') }] : []),
        { href: '/admin/settings', icon: Settings, label: 'Configurações', active: pathname?.startsWith('/admin/settings') },
      ]
    }
  ].filter(section => section.items.length > 0);

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors z-40">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs group-hover:bg-blue-500 transition-colors">
            <Zap size={17} className="fill-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white leading-none">
              {appName}
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
              Gestão Inteligente
            </span>
          </div>
        </Link>
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onTouchStart={() => prefetchRoute(item.href)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      item.active
                        ? 'bg-blue-50 text-blue-600 font-semibold dark:bg-blue-950/50 dark:text-blue-400'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon 
                      size={17} 
                      className={`shrink-0 ${
                        item.active 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600'
                      }`} 
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User & Settings Footer */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-600/20">
              {user.name ? user.name.substring(0, 2).toUpperCase() : 'US'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate capitalize">
                {role}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <button
              onClick={() => toggleDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <Link
              href="/admin/settings"
              title="Configurações do Sistema"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings size={15} />
            </Link>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sair da Conta"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
            >
              <LogOut size={13} />
              <span>{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
