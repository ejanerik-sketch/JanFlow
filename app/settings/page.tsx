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
  ChevronRight,
  FileText,
  Settings
} from 'lucide-react';
import { motion } from 'motion/react';
import { pb } from '@/lib/pocketbase';
import { cn } from '@/lib/utils';
import UsersSettings from '@/components/UsersSettings';

export default function SettingsPage() {
  const router = useRouter();
  const { user, userData, isAuthReady, context, refreshUserData, isAdmin, isFinanceiro } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('notifications');
  const [sendingReport, setSendingReport] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    setMessage(null);
  }, [activeTab]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    notifications: true,
    darkMode: false,
    language: 'pt-BR',
    emailSubject: '',
    emailHtml: '',
    reportDay: '03',
    reportPeriod: 'mes_anterior',
    reportEmails: 'ejanerikl@gmail.com, neilalima@hotmail.com',
    reportOptions: {
      resume: true,
      category: true,
      business: true,
      personal: true,
      alerts: true
    }
  });

  useEffect(() => {
    if (isAuthReady && !user) {
      router.push('/login');
    }
  }, [user, isAuthReady, router]);

  useEffect(() => {
    if (userData && user) {
      const savedSubject = localStorage.getItem(`janflow_email_subject_${user.uid}`);
      const savedHtml = localStorage.getItem(`janflow_email_html_${user.uid}`);
      
      const savedPrefs = JSON.parse(localStorage.getItem(`janflow_prefs_${user.uid}`) || '{}');

      setFormData({
        name: userData.name || '',
        email: user?.email || '',
        role: userData.role || 'Usuário',
        notifications: savedPrefs.notifications ?? true,
        darkMode: savedPrefs.darkMode ?? false,
        language: savedPrefs.language || 'pt-BR',
        reportDay: savedPrefs.reportDay || '03',
        reportPeriod: savedPrefs.reportPeriod || 'mes_anterior',
        reportEmails: savedPrefs.reportEmails || 'ejanerikl@gmail.com, neilalima@hotmail.com',
        reportOptions: savedPrefs.reportOptions || {
          resume: true,
          category: true,
          business: true,
          personal: true,
          alerts: true
        },
        emailSubject: savedSubject || '[JanFlow] Lembrete: {{transactionName}}',
        emailHtml: savedHtml || `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
  <h2 style="color: #1d8490;">{{titleText}}</h2>
  <p>Olá,</p>
  <p>Este é um lembrete automático do JanFlow sobre uma transação que está próxima do vencimento ou atrasada.</p>
  
  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0;"><strong>Descrição:</strong> {{transactionName}}</p>
    <p style="margin: 0 0 10px 0;"><strong>Valor:</strong> {{value}}</p>
    <p style="margin: 0 0 10px 0;"><strong>Vencimento:</strong> {{dueDate}}</p>
    <p style="margin: 0;"><strong>Tipo:</strong> {{type}}</p>
  </div>
  
  <p>Por favor, lembre-se de {{actionText}} este valor e atualizar o status no sistema.</p>
  <p>Abraços,<br>Equipe JanFlow</p>
</div>`
      });
    }
  }, [userData, user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    try {
      const profileError = await pb.collection('users').update(user.uid, { name: formData.name }).catch(err => err);
      if (profileError instanceof Error) throw profileError;

      // Preferências de UI (sem coluna no schema) e template de e-mail → localStorage
      localStorage.setItem(`janflow_prefs_${user.uid}`, JSON.stringify({
        notifications: formData.notifications,
        darkMode: formData.darkMode,
        language: formData.language,
        reportDay: formData.reportDay,
        reportPeriod: formData.reportPeriod,
        reportEmails: formData.reportEmails,
        reportOptions: formData.reportOptions
      }));
      localStorage.setItem(`janflow_email_subject_${user.uid}`, formData.emailSubject);
      localStorage.setItem(`janflow_email_html_${user.uid}`, formData.emailHtml);

      await refreshUserData();
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
              { id: 'notifications', label: 'Notificações', icon: Bell },
              { id: 'reports', label: 'Relatórios', icon: FileText },
              { id: 'appearance', label: 'Aparência', icon: Moon },
              { id: 'preferences', label: 'Preferências', icon: Globe },
              ...(isAdmin || isFinanceiro ? [{ id: 'users', label: 'Usuários', icon: User }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all",
                  activeTab === tab.id ? themeBg + " text-white shadow-lg" : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                <div className="flex items-center gap-3">
                  <tab.icon size={18} />
                  <span>{tab.label}</span>
                </div>
                <ChevronRight size={16} className={activeTab === tab.id ? "opacity-100" : "opacity-0"} />
              </button>
            ))}
          </div>

          {/* Settings Content */}
          <div className="md:col-span-2 space-y-8 min-h-[60vh]">
            {/* Appearance Section */}
            {activeTab === 'appearance' && (
            <section className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-xl font-black text-on-surface">Aparência e Idioma</h3>
              
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
            )}

            {/* Reports Section */}
            {activeTab === 'reports' && (
            <section className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500" id="reports">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white bg-[#f97316]">
                  <FileText size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-on-surface">Relatórios Automatizados</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Configure os envios mensais automáticos para seu e-mail.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Dia de Envio</label>
                    <select
                      value={formData.reportDay}
                      onChange={(e) => setFormData({ ...formData, reportDay: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#f97316]/20"
                    >
                      <option value="01">Dia 01</option>
                      <option value="03">Dia 03</option>
                      <option value="15">Dia 15</option>
                      <option value="ultimo">Último dia do mês</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Período de Análise</label>
                    <select
                      value={formData.reportPeriod || 'mes_anterior'}
                      onChange={(e) => setFormData({ ...formData, reportPeriod: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#f97316]/20"
                    >
                      <option value="7_dias">Últimos 7 dias</option>
                      <option value="30_dias">Últimos 30 dias</option>
                      <option value="mes_atual">Mês Atual</option>
                      <option value="mes_anterior">Mês Anterior</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">E-mails que Receberão o Relatório (Separados por vírgula)</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                    <input
                      value={formData.reportEmails}
                      onChange={(e) => setFormData({ ...formData, reportEmails: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#f97316]/20"
                      placeholder="email1@ex.com, email2@ex.com"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-outline-variant/20">
                  <h4 className="text-sm font-bold text-on-surface">Quais dados incluir no relatório?</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'resume', label: 'Resumo Geral (Receitas vs Despesas)' },
                      { key: 'category', label: 'Gastos por Categoria' },
                      { key: 'business', label: 'Balanço Empresarial' },
                      { key: 'personal', label: 'Balanço Pessoal' },
                      { key: 'alerts', label: 'Alertas e Dicas da NeilAi' }
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-high cursor-pointer transition-colors">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.reportOptions[opt.key as keyof typeof formData.reportOptions]}
                            onChange={(e) => setFormData({
                              ...formData,
                              reportOptions: {
                                ...formData.reportOptions,
                                [opt.key]: e.target.checked
                              }
                            })}
                            className="w-5 h-5 appearance-none rounded border-2 border-outline-variant checked:bg-[#f97316] checked:border-[#f97316] transition-all cursor-pointer"
                          />
                          <svg className="absolute left-[3px] top-[3px] w-3.5 h-3.5 text-white pointer-events-none" style={{ opacity: formData.reportOptions[opt.key as keyof typeof formData.reportOptions] ? 1 : 0 }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <span className="text-sm font-medium text-on-surface">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <button 
                    onClick={async () => {
                      setSendingReport(true);
                      setMessage(null);
                      try {
                        const token = pb.authStore.token;
                        const res = await fetch('/api/send-report', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({
                            emails: formData.reportEmails,
                            period: formData.reportPeriod,
                            options: formData.reportOptions
                          })
                        });
                        const data = await res.json();
                        
                        if (res.ok) {
                          setMessage({ type: 'success', text: `Resumo financeiro enviado com sucesso para: ${formData.reportEmails}` });
                        } else {
                          throw new Error(data.error || 'Erro ao enviar relatório');
                        }
                      } catch (err: any) {
                        setMessage({ type: 'error', text: err.message });
                      } finally {
                        setSendingReport(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    disabled={sendingReport}
                    className="px-6 py-3 bg-[#1a1a1a] text-white font-bold rounded-xl hover:bg-black transition-colors flex items-center gap-3 disabled:opacity-70 disabled:cursor-wait"
                  >
                    {sendingReport ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    )}
                    {sendingReport ? 'Enviando...' : 'Enviar Relatório Agora'}
                  </button>
                </div>
              </div>
            </section>
            )}

            {/* Notifications Section */}
            {activeTab === 'notifications' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm space-y-8">
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
              </section>

              {/* Email Template Section */}
              <section className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm space-y-8">
                <div>
                  <h3 className="text-xl font-black text-on-surface">Template de E-mail</h3>
                <p className="text-sm text-on-surface-variant mt-1">Personalize o e-mail de lembrete de vencimentos.</p>
              </div>
              
              <div className="space-y-6">
                <div className="bg-surface-container-high p-4 rounded-2xl text-xs font-mono text-on-surface-variant space-y-1">
                  <p className="font-bold text-on-surface mb-2">Variáveis disponíveis:</p>
                  <p><span className="text-primary font-bold">{`{{transactionName}}`}</span> - Nome da transação</p>
                  <p><span className="text-primary font-bold">{`{{value}}`}</span> - Valor formatado (ex: R$ 1.500,00)</p>
                  <p><span className="text-primary font-bold">{`{{dueDate}}`}</span> - Data de vencimento (ex: 15/04/2026)</p>
                  <p><span className="text-primary font-bold">{`{{type}}`}</span> - &quot;A Pagar&quot; ou &quot;A Receber&quot;</p>
                  <p><span className="text-primary font-bold">{`{{actionText}}`}</span> - &quot;pagar&quot; ou &quot;receber&quot;</p>
                  <p><span className="text-primary font-bold">{`{{titleText}}`}</span> - &quot;Lembrete de Pagamento&quot; ou &quot;Lembrete de Recebimento&quot;</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Assunto do E-mail</label>
                  <input
                    value={formData.emailSubject}
                    onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                    placeholder="[JanFlow] Lembrete: {{transactionName}}"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Corpo do E-mail (HTML)</label>
                  <textarea
                    value={formData.emailHtml}
                    onChange={(e) => setFormData({ ...formData, emailHtml: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary/20 min-h-[300px] resize-y"
                    placeholder="<div>...</div>"
                  />
                </div>
              </div>
            </section>
            </div>
            )}

            {/* Placeholder for missing tabs */}
            {activeTab === 'preferences' && (
              <section className="bg-surface-container-lowest p-12 rounded-[32px] border border-outline-variant/20 shadow-sm flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[400px]">
                <div className="w-16 h-16 bg-surface-container-high rounded-2xl flex items-center justify-center text-on-surface-variant mb-4">
                  <Settings size={32} />
                </div>
                <h3 className="text-2xl font-black text-on-surface">Em Breve</h3>
                <p className="text-on-surface-variant max-w-sm">Esta sessão está sendo desenvolvida e estará disponível nas próximas atualizações.</p>
              </section>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <UsersSettings />
            )}

            {/* Save Button */}
            {activeTab !== 'users' && (
            <div className="flex justify-end pt-4">
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
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
