'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import { 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Moon, 
  Globe, 
  Save,
  Building2,
  UserCircle2,
  Lock,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { user, userData, isAuthReady, context } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    notifications: true,
    darkMode: false,
    language: 'pt-BR'
  });

  useEffect(() => {
    if (isAuthReady && !user) {
      router.push('/login');
    }
  }, [user, isAuthReady, router]);

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        email: user?.email || '',
        role: userData.role || 'Usuário',
        notifications: userData.notifications ?? true,
        darkMode: userData.darkMode ?? false,
        language: userData.language || 'pt-BR'
      });
    }
  }, [userData, user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        name: formData.name,
        notifications: formData.notifications,
        darkMode: formData.darkMode,
        language: formData.language
      });
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthReady || !user) return null;

  const isBusiness = context === 'empresa';
  const themeColor = isBusiness ? 'text-[#1d8490]' : 'text-[#ff6330]';
  const themeBg = isBusiness ? 'bg-[#1d8490]' : 'bg-[#ff6330]';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-on-surface">Configurações</h2>
            <p className="text-on-surface-variant font-medium mt-1">Personalize sua experiência no JanFlow.</p>
          </div>
          {message && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold border shadow-sm",
                message.type === 'success' ? "bg-success/10 text-success border-success/20" : "bg-error/10 text-error border-error/20"
              )}
            >
              {message.text}
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Navigation Tabs */}
          <div className="space-y-2">
            {[
              { id: 'profile', label: 'Perfil', icon: User },
              { id: 'security', label: 'Segurança', icon: Shield },
              { id: 'notifications', label: 'Notificações', icon: Bell },
              { id: 'appearance', label: 'Aparência', icon: Moon },
              { id: 'preferences', label: 'Preferências', icon: Globe },
            ].map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all",
                  tab.id === 'profile' ? themeBg + " text-white shadow-lg" : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                <div className="flex items-center gap-3">
                  <tab.icon size={18} />
                  <span>{tab.label}</span>
                </div>
                <ChevronRight size={16} className={tab.id === 'profile' ? "opacity-100" : "opacity-0"} />
              </button>
            ))}
          </div>

          {/* Settings Content */}
          <div className="md:col-span-2 space-y-8">
            {/* Profile Section */}
            <section className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm space-y-8">
              <div className="flex items-center gap-4">
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white", themeBg)}>
                  <User size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-on-surface">Informações do Perfil</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Atualize seus dados pessoais.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                    <input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      placeholder="Seu nome"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                    <input
                      value={formData.email}
                      disabled
                      className="w-full pl-12 pr-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-medium ml-1">O e-mail não pode ser alterado diretamente.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Cargo / Função</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                    <input
                      value={formData.role}
                      disabled
                      className="w-full pl-12 pr-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold opacity-50 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Preferences Section */}
            <section className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm space-y-8">
              <h3 className="text-xl font-black text-on-surface">Preferências do Sistema</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                      <Bell size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Notificações por E-mail</p>
                      <p className="text-xs text-on-surface-variant font-medium">Receba alertas sobre vencimentos.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFormData({ ...formData, notifications: !formData.notifications })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      formData.notifications ? "bg-success" : "bg-outline-variant"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      formData.notifications ? "left-7" : "left-1"
                    )}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                      <Moon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Modo Escuro</p>
                      <p className="text-xs text-on-surface-variant font-medium">Ajuste o brilho da interface.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFormData({ ...formData, darkMode: !formData.darkMode })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      formData.darkMode ? "bg-success" : "bg-outline-variant"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      formData.darkMode ? "left-7" : "left-1"
                    )}></div>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Idioma</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={loading}
                className={cn(
                  "px-10 py-4 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50",
                  themeBg
                )}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save size={20} />
                )}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
