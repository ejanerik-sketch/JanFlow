'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.error("Error fetching profile:", error);
      }
        
      if (data) {
        setUserData({
          uid: data.id,
          name: data.name || 'Usuário',
          email: data.email,
          role: data.role,
          photoURL: data.photoURL || ''
        });
      } else {
        // Fallback if profile doesn't exist but user is logged in
        // This can happen if the trigger failed or user was created before trigger
        setUserData({
          uid: userId,
          name: 'Usuário',
          email: user?.email || '',
          role: 'analista', // Default role
          photoURL: ''
        });
      }
    } catch (err) {
      console.error("Exception in fetchProfile:", err);
    }
  };

  const safeAwait = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn('Request timed out, using fallback');
        resolve(fallback);
      }, ms);
      
      promise.then(
        (res) => {
          clearTimeout(timeoutId);
          resolve(res);
        },
        (err) => {
          clearTimeout(timeoutId);
          console.error('Request failed:', err);
          resolve(fallback);
        }
      );
    });
  };

  useEffect(() => {
    // Escuta evento de emergência disparado pelo interceptor caso ocorra 502/503
    const handleAuthUnavailable = (event: any) => {
      console.warn('[AppContext] Serviço de autenticação indisponível detectado:', event?.detail);
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

    const checkSession = async () => {
      try {
        const sessionResult = await safeAwait(
          supabase.auth.getSession() as any,
          5000,
          { data: { session: null } }
        );
        const session = (sessionResult as any)?.data?.session;
        
        if (session?.user) {
          setUser({ uid: session.user.id, email: session.user.email });
          await safeAwait(
            fetchProfile(session.user.id),
            5000,
            undefined
          );
        } else {
          setUser(null);
          setUserData(null);
        }
      } catch (error) {
        console.error("Error checking session:", error);
        setUser(null);
        setUserData(null);
      } finally {
        setIsAuthReady(true);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      try {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserData(null);
          return;
        }

        if (session?.user) {
          setUser({ uid: session.user.id, email: session.user.email });
          await safeAwait(
            fetchProfile(session.user.id),
            5000,
            undefined
          );
        } else {
          setUser(null);
          setUserData(null);
        }
      } catch (error) {
        console.error("Error in auth state change:", error);
      } finally {
        setIsAuthReady(true);
      }
    });

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('janflow:auth_service_unavailable', handleAuthUnavailable);
      }
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserData = async () => {
    if (user?.uid) {
      await fetchProfile(user.uid);
    }
  };

  const isAdmin = userData?.role === 'admin' || user?.email === 'ejanerik@gmail.com' || user?.email === 'ramiro.developper@gmail.com';
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
