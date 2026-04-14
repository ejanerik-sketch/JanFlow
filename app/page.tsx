'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Calendar,
  Filter,
  MoreVertical,
  ChevronRight,
  Target,
  PieChart,
  AlertCircle,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShoppingBag,
  Briefcase,
  X,
  Edit2,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as ReTooltip 
} from 'recharts';
import { localDB } from '@/lib/localDB';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, getYear, setYear, setMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthReady, context } = useAppContext();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState(85000);
  const [metrics, setMetrics] = useState({
    revenue: 0,
    expenses: 0,
    profit: 0,
    cardSpending: 0,
    received: 0,
    pending: 0,
    overdue: 0,
    newContracts: 0,
    cancelledContracts: 0,
    commercialGoal: 85000,
    commercialCurrent: 62400,
    cardBreakdown: [] as { id: string, name: string, bank?: string, lastDigits?: string, value: number }[],
    categoryDistribution: [] as { name: string, value: number, color: string }[]
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    if (isAuthReady && !user) {
      router.push('/login');
    }
  }, [user, isAuthReady, router]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);

      // Fetching from Supabase via localDB wrapper
      const allTransactions = await localDB.get('transactions', user.uid, context);
      const allBudgets = await localDB.get('budgets', user.uid, context);
      const allCardsRaw = await localDB.get('cards', user.uid);
      const allCards = allCardsRaw.filter((c: any) => c.context === context);
      const allCategories = await localDB.get('categories', user.uid, context);
      const savedGoal = localStorage.getItem(`janflow_goal_${user.uid}_${context}`);
      if (savedGoal) {
        setNewGoal(parseFloat(savedGoal));
      }
      
      setBudgets(allBudgets);
      setCards(allCards);
      setCategories(allCategories);
      
      const filtered = allTransactions.filter((t: any) => {
        const tDate = new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date);
        return isWithinInterval(tDate, { start, end });
      }).sort((a: any, b: any) => {
        const dateA = new Date(a.date?.seconds ? a.date.seconds * 1000 : a.date).getTime();
        const dateB = new Date(b.date?.seconds ? b.date.seconds * 1000 : b.date).getTime();
        return dateB - dateA;
      });

      setTransactions(filtered);

      let rev = 0;
      let exp = 0;
      let card = 0;
      let newC = 0;
      let cancC = 0;
      let rec = 0;
      let pend = 0;
      let over = 0;
      const cardMap: Record<string, { id: string, name: string, bank?: string, lastDigits?: string, value: number }> = {};
      
      allCards.forEach((c: any) => {
        cardMap[c.id] = {
          id: c.id,
          name: c.name,
          bank: c.bank,
          lastDigits: c.lastDigits || '****',
          value: 0
        };
      });

      const catMap: Record<string, number> = {};

      filtered.forEach((t: any) => {
        if (t.type === 'receita') {
          rev += t.value;
          if (t.status === 'recebido' || t.status === 'pago') rec += t.value;
          else if (t.status === 'a_receber' || t.status === 'pendente') pend += t.value;
          else if (t.status === 'atrasado') over += t.value;

          if ((t.category || '').toLowerCase().includes('contrato') || (t.description || '').toLowerCase().includes('novo contrato')) {
            newC++;
          }
        } else {
          exp += t.value;
          if (t.status === 'atrasado') over += t.value;
          else if (t.status === 'a_pagar' || t.status === 'pendente') pend += t.value;
          
          if ((t.description || '').toLowerCase().includes('cancelamento') || (t.description || '').toLowerCase().includes('cancelado')) {
            cancC++;
          }

          // Category distribution for expenses
          catMap[t.category] = (catMap[t.category] || 0) + t.value;
        }

        if (t.paymentMethod === 'cartao_credito') {
          card += t.value;
          const cardObj = allCards.find((c: any) => c.id === t.cardId);
          if (cardObj && cardMap[cardObj.id]) {
            cardMap[cardObj.id].value += t.value;
          }
        }
      });

      // Format category distribution
      const totalExp = exp || 1;
      const distribution = Object.entries(catMap)
        .map(([name, value]) => {
          const catObj = allCategories.find((c: any) => c.name === name);
          return {
            name,
            value: Math.round((value / totalExp) * 100),
            rawValue: value,
            color: catObj?.color || '#94a3b8'
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      setMetrics(prev => ({
        ...prev,
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
        cardSpending: card,
        received: rec,
        pending: pend,
        overdue: over,
        newContracts: newC,
        cancelledContracts: cancC,
        cardBreakdown: Object.values(cardMap).sort((a, b) => b.value - a.value),
        categoryDistribution: distribution,
        commercialGoal: savedGoal ? parseFloat(savedGoal) : prev.commercialGoal,
        commercialCurrent: rev
      }));
    };

    loadData();
  }, [user, context, selectedMonth]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  const isBusiness = context === 'empresa';
  const themeColor = isBusiness ? 'text-[#1d8490]' : 'text-[#ff6330]';
  const themeBg = isBusiness ? 'bg-[#1d8490]' : 'bg-[#ff6330]';
  const themeBorder = isBusiness ? 'border-[#1d8490]' : 'border-[#ff6330]';

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
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-on-surface">
              Dashboard <span className={themeColor}>{isBusiness ? 'Empresarial' : 'Pessoal'}</span>
            </h2>
            <p className="text-on-surface-variant font-medium mt-1">
              Visão geral da sua <span className="font-bold">gestão financeira integrada</span> em {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-surface-container-high p-1.5 rounded-2xl shadow-inner">
            <div className="flex items-center gap-2 px-2">
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
            <div className="w-px h-6 bg-outline-variant/30"></div>
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest rounded-xl text-sm font-bold text-on-surface hover:bg-outline-variant/20 transition-colors">
              <Filter size={16} />
              Filtros
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Revenue Card */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-outline-variant/20 group hover:translate-y-[-4px] transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center text-success">
                <TrendingUpIcon size={24} />
              </div>
            </div>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Total Receitas</p>
            <h3 className="text-2xl font-black text-on-surface">{formatCurrency(metrics.revenue)}</h3>
          </div>

          {/* Expenses Card */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-outline-variant/20 group hover:translate-y-[-4px] transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-error/10 rounded-2xl flex items-center justify-center text-error">
                <TrendingDownIcon size={24} />
              </div>
            </div>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Despesas</p>
            <h3 className="text-2xl font-black text-on-surface">{formatCurrency(metrics.expenses)}</h3>
          </div>

          {/* Profit Card */}
          {isBusiness && (
            <div className={cn("p-6 rounded-3xl shadow-lg border transition-all duration-300 hover:translate-y-[-4px]", themeBorder, themeBg)}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
                  <Wallet size={24} />
                </div>
              </div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Lucro Real</p>
              <h3 className="text-2xl font-black text-white">{formatCurrency(metrics.profit)}</h3>
            </div>
          )}

          {/* Status de Pagamentos Card */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-outline-variant/20 group hover:translate-y-[-4px] transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Activity size={24} />
              </div>
            </div>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Status Pagamentos</p>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-success uppercase">Recebido</span>
                <span className="text-xs font-black text-on-surface">{formatCurrency(metrics.received)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-amber-600 uppercase">Pendente</span>
                <span className="text-xs font-black text-on-surface">{formatCurrency(metrics.pending)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-error uppercase">Atrasado</span>
                <span className="text-xs font-black text-on-surface">{formatCurrency(metrics.overdue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Category Distribution - Moved to top and styled like Reports */}
            <div className="bg-surface-container-lowest p-8 rounded-[40px] border border-outline-variant/20 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-on-surface">Distribuição por Categoria</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Onde você está gastando mais</p>
                </div>
                <PieChartIcon size={24} className="text-on-surface-variant opacity-40" />
              </div>
              <div className="h-[300px] w-full flex flex-col md:flex-row items-center">
                <div className="w-full md:w-1/2 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <RePieChart>
                      <Pie
                        data={metrics.categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="rawValue"
                      >
                        {metrics.categoryDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ReTooltip formatter={(value: any) => formatCurrency(value as number)} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-3 mt-6 md:mt-0 px-4">
                  {metrics.categoryDistribution.slice(0, 5).map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                        <span className="text-xs font-bold text-on-surface">{entry.name}</span>
                      </div>
                      <span className="text-xs font-black text-on-surface-variant">{formatCurrency(entry.rawValue)}</span>
                    </div>
                  ))}
                  {metrics.categoryDistribution.length === 0 && (
                    <p className="text-xs text-on-surface-variant italic text-center py-4">Sem dados de gastos este mês.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Widgets */}
          <div className="space-y-8">
            {/* Commercial Goals */}
            {isBusiness && (
              <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-on-surface">Meta Comercial</h3>
                  <button 
                    onClick={() => setIsGoalModalOpen(true)}
                    className="p-2 hover:bg-surface-container-high rounded-xl transition-colors text-primary"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
                <div className="space-y-6">
                  <div className="relative h-4 bg-surface-container-high rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(metrics.commercialCurrent / metrics.commercialGoal) * 100}%` }}
                      className="absolute inset-y-0 left-0 bg-primary rounded-full"
                    ></motion.div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Atual</p>
                      <p className="text-xl font-black text-on-surface">{formatCurrency(metrics.commercialCurrent)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Meta</p>
                      <p className="text-sm font-bold text-on-surface-variant">{formatCurrency(metrics.commercialGoal)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Card Spending */}
            <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-outline-variant/20 group hover:translate-y-[-4px] transition-all duration-300">
              <div className="flex items-start justify-between mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <CreditCard size={24} />
                </div>
                <div className="text-[10px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-full">
                  {Object.keys(metrics.cardBreakdown).length} Cartões
                </div>
              </div>
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">Gastos no Cartão</p>
              <h3 className="text-2xl font-black text-on-surface mb-3">{formatCurrency(metrics.cardSpending)}</h3>
              <div className="space-y-1.5 border-t border-outline-variant/10 pt-3">
                {metrics.cardBreakdown.map((card) => (
                  <div key={card.id} className="flex justify-between items-center text-[10px] font-bold">
                    <Link href={card.id !== 'unknown' ? `/cards?id=${card.id}` : '#'} className="text-on-surface-variant truncate max-w-[120px] hover:text-primary transition-colors">
                      {card.name}
                    </Link>
                    <span className="text-on-surface">{formatCurrency(card.value)}</span>
                  </div>
                ))}
                {metrics.cardBreakdown.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant italic">Nenhum gasto este mês.</p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <button 
                onClick={() => router.push('/transactions?new=true')}
                className={cn("w-full py-4 rounded-2xl text-white font-black flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all", themeBg)}
              >
                <Plus size={24} />
                Novo Lançamento
              </button>
            </div>
          </div>
        </div>

        {/* Smart Budgets Section - Moved to bottom and conditional */}
        {budgets.length > 0 && (
          <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-on-surface">Orçamentos Inteligentes</h3>
                <p className="text-sm text-on-surface-variant font-medium">Controle seus gastos por categoria</p>
              </div>
              <button 
                onClick={() => router.push('/budgets')}
                className={cn("p-2 rounded-xl bg-surface-container-high hover:bg-outline-variant/20 transition-all", themeColor)}
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {budgets.slice(0, 4).map((budget) => {
                const spent = transactions
                  .filter(t => t.category === budget.category && t.type === 'despesa')
                  .reduce((acc: number, t: any) => acc + t.value, 0);
                const percentage = Math.min((spent / budget.amount) * 100, 100);
                const isNearLimit = percentage >= 80;

                return (
                  <div key={budget.id} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-bold text-on-surface">{budget.category}</p>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Limite: {formatCurrency(budget.amount)}</p>
                      </div>
                      {isNearLimit && <AlertCircle size={16} className="text-error animate-pulse" />}
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className={cn("h-full rounded-full", percentage > 90 ? "bg-error" : percentage > 70 ? "bg-amber-500" : "bg-primary")}
                        ></motion.div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className={cn(percentage > 90 ? "text-error" : "text-on-surface-variant")}>
                          {formatCurrency(spent)} gastos
                        </span>
                        <span className="text-on-surface-variant">{Math.round(percentage)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Goal Modal */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGoalModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-[32px] p-8 shadow-2xl border border-outline-variant/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-on-surface">Definir Meta Comercial</h3>
                <button onClick={() => setIsGoalModalOpen(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-1">Valor da Meta (R$)</label>
                  <input 
                    type="number"
                    autoFocus
                    value={newGoal}
                    onChange={(e) => setNewGoal(parseFloat(e.target.value))}
                    className="w-full bg-surface-container-high border-none rounded-2xl px-4 py-3 font-bold focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <button 
                  onClick={() => {
                    localStorage.setItem(`janflow_goal_${user.uid}_${context}`, newGoal.toString());
                    setMetrics(prev => ({ ...prev, commercialGoal: newGoal }));
                    setIsGoalModalOpen(false);
                  }}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
                >
                  Salvar Meta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
