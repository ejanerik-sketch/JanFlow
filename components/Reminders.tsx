'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, CheckCircle2, Clock, Check, Mail, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDB } from '@/lib/localDB';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/context/AppContext';
import { format, differenceInDays, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function Reminders() {
  const [isOpen, setIsOpen] = useState(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{id: string, status: 'success'|'error'} | null>(null);
  const { user, context } = useAppContext();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadReminders = async () => {
    if (!user) return;
    
    try {
      const transactions = await localDB.get('transactions', user.uid, context);
      
      const today = new Date();
      // Reset time for accurate day difference
      today.setHours(0, 0, 0, 0);
      
      const upcoming = transactions.filter((t: any) => {
        if (t.status === 'pago' || t.status === 'recebido') return false;
        
        const txDate = parseISO(t.date);
        txDate.setHours(0, 0, 0, 0);
        
        const daysDiff = differenceInDays(txDate, today);
        
        // Include overdue and upcoming within 3 days
        return daysDiff <= 3;
      });

      // Sort by date (oldest first, meaning most overdue first)
      upcoming.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setReminders(upcoming);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
    const interval = setInterval(loadReminders, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user, context]);

  const markAsPaid = async (e: React.MouseEvent, transaction: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const newStatus = transaction.type === 'receita' ? 'recebido' : 'pago';
      await localDB.save('transactions', {
        ...transaction,
        status: newStatus
      });
      
      // Remove from list immediately for better UX
      setReminders(prev => prev.filter(r => r.id !== transaction.id));
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const sendEmailReminder = async (e: React.MouseEvent, transaction: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.email) return;
    
    setSendingEmailId(transaction.id);
    setEmailStatus(null);
    
    try {
      const customSubject = localStorage.getItem(`janflow_email_subject_${user.uid}`) || undefined;
      const customHtml = localStorage.getItem(`janflow_email_html_${user.uid}`) || undefined;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transactionName: transaction.entityName,
          value: transaction.value,
          dueDate: format(parseISO(transaction.date), 'dd/MM/yyyy'),
          type: transaction.type,
          customSubject,
          customHtml
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send email');
      }
      
      setEmailStatus({ id: transaction.id, status: 'success' });
      setTimeout(() => setEmailStatus(null), 3000);
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailStatus({ id: transaction.id, status: 'error' });
      setTimeout(() => setEmailStatus(null), 3000);
    } finally {
      setSendingEmailId(null);
    }
  };

  const getStatusColor = (date: string) => {
    const txDate = parseISO(date);
    txDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysDiff = differenceInDays(txDate, today);
    
    if (daysDiff < 0) return 'text-error bg-error/10 border-error/20';
    if (daysDiff === 0) return 'text-warning bg-warning/10 border-warning/20';
    return 'text-primary bg-primary/10 border-primary/20';
  };

  const getStatusText = (date: string) => {
    const txDate = parseISO(date);
    txDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysDiff = differenceInDays(txDate, today);
    
    if (daysDiff < 0) return `Atrasado há ${Math.abs(daysDiff)} dia(s)`;
    if (daysDiff === 0) return 'Vence hoje';
    if (daysDiff === 1) return 'Vence amanhã';
    return `Vence em ${daysDiff} dias`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
      >
        <Bell size={20} />
        {reminders.length > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface animate-pulse"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-outline-variant/30 rounded-2xl shadow-xl overflow-hidden z-50"
          >
            <div className="p-4 border-b border-outline-variant/30 bg-surface-container-lowest flex items-center justify-between">
              <h3 className="font-bold text-on-surface flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                Lembretes
              </h3>
              <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">
                {reminders.length} pendentes
              </span>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-on-surface-variant">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm">Carregando...</p>
                </div>
              ) : reminders.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant flex flex-col items-center">
                  <CheckCircle2 size={32} className="text-success mb-2 opacity-50" />
                  <p className="text-sm font-medium">Tudo em dia!</p>
                  <p className="text-xs mt-1">Nenhuma conta próxima do vencimento.</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/20">
                  {reminders.map((reminder) => (
                    <div key={reminder.id} className="p-4 hover:bg-surface-container-lowest transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 pr-4">
                          <p className="text-sm font-bold text-on-surface line-clamp-1">
                            {reminder.entityName}
                          </p>
                          <p className="text-xs text-on-surface-variant line-clamp-1">
                            {reminder.description || reminder.category}
                          </p>
                        </div>
                        <p className={cn(
                          "text-sm font-bold whitespace-nowrap",
                          reminder.type === 'receita' ? "text-success" : "text-error"
                        )}>
                          {reminder.type === 'receita' ? '+' : '-'}{formatCurrency(reminder.value)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1",
                          getStatusColor(reminder.date)
                        )}>
                          {differenceInDays(parseISO(reminder.date), new Date()) < 0 ? (
                            <AlertCircle size={12} />
                          ) : (
                            <Clock size={12} />
                          )}
                          {getStatusText(reminder.date)}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => sendEmailReminder(e, reminder)}
                            disabled={sendingEmailId === reminder.id}
                            className={cn(
                              "opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold flex items-center justify-center w-8 h-8 rounded-md",
                              emailStatus?.id === reminder.id && emailStatus?.status === 'success' ? "text-success bg-success/10" :
                              emailStatus?.id === reminder.id && emailStatus?.status === 'error' ? "text-error bg-error/10" :
                              "text-primary hover:bg-primary/10"
                            )}
                            title="Enviar lembrete por e-mail"
                          >
                            {sendingEmailId === reminder.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : emailStatus?.id === reminder.id && emailStatus?.status === 'success' ? (
                              <Check size={14} />
                            ) : emailStatus?.id === reminder.id && emailStatus?.status === 'error' ? (
                              <AlertCircle size={14} />
                            ) : (
                              <Mail size={14} />
                            )}
                          </button>
                          <button
                            onClick={(e) => markAsPaid(e, reminder)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold flex items-center gap-1 text-success hover:bg-success/10 px-2 py-1 rounded-md"
                          >
                            <Check size={14} />
                            {reminder.type === 'receita' ? 'Recebido' : 'Pago'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {reminders.length > 0 && (
              <div className="p-3 border-t border-outline-variant/30 bg-surface-container-lowest text-center">
                <Link 
                  href="/transactions" 
                  className="text-xs font-bold text-primary hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  Ver todos os lançamentos
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
