'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CheckSquare, 
  MapPin, 
  MessageSquare, 
  Menu,
  X,
  LogOut,
  User,
  Settings,
  Sun,
  Moon,
  ListTodo,
  Truck,
  ArrowRightLeft,
  ShieldCheck,
  Target,
  Share2,
  TrendingUp,
  BarChart3,
  Users,
  Radio,
  Zap,
  ChevronRight,
  Tag,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/hooks/useTheme';
import { useUI } from '@/hooks/useUI';
import { useDataPrefetch } from '@/hooks/useDataPrefetch';

export function BottomNav() {
  const pathname = usePathname();
  const { prefetchRoute } = useDataPrefetch();
  const { 
    user, 
    role, 
    isAdmin, 
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
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { showSettingsModal, showConfirm } = useUI();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Não exibe a barra se o usuário não estiver autenticado
  if (!user) return null;

  const handleLogout = () => {
    setIsMenuOpen(false);
    showConfirm({
      title: 'Sair do Aplicativo',
      message: 'Tem certeza que deseja encerrar sua sessão e sair do aplicativo?',
      type: 'danger',
      confirmLabel: 'Sair',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        setIsLoggingOut(true);
        try {
          await logout();
        } finally {
          setIsLoggingOut(false);
        }
      }
    });
  };

  // Abas principais ergonômicas para a equipe em campo
  const navItems = [
    { 
      label: 'Início', 
      href: '/', 
      icon: LayoutDashboard,
      isActive: pathname === '/'
    },
    { 
      label: 'Tarefas', 
      href: '/tasks', 
      icon: CheckSquare,
      badge: true,
      isActive: pathname?.startsWith('/tasks')
    },
    { 
      label: 'Rotas', 
      href: '/deliveries', 
      icon: MapPin,
      isActive: pathname?.startsWith('/deliveries') || pathname?.startsWith('/routes')
    },
    { 
      label: 'Chat', 
      href: '/whatsapp', 
      icon: MessageSquare,
      isActive: pathname?.startsWith('/whatsapp') || pathname?.startsWith('/chat')
    },
    { 
      label: 'Menu', 
      href: '#',
      onClick: () => setIsMenuOpen(true),
      icon: Menu,
      isAction: true,
      isActive: isMenuOpen || pathname?.startsWith('/collaborators') || pathname?.startsWith('/profile')
    },
  ];

  // Itens adicionais para o menu expandido no mobile
  const allModules = [
    { href: user?.id ? `/collaborators/${user.id}` : '#', label: 'Meu Perfil', icon: User, show: true },
    { href: '/products', label: 'Catálogo de Peças', icon: Package, show: true },
    { href: '/demands', label: 'Demandas', icon: ListTodo, show: true },
    { href: '/routes', label: 'Rotas & GPS', icon: Truck, show: true },
    { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare, show: canAccessWhatsapp },
    { href: '/leads', label: 'Leads (CRM)', icon: Target, show: canAccessLeads },
    { href: '/social-media', label: 'Redes Sociais', icon: Share2, show: canAccessSocialMedia },
    { href: '/deliveries', label: 'Entregas', icon: Truck, show: canAccessDeliveries },
    { href: '/transfers', label: 'Transferências', icon: ArrowRightLeft, show: canAccessTransfers },
    { href: '/warranties', label: 'Garantias', icon: ShieldCheck, show: canAccessWarranties },
    { href: '/price-research', label: 'Pesquisa de Preço', icon: Tag, show: true },
    { href: '/sales-results', label: 'Vendas & Metas', icon: TrendingUp, show: canAccessSales },
    { href: '/reports', label: 'Relatórios', icon: BarChart3, show: canAccessReports },
    { href: '/collaborators', label: 'Equipe', icon: Users, show: isAdmin },
    { href: '/painel-ao-vivo', label: 'Painel Ao Vivo', icon: Radio, show: isAdmin },
  ].filter(item => item.show);

  return (
    <>
      {/* Barra de Navegação Inferior Fixa */}
      <nav 
        aria-label="Navegação móvel inferior"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.3)] safe-pb"
      >
        <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = !!item.isActive;

            const content = (
              <>
                <div className="relative flex items-center justify-center">
                  <Icon 
                    className={`w-5 h-5 mb-0.5 transition-transform duration-150 ${
                      active ? 'scale-110' : ''
                    }`} 
                  />
                  {/* Badge com animação de ping para tarefas e atualizações da equipe */}
                  {item.badge && (
                    <span className="absolute -top-1 -right-1.5 flex h-2.5 w-2.5" aria-hidden="true">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600 dark:bg-blue-500" />
                    </span>
                  )}
                  {/* Indicador de foco da aba ativa */}
                  {active && (
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight truncate font-medium">
                  {item.label}
                </span>
              </>
            );

            if (item.isAction) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`flex flex-col items-center justify-center flex-1 h-full min-w-[48px] py-1 transition-all duration-100 select-none active:scale-95 cursor-pointer ${
                    active
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href || '#'}
                onMouseEnter={() => prefetchRoute(item.href)}
                onTouchStart={() => prefetchRoute(item.href)}
                className={`flex flex-col items-center justify-center flex-1 h-full min-w-[48px] py-1 transition-all duration-100 select-none active:scale-95 ${
                  active
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Drawer / Menu Móvel com Botão de Sair e Navegação Completa */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Painel do Menu */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl p-5 pb-8 safe-pb flex flex-col space-y-4"
            >
              {/* Barra superior de arrasto */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-1 shrink-0" />

              {/* Cabeçalho do Usuário */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-600/20">
                    {user?.name ? user.name.substring(0, 2).toUpperCase() : 'US'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {user?.name || 'Usuário'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60 capitalize">
                        {isAdmin ? 'Administrador' : (role || 'Colaborador')}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Fechar menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Botões Rápidos de Ação: Tema e Configurações */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => toggleDarkMode(!isDarkMode)}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
                  <span>{isDarkMode ? 'Tema Claro' : 'Tema Escuro'}</span>
                </button>

                {isAdmin ? (
                  <Link
                    href="/admin/settings"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Settings size={16} className="text-slate-500" />
                    <span>Configurações</span>
                  </Link>
                ) : (
                  <Link
                    href={user?.id ? `/collaborators/${user.id}` : '#'}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <User size={16} className="text-blue-500" />
                    <span>Ver Meu Perfil</span>
                  </Link>
                )}
              </div>

              {/* Lista de Módulos */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                  Módulos e Recursos
                </p>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {allModules.map((item) => {
                    const Icon = item.icon;
                    const isCurrent = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-medium transition-colors ${
                          isCurrent
                            ? 'bg-blue-50 text-blue-600 font-semibold dark:bg-blue-950/60 dark:text-blue-400'
                            : 'bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon size={16} className={isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Botão de Sair do Aplicativo em Destaque */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-sm border border-rose-200/80 dark:border-rose-900/60 transition-all active:scale-[0.98] cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <LogOut size={18} />
                  <span>{isLoggingOut ? 'Saindo do aplicativo...' : 'Sair do Aplicativo'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default BottomNav;

