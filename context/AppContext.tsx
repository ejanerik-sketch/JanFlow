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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (data) {
      setUserData({
        uid: data.id,
        name: data.name || 'Usuário',
        email: data.email,
        role: data.role,
        photoURL: data.photoURL || ''
      });
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Add a timeout to prevent hanging if Supabase is blocked or waking up
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout checking session')), 15000)
        );
        
        const sessionPromise = supabase.auth.getSession();
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        if (session?.user) {
          setUser({ uid: session.user.id, email: session.user.email });
          
          const profilePromise = fetchProfile(session.user.id);
          await Promise.race([profilePromise, timeoutPromise]);
        }
      } catch (error) {
        console.error("Error checking session:", error);
        // If there's an error (like timeout), we still want to set auth ready so the user isn't stuck
        // We might want to clear the user if it's a network error, but let's just log it for now
      } finally {
        setIsAuthReady(true);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      try {
        if (session?.user) {
          setUser({ uid: session.user.id, email: session.user.email });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout fetching profile')), 15000)
          );
          
          const profilePromise = fetchProfile(session.user.id);
          await Promise.race([profilePromise, timeoutPromise]);
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
