'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, LockKeyhole, Wallet, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { user, isAuthReady } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'service_unavailable') {
        setError('O servidor de autenticação esteve temporariamente indisponível (503/502). As conexões em loop foram interrompidas para proteção. Faça login novamente.');
      }
    }

    if (isAuthReady && user) {
      router.push('/');
    }
  }, [user, isAuthReady, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError('E-mail ou senha incorretos.');
      } else if (data.session) {
        window.location.href = '/';
      }
    } catch (err) {
      setError('Ocorreu um erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    setSuccess(null);
    if (!email) {
      setError('Por favor, insira seu e-mail para redefinir a senha.');
      return;
    }
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        setError('Erro ao enviar e-mail de redefinição.');
      } else {
        setSuccess('Instruções de redefinição enviadas para o seu e-mail.');
      }
    } catch (err) {
      setError('Erro ao processar solicitação.');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4fbfa]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1d8490]"></div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-[#f4fbfa] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Shapes */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#1d8490]/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#ff6330]/10 rounded-full blur-3xl"></div>

      <main className="w-full max-w-[440px] relative">
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-[0_20px_40px_rgba(22,29,29,0.06)] overflow-hidden">
          {/* Branding */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#f4fbfa] rounded-2xl mb-6">
              <Wallet className="text-[#1d8490]" size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#161d1d]">JanFlow</h1>
            <p className="text-[#3e494a] mt-2 text-sm font-medium">Bem-vindo ao seu cockpit financeiro.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-error/10 text-error text-sm rounded-xl font-medium border border-error/20">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-success/10 text-success text-sm rounded-xl font-medium border border-success/20">
              {success}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#3e494a] mb-2 ml-1" htmlFor="email">
                Endereço de E-mail
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#6e797b]">
                  <Mail size={20} />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-[#e8efef] border-none rounded-xl text-[#161d1d] focus:ring-2 focus:ring-[#1d8490]/20 focus:bg-white transition-all duration-200 placeholder:text-[#6e797b]"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2 ml-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3e494a]" htmlFor="password">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs font-bold text-[#1d8490] hover:text-[#16808c] transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#6e797b]">
                  <Lock size={20} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-[#e8efef] border-none rounded-xl text-[#161d1d] focus:ring-2 focus:ring-[#1d8490]/20 focus:bg-white transition-all duration-200 placeholder:text-[#6e797b]"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#6e797b] hover:text-[#161d1d] transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex items-center px-1">
              <input
                id="remember"
                type="checkbox"
                className="w-5 h-5 rounded border-[#bdc8ca] text-[#1d8490] focus:ring-[#1d8490]/20 bg-[#e8efef]"
              />
              <label className="ml-3 text-sm text-[#3e494a] font-medium" htmlFor="remember">
                Mantenha-me conectado por 30 dias
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1d8490] hover:bg-[#16808c] text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg shadow-[#1d8490]/10 active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex items-center justify-center gap-6 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} />
            <span className="text-[10px] font-black tracking-widest uppercase">Segurança de Nível Bancário</span>
          </div>
          <div className="w-px h-4 bg-[#bdc8ca]"></div>
          <div className="flex items-center gap-2">
            <LockKeyhole size={18} />
            <span className="text-[10px] font-black tracking-widest uppercase">Criptografado AES-256</span>
          </div>
        </div>
      </main>
    </div>
  );
}
