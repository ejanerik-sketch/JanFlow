'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';

type ContextType = 'empresa' | 'pessoal';

interface AppContextType {
  user: any | null;
  userData: any | null;
  context: ContextType;
  setContext: (context: ContextType) => void;
  isAuthReady: boolean;
  isAdmin: boolean;
  isFinanceiro: boolean;
  isAnalista: boolean;
  refreshUserData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [context, setContext] = useState<ContextType>('empresa');
  const [isAuthReady, setIsAuthReady] = useState(false);

  const syncStateWithPocketBase = () => {
    if (pb.authStore.isValid && pb.authStore.model) {
      const model = pb.authStore.model;
      setUser({ uid: model.id, email: model.email });
      setUserData({
        uid: model.id,
        name: model.name || 'Usuário',
        email: model.email,
        role: model.role || 'analista',
        photoURL: model.photoURL || ''
      });
    } else {
      setUser(null);
      setUserData(null);
    }
    setIsAuthReady(true);
  };

  useEffect(() => {
    const handleAuthUnavailable = (event: any) => {
      console.warn('[AppContext] Serviço indisponível:', event?.detail);
      pb.authStore.clear();
      setUser(null);
      setUserData(null);
      setIsAuthReady(true);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?error=service_unavailable';
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('janflow:auth_service_unavailable', handleAuthUnavailable);
    }

    // Inicialização da Sessão
    syncStateWithPocketBase();

    // Ouvinte de mudança de sessão
    const unsubscribe = pb.authStore.onChange((token, model) => {
      syncStateWithPocketBase();
    });

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('janflow:auth_service_unavailable', handleAuthUnavailable);
      }
      unsubscribe();
    };
  }, []);

  const refreshUserData = async () => {
    if (pb.authStore.isValid && pb.authStore.model) {
      try {
        await pb.collection('users').authRefresh();
        syncStateWithPocketBase();
      } catch (err) {
        console.error('Falha ao atualizar dados do usuário:', err);
      }
    }
  };

  const isAdmin = userData?.role === 'admin' || user?.email === 'ejanerik@gmail.com';
  const isFinanceiro = userData?.role === 'financeiro' || isAdmin;
  const isAnalista = !isAdmin && !isFinanceiro;

  return (
    <AppContext.Provider value={{ 
      user, 
      userData, 
      context, 
      setContext, 
      isAuthReady,
      isAdmin,
      isFinanceiro,
      isAnalista,
      refreshUserData
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
