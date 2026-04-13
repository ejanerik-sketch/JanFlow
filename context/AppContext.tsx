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

  // Helper function for timeout that cleans up after itself
  const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutId);
    });
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          10000,
          'Timeout checking session'
        );
        
        if (session?.user) {
          setUser({ uid: session.user.id, email: session.user.email });
          await withTimeout(
            fetchProfile(session.user.id),
            10000,
            'Timeout fetching profile'
          );
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setIsAuthReady(true);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      try {
        if (session?.user) {
          setUser({ uid: session.user.id, email: session.user.email });
          await withTimeout(
            fetchProfile(session.user.id),
            10000,
            'Timeout fetching profile'
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
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserData = async () => {
    if (user?.uid) {
      await fetchProfile(user.uid);
    }
  };

  const isAdmin = userData?.role === 'admin';
  const isFinanceiro = userData?.role === 'financeiro';
  const isAnalista = userData?.role === 'analista';

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
