'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar,
  X,
  Check,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  Upload,
  RefreshCw,
  CreditCard,
  Building
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDB } from '@/lib/localDB';
import { format, startOfMonth, endOfMonth, isWithinInterval, getYear, setYear, setMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, parseLocalDate, toDbDate } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const transactionSchema = z.object({
  type: z.enum(['receita', 'despesa']),
  category: z.string().min(1, 'Categoria é obrigatória'),
  entityName: z.string().min(1, 'Nome da entidade é obrigatório'),
  description: z.string().optional(),
  value: z.number().min(0.01, 'Valor deve ser maior que zero'),
  date: z.string().min(1, 'Data é obrigatória'),
  renewalDate: z.string().optional(),
  status: z.string().min(1, 'Status é obrigatório'),
  paymentMethod: z.string().min(1, 'Método de pagamento é obrigatório'),
  cardId: z.string().optional(),
  isInstallment: z.boolean().optional(),
  installments: z.number().min(1).default(1),
  firstInstallmentDate: z.string().optional(),
  otherEntityName: z.string().optional(),
  isRecurringCreditCard: z.boolean().optional(),
  recurrent: z.boolean(),
  observation: z.string().optional(),
  isShared: z.boolean().optional(),
  sharedWith: z.string().optional(),
  sharedSplit: z.string().optional(),
}).refine((data) => {
  if (['cartao_credito', 'cartao_debito'].includes(data.paymentMethod) && !data.cardId) {
    return false;
  }
  return true;
}, {
  message: "Selecione um cartão para o pagamento",
  path: ["cardId"],
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthReady, context, isAdmin, isFinanceiro } = useAppContext();
  const isBusiness = context === 'empresa';
  const themeColor = isBusiness ? 'text-[#1d8490]' : 'text-[#ff6330]';
  const themeBg = isBusiness ? 'bg-[#1d8490]' : 'bg-[#ff6330]';
  const themeBorder = isBusiness ? 'border-[#1d8490]' : 'border-[#ff6330]';

  const [transactions, setTransactions] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [loading, setLoading] = useState(false);
  const [relatedInstallments, setRelatedInstallments] = useState<any[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isPreviousMonthSearchOpen, setIsPreviousMonthSearchOpen] = useState(false);
  const [previousMonthTransactions, setPreviousMonthTransactions] = useState<any[]>([]);
  const [sharedSplitState, setSharedSplitState] = useState<Record<string, number>>({});
  const [iParticipate, setIParticipate] = useState(true);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: {
      type: 'despesa',
      status: 'a_receber',
      paymentMethod: 'pix',
      recurrent: false,
      installments: 1,
      date: format(new Date(), 'yyyy-MM-dd'),
    }
  });

  const transactionType = watch('type');
  const paymentMethod = watch('paymentMethod');
  const watchedValue = watch('value');
  const watchedInstallments = watch('installments');
  const watchedDate = watch('date');
  const watchedStatus = watch('status');
  const isInstallment = watch('isInstallment');
  const firstInstallmentDate = watch('firstInstallmentDate');
  const isRecurringCreditCard = watch('isRecurringCreditCard');
  const entityName = watch('entityName');
  const watchedCardId = watch('cardId');
  const watchedIsShared = watch('isShared');
  const watchedSharedWith = watch('sharedWith');

  // Auto-calculate shared split when people or value changes
  useEffect(() => {
    if (!watchedIsShared || !watchedSharedWith || !watchedValue) return;
    const people = watchedSharedWith.split(',').map((p: string) => p.trim()).filter(Boolean);
    if (people.length === 0) return;
    
    // Only auto-split if there's no existing custom split or if people list changed
    const existingPeople = Object.keys(sharedSplitState);
    const peopleChanged = people.length !== existingPeople.length || 
      people.some((p: string) => !existingPeople.some(ep => ep.toLowerCase() === p.toLowerCase()));
    
    if (peopleChanged || existingPeople.length === 0) {
      const totalPeople = iParticipate ? people.length + 1 : people.length;
      const perPerson = Math.round((watchedValue / totalPeople) * 100) / 100;
      const newSplit: Record<string, number> = {};
      people.forEach((p: string) => { newSplit[p] = perPerson; });
      setSharedSplitState(newSplit);
    }
  }, [watchedIsShared, watchedSharedWith, watchedValue, iParticipate]);

  useEffect(() => {
    if (transactionType === 'receita' && !isBusiness && paymentMethod === 'cartao_credito') {
      setValue('paymentMethod', 'pix');
    }
  }, [transactionType, isBusiness, paymentMethod, setValue]);

  const loadPreviousMonthTransactions = async () => {
    if (!user) return;
    const prevMonthDate = addMonths(selectedMonth, -1);
    const start = startOfMonth(prevMonthDate);
    const end = endOfMonth(prevMonthDate);

    const allTrans = await localDB.get('transactions', user.uid, context);
    const filtered = allTrans.filter((t: any) => {
      const tDate = parseLocalDate(t.date);
      return isWithinInterval(tDate, { start, end }) && t.type === transactionType;
    });

    setPreviousMonthTransactions(filtered);
    setIsPreviousMonthSearchOpen(true);
  };

  const pullRecurringFromPrevious = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const prevMonthDate = addMonths(selectedMonth, -1);
      const startPrev = startOfMonth(prevMonthDate);
      const endPrev = endOfMonth(prevMonthDate);
      
      const startCurr = startOfMonth(selectedMonth);
      const endCurr = endOfMonth(selectedMonth);

      // Load previous month's transactions
      const allTrans = await localDB.get('transactions', user.uid, context);
      
      // Filter recurrent from previous month
      const prevRecurrent = allTrans.filter((t: any) => {
        const tDate = parseLocalDate(t.date);
        return isWithinInterval(tDate, { start: startPrev, end: endPrev }) && t.recurrent;
      });

      // Filter recurrent already in current month (to prevent duplicates)
      const currRecurrent = allTrans.filter((t: any) => {
        const tDate = parseLocalDate(t.date);
        return isWithinInterval(tDate, { start: startCurr, end: endCurr }) && t.recurrent;
      });

      const toClone = prevRecurrent.filter((prevTx: any) => {
        return !currRecurrent.some((currTx: any) => 
          currTx.entityName === prevTx.entityName && 
          currTx.value === prevTx.value &&
          currTx.category === prevTx.category
        );
      });

      if (toClone.length === 0) {
        alert("Nenhum lançamento recorrente novo para importar do mês anterior.");
        return;
      }

      // Clone them with updated dates to the selected month
      const clonedPayloads = toClone.map((t: any) => {
        const prevDate = parseLocalDate(t.date);
        const newDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), prevDate.getDate(), 12, 0, 0);
        
        return {
          type: t.type,
          category: t.category,
          entityName: t.entityName,
          description: t.description || '',
          value: t.value,
          observation: t.observation || '',
          paymentMethod: t.paymentMethod,
          cardId: t.cardId || null,
          isInstallment: false,
          installments: 1,
          isShared: t.isShared || false,
          sharedWith: t.sharedWith || '',
          recurrent: true,
          uid: user.uid,
          context,
          date: toDbDate(format(newDate, 'yyyy-MM-dd')),
          createdAt: new Date().toISOString()
        };
      });

      await localDB.saveMany('transactions', clonedPayloads);
      triggerRefresh();
      alert(`${clonedPayloads.length} lançamentos recorrentes copiados com sucesso!`);
    } catch (err) {
      console.error("Error pulling recurrent transactions:", err);
      alert("Erro ao puxar lançamentos recorrentes.");
    } finally {
      setLoading(false);
    }
  };

  const fillFromPrevious = (t: any) => {
    if (transactionType === 'receita' && isBusiness) {
      const isClient = clients.some(c => c.companyName === t.entityName);
      if (!isClient) {
        setValue('entityName', 'outro');
        setValue('otherEntityName', t.entityName);
      } else {
        setValue('entityName', t.entityName);
      }
    } else {
      setValue('entityName', t.entityName);
    }
    setValue('value', t.value);
    setValue('category', t.category);
    setValue('paymentMethod', t.paymentMethod);
    if (t.cardId) setValue('cardId', t.cardId);
    setValue('description', t.description);
    setValue('recurrent', t.recurrent || false);
    setIsPreviousMonthSearchOpen(false);
  };

  useEffect(() => {
    const fetchRelated = async () => {
      if (editingTransaction && editingTransaction.installments > 1 && user) {
        const allTrans = await localDB.get('transactions', user.uid, context);
        const related = allTrans.filter((t: any) => 
          (t.groupId && t.groupId === editingTransaction.groupId) ||
          (!t.groupId && t.entityName === editingTransaction.entityName && t.installments === editingTransaction.installments &&
           Math.abs(new Date(t.createdAt).getTime() - new Date(editingTransaction.createdAt).getTime()) < 10000)
        ).sort((a: any, b: any) => (a.currentInstallment || 0) - (b.currentInstallment || 0));
        
        setRelatedInstallments(related);
      } else {
        setRelatedInstallments([]);
      }
    };
    fetchRelated();
  }, [editingTransaction, user, context]);

  const sharedPeople = React.useMemo(() => {
    const people = new Set<string>();
    transactions.forEach((t: any) => {
      if (t.isShared && t.sharedWith) {
        t.sharedWith.split(',').forEach((p: string) => {
          const trimmed = p.trim();
          if (trimmed) people.add(trimmed);
        });
      }
    });
    return Array.from(people);
  }, [transactions]);

  const installmentPreview = React.useMemo(() => {
    const hasInstallments = paymentMethod === 'cartao_credito' || (paymentMethod === 'financiamento' && isInstallment);
    
    if (!hasInstallments || watchedInstallments <= 1 || !watchedValue || !watchedDate) {
      return [];
    }

    if (editingTransaction && relatedInstallments.length > 0 && watchedInstallments === editingTransaction.installments) {
      return relatedInstallments.map(t => ({
        number: t.currentInstallment,
        date: parseLocalDate(t.date),
        value: t.value,
        status: t.status,
        isCurrent: t.id === editingTransaction.id
      }));
    }

    const baseDate = (paymentMethod === 'cartao_credito' || paymentMethod === 'financiamento') && firstInstallmentDate 
      ? parseLocalDate(firstInstallmentDate) 
      : parseLocalDate(watchedDate);
    
    const startDate = baseDate;
    const previews = [];
    const installmentValue = watchedValue / watchedInstallments;

    for (let i = 0; i < watchedInstallments; i++) {
      const installmentDate = addMonths(startDate, i);
      previews.push({
        number: i + 1,
        date: installmentDate,
        value: installmentValue,
        status: i === 0 ? watchedStatus : 'a_pagar',
        isCurrent: false
      });
    }
    return previews;
  }, [watchedValue, watchedInstallments, watchedDate, watchedStatus, paymentMethod, isInstallment, editingTransaction, relatedInstallments, firstInstallmentDate]);

  useEffect(() => {
    if (isAuthReady && !user) {
      router.push('/login');
    }
  }, [user, isAuthReady, router]);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    const processData = (trans: any[], cats: any[], crds: any[], clnts: any[]) => {
      const processed = trans.map(t => {
        let userPortion = t.value;
        if (t.isShared && t.sharedSplit) {
          try {
            const split = JSON.parse(t.sharedSplit);
            const othersTotal = Object.values(split).reduce((sum: number, v: any) => sum + Number(v), 0);
            const p = Number(t.value) - othersTotal;
            userPortion = p > 0 ? Math.round(p * 100) / 100 : 0;
          } catch {}
        }
        return { ...t, userPortion };
      });
      setAllTransactions(processed);

      setTransactions([...processed].filter(t => t.userPortion > 0 || !t.isShared).sort((a: any, b: any) => {
        const dateA = parseLocalDate(a.date).getTime();
        const dateB = parseLocalDate(b.date).getTime();
        return dateB - dateA;
      }));

      setCards(crds);
      setClients(clnts || []);
      setCategories(cats);
    };

    const loadData = async () => {
      const from = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const to = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      // 1. Carrega do Cache Instantaneamente
      const cachedTrans = localDB.getCached('transactions', user.uid, context, { from, to });
      const cachedCats = localDB.getCached('categories', user.uid, context);
      const cachedCrds = localDB.getCached('cards', user.uid, context);
      const cachedClnts = localDB.getCached('clients', user.uid);
      
      if (cachedTrans.length > 0 || cachedCats.length > 0) {
        processData(cachedTrans, cachedCats, cachedCrds, cachedClnts);
      }

      // 2. Busca Atualizada
      const [trans, cats, crds, clnts] = await Promise.all([
        localDB.get('transactions', user.uid, context, { from, to }),
        localDB.get('categories', user.uid, context),
        localDB.get('cards', user.uid, context),
        localDB.get('clients', user.uid),
      ]);

      if (cats.length === 0 && !cachedCats.length) {
        // Seed default categories se banco vazio
        const defaultCategories = [
          { name: 'CONTRATO', flow: 'receita', context: 'empresa', color: '#10b981' },
          { name: 'SERVIÇO AVULSO', flow: 'receita', context: 'empresa', color: '#3b82f6' },
          { name: 'EM ABERTO', flow: 'receita', context: 'empresa', color: '#f59e0b' },
          { name: 'Fixas', flow: 'despesa_fixa', context: 'empresa', color: '#ef4444' },
          { name: 'PRO LABORE', flow: 'despesa_fixa', context: 'empresa', color: '#8b5cf6' },
          { name: 'IMPOSTO', flow: 'despesa_fixa', context: 'empresa', color: '#6366f1' },
          { name: 'TAXA DE BANCO', flow: 'despesa_fixa', context: 'empresa', color: '#64748b' },
          { name: 'ASSINATURA', flow: 'despesa_variavel', context: 'empresa', color: '#ec4899' },
          { name: 'CONTA CONSUMO', flow: 'despesa_variavel', context: 'empresa', color: '#06b6d4' },
          { name: 'EQUIPE', flow: 'despesa_variavel', context: 'empresa', color: '#f97316' },
          { name: 'COMPRINHAS', flow: 'despesa_variavel', context: 'empresa', color: '#84cc16' },
          { name: 'TRANSPORTE', flow: 'despesa_variavel', context: 'empresa', color: '#14b8a6' },
          { name: 'COMBUSTÍVEL', flow: 'despesa_variavel', context: 'empresa', color: '#facc15' },
          { name: 'VIAGEM', flow: 'despesa_variavel', context: 'empresa', color: '#fb7185' },
          { name: 'CURSOS', flow: 'despesa_variavel', context: 'empresa', color: '#a855f7' },
          { name: 'COMIDINHAS', flow: 'despesa_variavel', context: 'empresa', color: '#d946ef' },
          { name: 'CARTÃO PJ', flow: 'despesa_variavel', context: 'empresa', color: '#475569' },
          { name: 'OUTROS', flow: 'despesa_variavel', context: 'empresa', color: '#94a3b8' },
          { name: 'SALÁRIO', flow: 'receita', context: 'pessoal', color: '#10b981' },
          { name: 'COMISSÃO', flow: 'receita', context: 'pessoal', color: '#3b82f6' },
          { name: 'BÔNUS', flow: 'receita', context: 'pessoal', color: '#f59e0b' },
          { name: 'CASA', flow: 'despesa_variavel', context: 'pessoal', color: '#ef4444' },
          { name: 'FINANCIAMENTO', flow: 'despesa_variavel', context: 'pessoal', color: '#8b5cf6' },
          { name: 'FARMÁCIA/SAÚDE', flow: 'despesa_variavel', context: 'pessoal', color: '#6366f1' },
          { name: 'ASSINATURA', flow: 'despesa_variavel', context: 'pessoal', color: '#ec4899' },
          { name: 'IGREJA', flow: 'despesa_variavel', context: 'pessoal', color: '#06b6d4' },
          { name: 'MERCADO', flow: 'despesa_variavel', context: 'pessoal', color: '#f97316' },
          { name: 'HORTIFRUTI', flow: 'despesa_variavel', context: 'pessoal', color: '#84cc16' },
          { name: 'AÇOUGUE', flow: 'despesa_variavel', context: 'pessoal', color: '#14b8a6' },
          { name: 'QUENTINHA', flow: 'despesa_variavel', context: 'pessoal', color: '#facc15' },
          { name: 'COMIDINHAS', flow: 'despesa_variavel', context: 'pessoal', color: '#d946ef' },
          { name: 'COMPRINHAS', flow: 'despesa_variavel', context: 'pessoal', color: '#fb7185' },
          { name: 'TRANSPORTE', flow: 'despesa_variavel', context: 'pessoal', color: '#a855f7' },
          { name: 'COMBUSTÍVEL', flow: 'despesa_variavel', context: 'pessoal', color: '#10b981' },
          { name: 'BELEZA', flow: 'despesa_variavel', context: 'pessoal', color: '#3b82f6' },
          { name: 'VESTUARIO/CALÇADO', flow: 'despesa_variavel', context: 'pessoal', color: '#f59e0b' },
          { name: 'LAZER', flow: 'despesa_variavel', context: 'pessoal', color: '#ef4444' },
          { name: 'VIAGEM', flow: 'despesa_variavel', context: 'pessoal', color: '#8b5cf6' },
          { name: 'CURSOS', flow: 'despesa_variavel', context: 'pessoal', color: '#6366f1' },
          { name: 'IMPOSTO', flow: 'despesa_variavel', context: 'pessoal', color: '#ec4899' },
          { name: 'FATURA', flow: 'despesa_variavel', context: 'pessoal', color: '#06b6d4' },
          { name: 'OUTROS', flow: 'despesa_variavel', context: 'pessoal', color: '#f97316' },
        ];
        await localDB.saveMany('categories', defaultCategories.map((cat) => ({ ...cat, uid: user.uid })));
        const seededCats = await localDB.get('categories', user.uid, context);
        processData(trans, seededCats, crds, clnts);
      } else {
        processData(trans, cats, crds, clnts);
      }
    };

    loadData();
  }, [user, context, selectedMonth, refreshTrigger]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
    setSharedSplitState({});
    reset();
    if (searchParams.toString()) {
      router.replace('/transactions');
    }
  };

  const onSubmit = async (data: TransactionFormValues) => {
    if (!user) return;
    setLoading(true);

    try {
      const isCreditCard = data.paymentMethod === 'cartao_credito';
      const isFinancingInstallment = data.paymentMethod === 'financiamento' && data.installments > 1;
      const hasInstallments = (isCreditCard || isFinancingInstallment) && data.installments > 1;

      const finalEntityName = data.entityName === 'outro' ? data.otherEntityName || 'Outro' : data.entityName;

      // Extract only the fields that exist in the database schema
      const basePayload: any = {
        type: data.type,
        category: data.category,
        entityName: finalEntityName,
        description: data.description || data.observation || '',
        value: data.value,
        status: data.status, // Allow user-selected status even for credit cards when editing
        paymentMethod: data.paymentMethod,
        cardId: data.cardId || null,
        isInstallment: data.isInstallment || false,
        installments: data.installments || 1,
        isShared: data.isShared || false,
        sharedWith: data.isShared ? data.sharedWith : '',
        sharedSplit: data.isShared && Object.keys(sharedSplitState).length > 0 ? JSON.stringify(sharedSplitState) : '',
        recurrent: data.recurrent || false,
        uid: user.uid,
        context,
        firstInstallmentDate: toDbDate(data.firstInstallmentDate),
      };

      // Ensure we don't overwrite createdAt when editing
      if (!editingTransaction) {
        basePayload.createdAt = new Date().toISOString();
        if (isCreditCard) {
            basePayload.status = 'pago'; // Force pago only on new CC entries
        }
      }

      // 1. Atualização Otimista da UI
      const optimisticValue = (hasInstallments && data.installments > 1) ? (data.value / data.installments) : data.value;
      const optimisticTx = {
        ...basePayload,
        value: optimisticValue,
        id: editingTransaction ? editingTransaction.id : 'temp_' + Date.now(),
        date: toDbDate(data.date),
        renewalDate: toDbDate(data.renewalDate),
      };
      
      setTransactions(prev => {
        if (editingTransaction) {
          return prev.map(t => t.id === optimisticTx.id ? optimisticTx : t).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        return [optimisticTx, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });

      // Fechar modal imediatamente
      closeModal();
      setLoading(false);

      // 2. Execução em Background
      (async () => {
        try {
          if (editingTransaction) {
            if (relatedInstallments.length > 0 && data.installments === editingTransaction.installments) {
              const installmentValue = data.value / data.installments;
              const rawDate = (data.paymentMethod === 'cartao_credito' || data.paymentMethod === 'financiamento') && data.firstInstallmentDate
                ? data.firstInstallmentDate
                : data.date;
              const baseDate = new Date(String(rawDate).slice(0, 10) + 'T12:00:00Z');
              
              const arr = relatedInstallments.map((t, i) => {
                 const installmentDate = addMonths(baseDate, i);
                 const installmentNum = (i + 1).toString().padStart(2, '0');
                 const totalInstallments = data.installments.toString().padStart(2, '0');
                 return {
                     ...basePayload,
                     id: t.id,
                     value: installmentValue,
                     date: toDbDate(format(installmentDate, 'yyyy-MM-dd'))!,
                     description: `${finalEntityName} (${installmentNum}/${totalInstallments})`,
                     status: t.status,
                     groupId: t.groupId || editingTransaction.groupId,
                     currentInstallment: i + 1,
                     createdAt: t.createdAt
                 };
              });
              await Promise.all(arr.map(t => localDB.save('transactions', t)));
            } else if ((relatedInstallments.length > 0 && data.installments !== editingTransaction.installments) || (relatedInstallments.length === 0 && hasInstallments)) {
              if (relatedInstallments.length > 0) {
                for (const t of relatedInstallments) {
                  await localDB.delete('transactions', t.id);
                }
              } else {
                await localDB.delete('transactions', editingTransaction.id);
              }
              const installmentValue = data.value / data.installments;
              const rawDate = (data.paymentMethod === 'cartao_credito' || data.paymentMethod === 'financiamento') && data.firstInstallmentDate
                ? data.firstInstallmentDate
                : data.date;
              const baseDate = new Date(String(rawDate).slice(0, 10) + 'T12:00:00Z');
              const groupId = editingTransaction.groupId || Math.random().toString(36).substr(2, 9);
              
              const arr = [];
              for (let i = 0; i < data.installments; i++) {
                 const installmentDate = addMonths(baseDate, i);
                 const installmentNum = (i + 1).toString().padStart(2, '0');
                 const totalInstallments = data.installments.toString().padStart(2, '0');
                 arr.push({
                     ...basePayload,
                     value: installmentValue,
                     date: toDbDate(format(installmentDate, 'yyyy-MM-dd'))!,
                     description: `${finalEntityName} (${installmentNum}/${totalInstallments})`,
                     status: isCreditCard ? 'pago' : (i === 0 ? data.status : 'a_pagar'),
                     groupId,
                     currentInstallment: i + 1,
                     createdAt: editingTransaction.createdAt
                 });
              }
              await localDB.saveMany('transactions', arr);
            } else {
              await localDB.save('transactions', {
                ...basePayload,
                id: editingTransaction.id,
                date: toDbDate(data.date),
                renewalDate: toDbDate(data.renewalDate),
                value: data.value,
              });
            }
          } else if (hasInstallments) {
            const installmentValue = data.value / data.installments;
            const rawDate = (data.paymentMethod === 'cartao_credito' || data.paymentMethod === 'financiamento') && data.firstInstallmentDate
              ? data.firstInstallmentDate
              : data.date;

            const baseDate = new Date(String(rawDate).slice(0, 10) + 'T12:00:00Z');
            const startDate = baseDate;
            const groupId = Math.random().toString(36).substr(2, 9);
            
            const arr = [];
            for (let i = 0; i < data.installments; i++) {
              const installmentDate = addMonths(startDate, i);
              const installmentNum = (i + 1).toString().padStart(2, '0');
              const totalInstallments = data.installments.toString().padStart(2, '0');
              
              arr.push({
                ...basePayload,
                value: installmentValue,
                date: toDbDate(format(installmentDate, 'yyyy-MM-dd'))!,
                description: `${finalEntityName} (${installmentNum}/${totalInstallments})`,
                installments: data.installments,
                currentInstallment: i + 1,
                groupId,
                status: isCreditCard ? 'pago' : (i === 0 ? data.status : 'a_pagar'),
              });
            }
            await localDB.saveMany('transactions', arr);
          } else {
            await localDB.save('transactions', {
              ...basePayload,
              date: toDbDate(data.date),
              renewalDate: toDbDate(data.renewalDate),
            });
          }
          triggerRefresh();
        } catch (error) {
          console.error('Erro no salvamento em background:', error);
          alert('Houve um erro ao salvar o lançamento no servidor. A tela será recarregada.');
          triggerRefresh();
        }
      })();

    } catch (error: any) {
      console.error('Error saving transaction:', error);
      alert('Erro ao salvar: ' + (error.message || 'Desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const onFormError = (errors: any) => {
    console.error("Form Errors:", errors);
    const errorMessages = Object.values(errors).map((e: any) => e.message).join('\n');
    alert("Não foi possível salvar pois há campos inválidos:\n\n" + errorMessages + "\n\nPor favor, role a tela para cima e verifique os campos obrigatórios.");
  };

  const handleImport = async () => {
    if (!user || !importData) return;
    // Simple CSV simulation: Date, Entity, Value, Category
    const lines = importData.split('\n');
    for (const line of lines) {
      const [date, entity, value, category, type] = line.split(',');
      if (date && entity && value) {
        await localDB.save('transactions', {
          uid: user.uid,
          context,
          date: new Date(date).toISOString(),
          entityName: entity.trim(),
          value: parseFloat(value),
          category: category?.trim() || 'Outros',
          type: (type?.trim().toLowerCase() === 'receita' ? 'receita' : 'despesa') as 'receita' | 'despesa',
          status: 'recebido',
          paymentMethod: 'importado',
          recurrent: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
    triggerRefresh();
    setIsImportModalOpen(false);
    setImportData('');
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await localDB.delete('transactions', deleteConfirmId);
      triggerRefresh();
      if (editingTransaction && editingTransaction.id === deleteConfirmId) {
        closeModal();
      }
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleEdit = React.useCallback((transaction: any) => {
    setEditingTransaction(transaction);
    
    // Safely get date string from various possible formats
    const getDateString = (dateVal: any) => {
      if (!dateVal) return '';
      if (typeof dateVal === 'string' && dateVal.includes('T')) return dateVal.split('T')[0];
      const d = parseLocalDate(dateVal);
      // Fallback format if it's not a standard ISO string
      return format(d, 'yyyy-MM-dd');
    };

    const safeTx = Object.fromEntries(
      Object.entries(transaction).map(([k, v]) => [k, v === null ? undefined : v])
    );

    // Load shared split state if exists
    if (safeTx.sharedSplit) {
      try {
        const parsed = JSON.parse(safeTx.sharedSplit as string);
        if (typeof parsed === 'object' && parsed !== null) {
          // Scale split values back to total (multiply by installments)
          const installCount = Number(safeTx.installments || 1);
          
          let othersTotal = 0;
          let scaledSplit: Record<string, number> = {};
          
          if (installCount > 1) {
            Object.entries(parsed).forEach(([k, v]) => { 
              scaledSplit[k] = Number(v) * installCount; 
              othersTotal += scaledSplit[k];
            });
            setSharedSplitState(scaledSplit);
          } else {
            scaledSplit = parsed as Record<string, number>;
            setSharedSplitState(scaledSplit);
            othersTotal = Object.values(scaledSplit).reduce((a, b) => a + b, 0);
          }
          
          // Determine iParticipate by checking if sum of others equals total value
          const totalVal = Number(safeTx.installments || 1) > 1 ? Number(safeTx.value) * Number(safeTx.installments) : Number(safeTx.value);
          setIParticipate(Math.abs(othersTotal - totalVal) > 0.05); // If there's a remainder, user participates
        } else {
          setSharedSplitState({});
          setIParticipate(true);
        }
      } catch { 
        setSharedSplitState({}); 
        setIParticipate(true);
      }
    } else if (safeTx.isShared && safeTx.sharedWith) {
      // Auto-calculate equal split for old data without sharedSplit
      const totalValue = Number(safeTx.installments || 1) > 1 ? Number(safeTx.value) * Number(safeTx.installments) : Number(safeTx.value);
      const people = String(safeTx.sharedWith).split(',').map((p: string) => p.trim()).filter(Boolean);
      const totalPeople = people.length + 1;
      const perPerson = Math.round((totalValue / totalPeople) * 100) / 100;
      const newSplit: Record<string, number> = {};
      people.forEach((p: string) => { newSplit[p] = perPerson; });
      setSharedSplitState(newSplit);
      setIParticipate(true);
    } else {
      setSharedSplitState({});
      setIParticipate(true);
    }

    // Strip installment numbering from entityName (e.g. "SHOPEE (01/03)" → "SHOPEE")
    let cleanEntityName = safeTx.entityName;
    if (Number(safeTx.installments || 1) > 1 && typeof cleanEntityName === 'string') {
      cleanEntityName = cleanEntityName.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
    }

    reset({
      type: 'despesa',
      status: 'a_pagar',
      paymentMethod: 'pix',
      recurrent: false,
      ...safeTx,
      sharedWith: safeTx.sharedWith,
      entityName: cleanEntityName,
      value: Number(safeTx.installments || 1) > 1 ? Number(safeTx.value) * Number(safeTx.installments) : safeTx.value,
      date: getDateString(safeTx.date),
      renewalDate: safeTx.renewalDate ? getDateString(safeTx.renewalDate) : undefined,
      firstInstallmentDate: safeTx.firstInstallmentDate ? getDateString(safeTx.firstInstallmentDate) : undefined,
      isShared: !!safeTx.sharedWith,
      installments: Number(safeTx.installments || 1),
    } as any);
    setIsModalOpen(true);
  }, [reset]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && allTransactions.length > 0 && !editingTransaction && !isModalOpen) {
      const tx = allTransactions.find((t: any) => t.id === editId);
      if (tx) {
        handleEdit(tx);
      }
    }
  }, [searchParams, transactions, editingTransaction, isModalOpen, handleEdit]);

  const handleDownload = () => {
    if (filteredTransactions.length === 0) return;
    
    const headers = ['Data', 'Entidade', 'Descrição', 'Categoria', 'Status', 'Valor', 'Método'];
    const rows = filteredTransactions.map(t => [
      format(parseLocalDate(t.date), 'dd/MM/yyyy'),
      t.entityName,
      t.description || '',
      t.category,
      t.status,
      t.value.toString(),
      t.paymentMethod
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lancamentos_${format(selectedMonth, 'MM_yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      await localDB.save('transactions', { ...transaction, status: newStatus });
      triggerRefresh();
    }
  };

  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'review'>('upload');
  const [pendingImports, setPendingImports] = useState<any[]>([]);

  const processImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n');
      const parsed: any[] = [];

      lines.forEach((line, index) => {
        if (index === 0) return; // Skip header
        const parts = line.split(',');
        if (parts.length >= 4) {
          const [date, entity, value, category, type, method] = parts;
          parsed.push({
            date: date.trim(),
            entityName: entity.trim(),
            value: parseFloat(value),
            category: category?.trim() || 'Outros',
            type: (type?.trim().toLowerCase() === 'receita' ? 'receita' : 'despesa'),
            paymentMethod: method?.trim() || 'pix',
            status: type?.trim().toLowerCase() === 'receita' ? 'a_receber' : 'a_pagar',
          });
        }
      });

      setPendingImports(parsed);
      setImportStep('review');
    };
    reader.readAsText(file);
  };

  const confirmImportItem = (index: number) => {
    const item = pendingImports[index];
    setEditingTransaction(null);
    reset({
      ...item,
      date: item.date,
      recurrent: false,
      installments: 1,
    });
    setIsImporting(false);
    setIsModalOpen(true);
    // Remove from pending
    setPendingImports(prev => prev.filter((_, i) => i !== index));
  };

  const filteredTransactions = transactions.filter(t => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (t.entityName || '').toLowerCase().includes(searchLower) || 
                          (t.description || '').toLowerCase().includes(searchLower) ||
                          (t.category || '').toLowerCase().includes(searchLower) ||
                          (t.status || '').toLowerCase().includes(searchLower) ||
                          (t.value || '').toString().includes(searchLower);
    const matchesType = filterType === 'todos' || t.type === filterType;
    const matchesCategory = filterCategory === 'todas' || t.category === filterCategory;
    const matchesStatus = filterStatus === 'todos' || t.status === filterStatus;
    
    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  if (!isAuthReady || !user) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
  const months = [
    { value: 0, label: 'Janeiro' },
    { value: 1, label: 'Fevereiro' },
    { value: 2, label: 'Março' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Maio' },
    { value: 5, label: 'Junho' },
    { value: 6, label: 'Julho' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Setembro' },
    { value: 9, label: 'Outubro' },
    { value: 10, label: 'Novembro' },
    { value: 11, label: 'Dezembro' },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-on-surface">Lançamentos</h2>
            <p className="text-on-surface-variant font-medium mt-1">Gerencie suas receitas e despesas com precisão.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-surface-container-high p-1.5 rounded-2xl shadow-inner w-full sm:w-auto overflow-x-auto">
              <div className="flex items-center gap-2 px-2 w-full justify-between sm:justify-start">
                <select 
                  value={getYear(selectedMonth)}
                  onChange={(e) => setSelectedMonth(setYear(selectedMonth, parseInt(e.target.value)))}
                  className="bg-transparent border-none text-sm font-bold text-on-surface focus:ring-0 pr-8"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select 
                  value={selectedMonth.getMonth()}
                  onChange={(e) => setSelectedMonth(setMonth(selectedMonth, parseInt(e.target.value)))}
                  className="bg-transparent border-none text-sm font-bold text-on-surface focus:ring-0 pr-8"
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingTransaction(null);
                reset();
                setIsModalOpen(true);
              }}
              className={cn("w-full sm:w-auto justify-center px-6 py-3 rounded-2xl text-white font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all", themeBg)}
            >
              <Plus size={20} />
              Novo Lançamento
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-surface-container-lowest p-4 rounded-[24px] border border-outline-variant/20 shadow-sm flex flex-col lg:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
            <input
              type="text"
              placeholder="Pesquisar por entidade ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-surface-container-high border-none rounded-xl px-4 py-2 text-xs font-bold focus:ring-0 text-on-surface-variant min-w-[120px]"
            >
              <option value="todas">Categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-surface-container-high border-none rounded-xl px-4 py-2 text-xs font-bold focus:ring-0 text-on-surface-variant min-w-[120px]"
            >
              <option value="todos">Status</option>
              <option value="pago">Pago / Recebido</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
            </select>

            <button
              onClick={() => setFilterType('todos')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                filterType === 'todos' ? themeActive(isBusiness) : "bg-surface-container-high text-on-surface-variant"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('receita')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                filterType === 'receita' ? "bg-success text-white" : "bg-surface-container-high text-on-surface-variant"
              )}
            >
              Receitas
            </button>
            <button
              onClick={() => setFilterType('despesa')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                filterType === 'despesa' ? "bg-error text-white" : "bg-surface-container-high text-on-surface-variant"
              )}
            >
              Despesas
            </button>
            <div className="w-px h-6 bg-outline-variant/30 hidden lg:block"></div>
            <button 
              onClick={handleDownload}
              className="p-2.5 bg-surface-container-high rounded-xl text-on-surface-variant hover:bg-outline-variant/20 transition-colors"
            >
              <Download size={20} />
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/20 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/20">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Data</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Entidade / Descrição</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Categoria</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Valor</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-on-surface">{format(parseLocalDate(t.date), 'dd/MM/yyyy')}</p>
                        {t.recurrent && <span className="text-[9px] font-black text-primary uppercase tracking-tighter">Recorrente</span>}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            t.type === 'receita' ? "bg-success/10 text-success" : "bg-error/10 text-error"
                          )}>
                            {t.type === 'receita' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-on-surface">{t.entityName}</p>
                              {t.currentInstallment && t.installments > 1 && (
                                <span className="text-[9px] font-black bg-surface-container-highest px-2 py-0.5 rounded-full text-on-surface-variant whitespace-nowrap">
                                  {t.currentInstallment}/{t.installments}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-on-surface-variant font-medium truncate max-w-[200px]">{t.description || '-'}</p>
                            {t.sharedWith && (
                              <p className="text-[10px] text-primary font-bold mt-1">
                                Dividido com: {t.sharedWith}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-full">
                          {t.category}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t.id, e.target.value)}
                          className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-none focus:ring-0 cursor-pointer",
                            t.status === 'recebido' || t.status === 'pago' ? "bg-success/10 text-success" : 
                            t.status === 'atrasado' ? "bg-error/10 text-error" : "bg-amber-500/10 text-amber-600"
                          )}
                        >
                          <option value="recebido">Recebido</option>
                          <option value="pago">Pago</option>
                          <option value="a_receber">A Receber</option>
                          <option value="a_pagar">A Pagar</option>
                          <option value="atrasado">Atrasado</option>
                        </select>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <p className={cn("text-sm font-black", t.type === 'receita' ? "text-success" : "text-error")}>
                          {t.type === 'receita' ? '+' : '-'} {formatCurrency(t.userPortion !== undefined ? t.userPortion : t.value)}
                        </p>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase">{t.paymentMethod.replace('_', ' ')}</p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(t)}
                            className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          {(isAdmin || isFinanceiro) && (
                            <button 
                              onClick={() => handleDelete(t.id)}
                              className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-40">
                        <ReceiptText size={48} />
                        <p className="font-bold">Nenhum lançamento encontrado.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between">
            <p className="text-xs font-bold text-on-surface-variant">
              Mostrando <span className="text-on-surface">{filteredTransactions.length}</span> resultados
            </p>
          </div>
        </div>

        {/* Transaction Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-surface-container-lowest w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 md:p-6 border-b border-outline-variant/20 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-on-surface">
                    {isImporting ? 'Importar Extrato' : (editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento')}
                  </h3>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest mt-1">
                    Contexto: <span className={themeColor}>{isBusiness ? 'Empresa' : 'Pessoal'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!editingTransaction && !isImporting && (
                    <button
                      onClick={() => setIsImporting(true)}
                      className="px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface-variant text-[10px] font-black uppercase tracking-widest hover:bg-outline-variant/20 transition-all flex items-center gap-2"
                    >
                      <Upload size={14} />
                      Importar
                    </button>
                  )}
                  {isImporting && (
                    <button
                      onClick={() => setIsImporting(false)}
                      className="px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface-variant text-[10px] font-black uppercase tracking-widest hover:bg-outline-variant/20 transition-all"
                    >
                      Voltar ao Form
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      closeModal();
                      setIsImporting(false);
                      setImportStep('upload');
                    }}
                    className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {isImporting ? (
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  {importStep === 'upload' ? (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-outline-variant/40 rounded-[32px] bg-surface-container-low/30">
                      <Upload size={48} className="text-on-surface-variant mb-4" />
                      <h4 className="text-lg font-black text-on-surface">Subir arquivo</h4>
                      <p className="text-xs text-on-surface-variant font-medium mt-1 mb-6">PDF ou CSV (Data, Entidade, Valor, Categoria, Tipo, Método)</p>
                      <input
                        type="file"
                        accept=".csv,.pdf"
                        onChange={processImportFile}
                        className="hidden"
                        id="import-file"
                      />
                      <label
                        htmlFor="import-file"
                        className={cn("px-8 py-3 rounded-2xl text-white font-black cursor-pointer shadow-lg active:scale-95 transition-all", themeBg)}
                      >
                        Selecionar Arquivo
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Itens Identificados</h4>
                      <div className="space-y-2">
                        {pendingImports.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-surface-container-high rounded-2xl">
                            <div>
                              <p className="text-sm font-bold text-on-surface">{item.entityName}</p>
                              <p className="text-[10px] text-on-surface-variant font-bold uppercase">{item.category} • {formatCurrency(item.value)}</p>
                            </div>
                            <button
                              onClick={() => confirmImportItem(idx)}
                              className={cn("px-4 py-2 rounded-xl text-white text-xs font-black shadow-sm", themeBg)}
                            >
                              Preencher
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-6 p-4 md:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                {/* Type Toggle */}
                <div className="flex bg-surface-container-high p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setValue('type', 'receita')}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all",
                      transactionType === 'receita' ? "bg-success text-white shadow-lg" : "text-on-surface-variant"
                    )}
                  >
                    <TrendingUp size={18} />
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('type', 'despesa')}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all",
                      transactionType === 'despesa' ? "bg-error text-white shadow-lg" : "text-on-surface-variant"
                    )}
                  >
                    <TrendingDown size={18} />
                    Despesa
                  </button>
                </div>

                {!editingTransaction && (
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={loadPreviousMonthTransactions}
                      className="flex-1 py-2 px-3 bg-surface-container-highest text-on-surface-variant text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-outline-variant/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw size={12} />
                      Puxar Mês Anterior
                    </button>
                    <button
                      type="button"
                      onClick={pullRecurringFromPrevious}
                      className="flex-1 py-2 px-3 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5 border border-primary/20"
                    >
                      <RefreshCw size={12} />
                      Puxar Recorrentes
                    </button>
                  </div>
                )}

                {isPreviousMonthSearchOpen && (
                  <div className="bg-surface-container-high p-4 rounded-2xl space-y-3 border border-outline-variant/20">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Lançamentos de {format(addMonths(selectedMonth, -1), 'MMMM', { locale: ptBR })}</h4>
                      <button onClick={() => setIsPreviousMonthSearchOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                      {previousMonthTransactions.length > 0 ? (
                        previousMonthTransactions.map((t, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => fillFromPrevious(t)}
                            className="w-full p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-all flex items-center justify-between text-left"
                          >
                            <div>
                              <p className="text-xs font-bold text-on-surface">{t.entityName}</p>
                              <p className="text-[10px] text-on-surface-variant">{t.category}</p>
                            </div>
                            <p className="text-xs font-black text-on-surface">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.value)}
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="text-[10px] text-on-surface-variant italic text-center py-4">Nenhum lançamento encontrado no mês anterior.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">
                      {transactionType === 'despesa' ? 'Descrição' : (isBusiness ? 'Empresa / Cliente' : 'Fonte de Receita')}
                    </label>
                    <div className="relative">
                      {transactionType === 'receita' && isBusiness ? (
                        <>
                          <select
                            {...register('entityName')}
                            className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 appearance-none"
                          >
                            <option value="">Selecione...</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.companyName}>{c.companyName}</option>
                            ))}
                            <option value="outro">Outro (Digitar manualmente)</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                            <Building size={16} />
                          </div>
                        </>
                      ) : (
                        <input
                          {...register('entityName')}
                          placeholder="Digite a descrição..."
                          className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                      )}
                    </div>
                    {transactionType === 'receita' && isBusiness && entityName === 'outro' && (
                      <input
                        type="text"
                        placeholder="Digite o nome..."
                        {...register('otherEntityName')}
                        className="w-full mt-2 px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    )}
                    {errors.entityName && <p className="text-[10px] text-error font-bold ml-1">{errors.entityName.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Valor</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        {...register('value', { valueAsNumber: true })}
                        className="w-full pl-10 pr-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    {errors.value && <p className="text-[10px] text-error font-bold ml-1">{errors.value.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Categoria</label>
                    <select
                      {...register('category')}
                      className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Selecione...</option>
                      {categories
                        .filter(c => {
                          if (transactionType === 'receita') return c.flow === 'receita';
                          return c.flow === 'despesa_fixa' || c.flow === 'despesa_variavel';
                        })
                        .map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                    {errors.category && <p className="text-[10px] text-error font-bold ml-1">{errors.category.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Data</label>
                    <input
                      type="date"
                      {...register('date')}
                      className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.date && <p className="text-[10px] text-error font-bold ml-1">{errors.date.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Método de Pagamento</label>
                    <select
                      {...register('paymentMethod')}
                      className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto</option>
                      <option value="transferencia">Transferência</option>
                      {!(transactionType === 'receita' && !isBusiness) && <option value="cartao_credito">Cartão de Crédito</option>}
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="dinheiro">Dinheiro</option>
                      {transactionType === 'despesa' && <option value="financiamento">Financiamento</option>}
                    </select>
                  </div>

                  {paymentMethod === 'cartao_debito' && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Cartão</label>
                      <select
                        {...register('cardId')}
                        className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Selecione o cartão...</option>
                        {cards.map(c => (
                          <option key={c.id} value={c.id}>{c.name}{c.bank ? ` (${c.bank})` : ''}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-on-surface-variant font-medium ml-1">Pagamento à vista no débito — sem parcelamento.</p>
                    </div>
                  )}

                  {paymentMethod === 'financiamento' && (
                    <div className="flex items-center gap-3 p-4 bg-surface-container-high rounded-2xl md:col-span-2">
                      <input
                        type="checkbox"
                        id="isInstallment"
                        {...register('isInstallment')}
                        className="w-5 h-5 rounded border-outline text-primary focus:ring-primary/20"
                      />
                      <label htmlFor="isInstallment" className="text-sm font-bold text-on-surface">Este financiamento é uma compra parcelada?</label>
                    </div>
                  )}

                  {['cartao_credito', 'cartao_debito'].includes(paymentMethod) && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Cartão</label>
                      <select
                        {...register('cardId')}
                        className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Selecione o cartão...</option>
                        {cards.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.bank})</option>
                        ))}
                      </select>
                      {errors.cardId && <p className="text-[10px] text-error font-bold ml-1">{errors.cardId.message}</p>}
                    </div>
                  )}

                  {(paymentMethod === 'cartao_credito' || (paymentMethod === 'financiamento' && isInstallment)) && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Parcelas</label>
                        <input
                          type="number"
                          min="1"
                          {...register('installments', { valueAsNumber: true })}
                          className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="text-[10px] text-on-surface-variant font-medium ml-1">O valor total será dividido em {watch('installments')} meses.</p>
                        {errors.installments && <p className="text-[10px] text-error font-bold ml-1">{errors.installments.message}</p>}
                      </div>

                      {(paymentMethod === 'financiamento' || paymentMethod === 'cartao_credito') && (
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Data da Primeira Parcela</label>
                          <input
                            type="date"
                            {...register('firstInstallmentDate')}
                            className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      )}

                      {/* Installment Visualization */}
                      {installmentPreview.length > 0 && (
                        <div className="col-span-full space-y-4 p-6 bg-surface-container-low rounded-[24px] border border-outline-variant/20">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                              <Calendar size={14} />
                              Cronograma de Parcelas
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase">
                              {watchedInstallments}x de {formatCurrency(watchedValue / watchedInstallments)}
                            </span>
                          </div>
                          
                          <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                            {installmentPreview.map((inst) => (
                              <div 
                                key={inst.number} 
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-xl border transition-all",
                                  inst.isCurrent 
                                    ? themeBorder + " bg-surface-container-lowest shadow-sm" 
                                    : "bg-surface-container-lowest border-outline-variant/10"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black",
                                    inst.isCurrent ? themeBg + " text-white" : "bg-surface-container-high text-on-surface-variant"
                                  )}>
                                    {inst.number.toString().padStart(2, '0')}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-on-surface">
                                      {format(inst.date, 'dd/MM/yyyy')}
                                    </p>
                                    <p className="text-[10px] text-on-surface-variant font-medium">
                                      Parcela {inst.number} de {watchedInstallments}
                                      {inst.isCurrent && <span className={cn("ml-2 font-black uppercase", themeColor)}>(Atual)</span>}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <p className="text-xs font-black text-on-surface">
                                    {formatCurrency(inst.value)}
                                  </p>
                                  <span className={cn(
                                    "text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full",
                                    inst.status === 'recebido' || inst.status === 'pago' ? "bg-success/10 text-success" : 
                                    inst.status === 'atrasado' ? "bg-error/10 text-error" : "bg-amber-500/10 text-amber-600"
                                  )}>
                                    {inst.status === 'recebido' ? 'Recebido' : 
                                     inst.status === 'pago' ? 'Pago' :
                                     inst.status === 'a_receber' ? 'A Receber' : 
                                     inst.status === 'atrasado' ? 'Atrasado' : inst.status.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {paymentMethod !== 'cartao_credito' && (paymentMethod !== 'financiamento' || !isInstallment) && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Status</label>
                      <select
                        {...register('status')}
                        className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="recebido">{transactionType === 'receita' ? 'Recebido' : 'Pago'}</option>
                        <option value="a_receber">{transactionType === 'receita' ? 'A Receber' : 'A Pagar'}</option>
                        <option value="atrasado">Atrasado</option>
                      </select>
                    </div>
                  )}

                  {isBusiness && paymentMethod !== 'financiamento' && paymentMethod !== 'cartao_credito' && entityName !== 'outro' && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Data de Renovação (Opcional)</label>
                      <input
                        type="date"
                        {...register('renewalDate')}
                        className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Descrição / Observação</label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 resize-none"
                    placeholder="Detalhes adicionais sobre este lançamento..."
                  ></textarea>
                </div>

                {!isBusiness && (
                  <div className="space-y-4 p-4 bg-surface-container-high rounded-2xl">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="isShared"
                        {...register('isShared')}
                        className="w-5 h-5 rounded border-outline text-primary focus:ring-primary/20"
                      />
                      <label htmlFor="isShared" className="text-sm font-bold text-on-surface">Compra Compartilhada (Família)</label>
                    </div>
                    
                    {watch('isShared') && (
                      <div className="space-y-4 pl-8">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nomes das pessoas (separados por vírgula)</label>
                          <input
                            type="text"
                            list="shared-people-list"
                            {...register('sharedWith')}
                            placeholder="Ex: Maria, João..."
                            className="w-full px-4 py-3 bg-surface border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                          />
                          <datalist id="shared-people-list">
                            {sharedPeople.map((person, idx) => (
                              <option key={idx} value={person} />
                            ))}
                          </datalist>
                        </div>

                        {/* Divisão por Pessoa */}
                        {watchedSharedWith && watchedSharedWith.split(',').filter((p: string) => p.trim()).length > 0 && watchedValue > 0 && (
                          <div className="space-y-4 p-4 bg-surface rounded-xl border border-outline-variant/20">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-1">
                                <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Divisão por Pessoa</p>
                                <label className="flex items-center gap-2 cursor-pointer mt-1">
                                  <input 
                                    type="checkbox" 
                                    checked={iParticipate}
                                    onChange={(e) => {
                                      setIParticipate(e.target.checked);
                                      const people = (watchedSharedWith || '').split(',').map((p: string) => p.trim()).filter(Boolean);
                                      const totalPeople = e.target.checked ? people.length + 1 : people.length;
                                      const perPerson = Math.round((watchedValue / totalPeople) * 100) / 100;
                                      const newSplit: Record<string, number> = {};
                                      people.forEach((p: string) => { newSplit[p] = perPerson; });
                                      setSharedSplitState(newSplit);
                                    }}
                                    className="w-4 h-4 rounded border-outline text-primary focus:ring-primary/20"
                                  />
                                  <span className="text-[10px] font-bold text-on-surface-variant">Eu participo dessa divisão</span>
                                </label>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const people = (watchedSharedWith || '').split(',').map((p: string) => p.trim()).filter(Boolean);
                                  const totalPeople = iParticipate ? people.length + 1 : people.length;
                                  const perPerson = Math.round((watchedValue / totalPeople) * 100) / 100;
                                  const newSplit: Record<string, number> = {};
                                  people.forEach((p: string) => { newSplit[p] = perPerson; });
                                  setSharedSplitState(newSplit);
                                }}
                                className="text-[10px] font-black text-primary hover:text-primary/80 uppercase tracking-widest transition-colors h-fit"
                              >
                                Dividir Igualmente
                              </button>
                            </div>
                            
                            {/* User's portion */}
                            {(() => {
                              const othersTotal = Object.values(sharedSplitState).reduce((sum, v) => sum + v, 0);
                              const myPortion = Math.round((watchedValue - othersTotal) * 100) / 100;
                              return (
                                <div className={cn("flex items-center gap-3 py-2 border-b border-outline-variant/10", !iParticipate && "opacity-50 grayscale")}>
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-xs font-black text-primary">EU</span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-on-surface">Você</p>
                                    <p className="text-[10px] text-on-surface-variant">{watchedValue > 0 ? Math.round((myPortion / watchedValue) * 100) : 0}% do total</p>
                                  </div>
                                  <p className={cn("text-sm font-black", myPortion >= 0 ? "text-on-surface" : "text-error")}>
                                    R$ {myPortion.toFixed(2)}
                                  </p>
                                </div>
                              );
                            })()}
                            
                            {/* Other people */}
                            {(watchedSharedWith || '').split(',').map((p: string) => p.trim()).filter(Boolean).map((person: string, idx: number) => {
                              const personValue = sharedSplitState[person] || 0;
                              return (
                                <div key={idx} className="flex items-center gap-3 py-2 border-b border-outline-variant/10 last:border-0">
                                  <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center">
                                    <span className="text-xs font-black text-on-surface-variant">{person.charAt(0).toUpperCase()}</span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-on-surface">{person}</p>
                                    <p className="text-[10px] text-on-surface-variant">{watchedValue > 0 ? Math.round((personValue / watchedValue) * 100) : 0}% do total</p>
                                  </div>
                                  <div className="relative w-28">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">R$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={personValue || ''}
                                      onChange={(e) => {
                                        const newVal = parseFloat(e.target.value) || 0;
                                        setSharedSplitState(prev => ({ ...prev, [person]: newVal }));
                                      }}
                                      className="w-full pl-9 pr-2 py-2 bg-surface-container-high border-none rounded-lg text-sm font-bold text-right focus:ring-2 focus:ring-primary/20"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            
                            {/* Validation */}
                            {(() => {
                              const othersTotal = Object.values(sharedSplitState).reduce((sum, v) => sum + v, 0);
                              const isValid = Math.abs(othersTotal - watchedValue) < watchedValue; // Must not exceed total
                              return (
                                <div className={cn("flex items-center justify-between pt-2 text-xs font-bold", isValid ? "text-on-surface-variant" : "text-error")}>
                                  <span>Soma dos outros: R$ {othersTotal.toFixed(2)}</span>
                                  <span>Seu valor: R$ {(watchedValue - othersTotal).toFixed(2)}</span>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod !== 'financiamento' && (
                  <div className="flex items-center gap-3 p-4 bg-surface-container-high rounded-2xl">
                    <input
                      type="checkbox"
                      id="recurrent"
                      {...register('recurrent')}
                      className="w-5 h-5 rounded border-outline text-primary focus:ring-primary/20"
                    />
                    <label htmlFor="recurrent" className="text-sm font-bold text-on-surface">Este é um lançamento recorrente (mensal)</label>
                  </div>
                )}

                <div className="pt-4 flex gap-4">
                  {editingTransaction ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingTransaction.id)}
                      className="flex-shrink-0 px-6 py-4 bg-error/10 text-error font-black rounded-2xl hover:bg-error/20 transition-all"
                      title="Excluir"
                    >
                      Excluir
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-shrink-0 px-6 py-4 bg-surface-container-high text-on-surface font-black rounded-2xl hover:bg-outline-variant/20 transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn("flex-1 py-4 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50", themeBg)}
                  >
                    {loading ? 'Salvando...' : editingTransaction ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
        {/* Import Modal */}
        <AnimatePresence>
          {isImportModalOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsImportModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative bg-surface-container-lowest w-full max-w-lg rounded-[32px] p-8 shadow-2xl space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-on-surface">Importar Extrato</h3>
                  <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <p className="text-sm text-on-surface-variant font-medium">
                    Cole os dados do seu extrato abaixo no formato CSV:<br/>
                    <span className="text-xs font-mono bg-surface-container-high px-1 rounded">Data, Entidade, Valor, Categoria, Tipo</span>
                  </p>
                  <textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    rows={8}
                    placeholder="2024-03-29, Supermercado, 150.00, Alimentação, Despesa&#10;2024-03-30, Salário, 5000.00, Salário, Receita"
                    className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setIsImportModalOpen(false)}
                    className="flex-1 py-3 bg-surface-container-highest text-on-surface font-black rounded-xl active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImport}
                    className={cn("flex-1 py-3 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all", themeBg)}
                  >
                    Importar Agora
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative bg-surface-container-lowest w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-on-surface">Confirmar Exclusão</h3>
                <p className="text-sm text-on-surface-variant font-medium mt-2">
                  Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 bg-surface-container-highest text-on-surface font-black rounded-xl active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-error text-white font-black rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>}>
      <TransactionsContent />
    </Suspense>
  );
}

function themeActive(isBusiness: boolean) {
  return isBusiness ? "bg-[#1d8490] text-white" : "bg-[#ff6330] text-white";
}
