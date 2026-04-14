'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  Tags, 
  CreditCard, 
  BarChart3, 
  Settings, 
  LogOut, 
  User, 
  Bell, 
  Menu, 
  X,
  Building2,
  UserCircle2,
  ArrowRightLeft,
  Target,
  Plus,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import Reminders from './Reminders';
import { supabase } from '@/lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
}

const SidebarContent = ({ 
  context, 
  setContext, 
  isAdmin, 
  isFinanceiro,
  isAnalista,
  pathname, 
  handleLogout 
}: { 
  context: string, 
  setContext: (c: any) => void, 
  isAdmin: boolean, 
  isFinanceiro: boolean,
  isAnalista: boolean,
  pathname: string, 
  handleLogout: () => void 
}) => {
  const isBusiness = context === 'empresa';
  const themeColor = isBusiness ? 'text-[#1d8490]' : 'text-[#ff6330]';
  const themeBg = isBusiness ? 'bg-[#1d8490]' : 'bg-[#ff6330]';
  const themeActive = isBusiness ? 'bg-[#1d8490] text-white' : 'bg-[#ff6330] text-white';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/', analistaHidden: true },
    { name: 'Lançamentos', icon: ReceiptText, href: '/transactions', analistaHidden: true },
    { name: 'Categorias', icon: Tags, href: '/categories', adminOnly: true },
    { name: 'Orçamentos', icon: Target, href: '/budgets', analistaHidden: true },
    { name: 'Cartões', icon: CreditCard, href: '/cards', analistaHidden: true },
    { name: 'Relatórios', icon: BarChart3, href: '/reports' },
    { name: 'Clientes', icon: Building2, href: '/clients', adminOrFinanceiro: true, businessOnly: true },
    { name: 'Usuários', icon: User, href: '/users', adminOrFinanceiro: true },
  ];

  return (
    <div className="flex flex-col h-full py-6">
      <div className="px-6 mb-10">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white transition-colors duration-500", themeBg)}>
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-on-surface">JanFlow</h1>
            <p className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors duration-500", themeColor)}>
              gestão financeira integrada
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          if (item.adminOrFinanceiro && !isAdmin && !isFinanceiro) return null;
          if (item.analistaHidden && isAnalista) return null;
          if (item.businessOnly && !isBusiness) return null;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-300",
                isActive ? themeActive : "text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 mt-auto pt-10 space-y-4">
        {!isAnalista && (
          <button
            onClick={() => setContext(isBusiness ? 'pessoal' : 'empresa')}
            className={cn(
              "w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition-all duration-500 active:scale-95",
              isBusiness ? "bg-[#ff6330] text-white shadow-[#ff6330]/20" : "bg-[#1d8490] text-white shadow-[#1d8490]/20"
            )}
          >
            <ArrowRightLeft size={16} />
            <span>Mudar para {isBusiness ? 'Pessoal' : 'Empresa'}</span>
          </button>
        )}

        <div className="pt-8 border-t border-outline-variant/30">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-error transition-colors"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Layout({ children }: LayoutProps) {
  const { user, userData, context, setContext, isAdmin, isFinanceiro, isAnalista, isAuthReady } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isAuthReady && !user) {
      router.push('/login');
    } else if (isAuthReady && user && isAnalista && pathname !== '/reports') {
      router.push('/reports');
    }
  }, [user, isAuthReady, isAnalista, pathname, router]);

  const handleLogout = async () => {
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();
      localStorage.removeItem('janflow_user');
      window.location.href = '/login';
    } catch (error) {
      console.error("Error logging out:", error);
      // Fallback
      localStorage.removeItem('janflow_user');
      window.location.href = '/login';
    }
  };

  const isBusiness = context === 'empresa';
  const themeColor = isBusiness ? 'text-[#1d8490]' : 'text-[#ff6330]';
  const themeBorder = isBusiness ? 'border-[#1d8490]' : 'border-[#ff6330]';

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 border-r border-outline-variant/30 bg-surface-container-lowest fixed h-full z-50">
        <SidebarContent 
          context={context} 
          setContext={setContext} 
          isAdmin={isAdmin} 
          isFinanceiro={isFinanceiro}
          isAnalista={isAnalista}
          pathname={pathname} 
          handleLogout={handleLogout} 
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Navigation */}
        <header className="h-16 border-b border-outline-variant/30 bg-surface/60 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg"
            >
              <Menu size={24} />
            </button>

            {!isAnalista && (
              <div className="flex items-center gap-4 ml-4">
                <div className="hidden sm:flex bg-surface-container-high rounded-full p-1 w-64 shadow-inner">
                  <button
                    onClick={() => setContext('empresa')}
                    className={cn(
                      "flex-1 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all duration-500",
                      isBusiness ? "bg-[#1d8490] text-white shadow-sm" : "text-on-surface-variant"
                    )}
                  >
                    <Building2 size={14} />
                    Empresa
                  </button>
                  <button
                    onClick={() => setContext('pessoal')}
                    className={cn(
                      "flex-1 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all duration-500",
                      !isBusiness ? "bg-[#ff6330] text-white shadow-sm" : "text-on-surface-variant"
                    )}
                  >
                    <UserCircle2 size={14} />
                    Pessoal
                  </button>
                </div>
                <Link
                  href="/transactions?new=true"
                  className={cn(
                    "hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95",
                    isBusiness ? "bg-[#1d8490] shadow-[#1d8490]/20" : "bg-[#ff6330] shadow-[#ff6330]/20"
                  )}
                >
                  <Plus size={16} />
                  Novo Lançamento
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Sync Status Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-container-high border border-outline-variant/20" title="Status de conexão com o banco de dados">
              <div className="relative flex items-center justify-center w-4 h-4">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-20 animate-ping"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Sincronizado</span>
            </div>

            <Reminders />
            <button 
              onClick={() => {
                localStorage.removeItem('janflow_user');
                window.location.href = '/login';
              }}
              className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-full transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
            <div className="h-8 w-px bg-outline-variant/30"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface">{userData?.name || user?.email}</p>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">{userData?.role || 'Usuário'}</p>
              </div>
              <div className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center overflow-hidden transition-colors duration-500", themeBorder)}>
                {userData?.photoURL ? (
                  <Image src={userData.photoURL} alt={userData.name || 'User'} width={40} height={40} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={24} className={themeColor} />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname + context}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest z-[70] lg:hidden"
            >
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg"
              >
                <X size={24} />
              </button>
              <SidebarContent 
                context={context} 
                setContext={setContext} 
                isAdmin={isAdmin} 
                isFinanceiro={isFinanceiro}
                isAnalista={isAnalista}
                pathname={pathname} 
                handleLogout={handleLogout} 
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
