'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import {
  Plus,
  CreditCard,
  Trash2,
  Edit2,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  MoreVertical,
  ChevronRight,
  X,
  Building2,
  UserCircle2,
  Calendar,
  PieChart as PieChartIcon,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';
import { localDB } from '@/lib/localDB';
import { cn, parseLocalDate } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, isWithinInterval, getMonth, getYear, setMonth, setYear, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function CardsPage() {
  const router = useRouter();
  const { user, isAuthReady, context, isAdmin, isFinanceiro } = useAppContext();
  const [cards, setCards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [newCard, setNewCard] = useState({ name: '', bank: '', brand: '', type: 'pj', closingDay: '10' });
  const [isOtherBrand, setIsOtherBrand] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  const prevSelectedCardId = React.useRef<string | null>(null);

  useEffect(() => {
    if (selectedCardId && selectedCardId !== prevSelectedCardId.current && cards.length > 0) {
      const card = cards.find(c => c.id === selectedCardId);
      if (card) {
        const now = new Date();
        const closingDay = card.closingDay || 10;
        // Se hoje for >= fechamento, a fatura em aberto é a do próximo mês
        if (now.getDate() >= closingDay) {
          setSelectedMonth(addMonths(now, 1));
        } else {
          setSelectedMonth(now);
        }
      }
      prevSelectedCardId.current = selectedCardId;
    }
  }, [selectedCardId, cards]);

  useEffect(() => {
    if (isAuthReady && !user) {
      router.push('/login');
    }
  }, [user, isAuthReady, router]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // 1. Cache Instantâneo
      const cachedCards = localDB.getCached('cards', user.uid, context);
      const cachedCats = localDB.getCached('categories', user.uid, context);
      if (cachedCards.length > 0) {
        setCards(cachedCards);
        if (!selectedCardId) {
          setSelectedCardId(cachedCards[0].id);
        }
      }
      if (cachedCats.length > 0) {
        setCategories(cachedCats);
      }

      // 2. Busca Atualizada
      const [docs, catsDocs] = await Promise.all([
        localDB.get('cards', user.uid, context),
        localDB.get('categories', user.uid, context)
      ]);
      setCards(docs);
      setCategories(catsDocs || []);
      if (docs.length > 0 && !selectedCardId) {
        setSelectedCardId(docs[0].id);
      }
    };

    loadData();
  }, [user, context, selectedCardId, refreshTrigger]);

  useEffect(() => {
    if (!user || !selectedCardId) return;

    const loadTransactions = async () => {
      const selectedCard = cards.find(c => c.id === selectedCardId);
      if (!selectedCard) return;

      // Busca um intervalo amplo cobrindo do mês M-2 até M+2 para capturar as compras do ciclo de vencimento
      const startPeriod = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 2, 1);
      const endPeriod = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 2, 0);

      const from = format(startPeriod, 'yyyy-MM-dd');
      const to = format(endPeriod, 'yyyy-MM-dd');

      const allTransactions = await localDB.get('transactions', user.uid, context, { from, to });
      const cardTransactions = allTransactions
        .filter((t: any) => t.cardId === selectedCardId || t.card_id === selectedCardId)
        .sort((a: any, b: any) => {
          const dateA = parseLocalDate(a.date).getTime();
          const dateB = parseLocalDate(b.date).getTime();
          return dateB - dateA;
        });
      setTransactions(cardTransactions);
    };

    loadTransactions();
  }, [user, selectedCardId, context, selectedMonth, refreshTrigger]);

  const handleAddCard = async () => {
    if (!newCard.name || !user) return;
    setLoading(true);

    const payload = {
      ...newCard,
      limitAmount: parseFloat((newCard as any).limitAmount || (newCard as any).limit_amount) || 0,
      dueDay: parseInt((newCard as any).dueDay || (newCard as any).due_day) || (parseInt(newCard.closingDay) || 10) + 7,
      closingDay: parseInt(newCard.closingDay) || 10,
      uid: user.uid,
      context: context,
      type: context === 'empresa' ? 'pj' : 'pessoal',
      createdAt: new Date().toISOString(),
      id: editingCard?.id || 'temp_' + Date.now(),
    };

    // Atualização Otimista
    setCards(prev => {
      if (editingCard) return prev.map(c => c.id === payload.id ? payload : c);
      return [payload, ...prev];
    });

    setIsModalOpen(false);
    setEditingCard(null);
    setNewCard({ name: '', bank: '', brand: '', type: context === 'empresa' ? 'pj' : 'pessoal', closingDay: '10' });
    setIsOtherBrand(false);
    setLoading(false);

    // Background
    (async () => {
      try {
        await localDB.save('cards', payload);
        triggerRefresh();
      } catch (error) {
        console.error('Error saving card:', error);
        triggerRefresh();
      }
    })();
  };

  const handleDeleteCard = async (id: string) => {
    setCardToDelete(id);
  };

  const confirmDelete = async () => {
    if (cardToDelete) {
      const idToDelete = cardToDelete;

      // Otimista
      setCards(prev => prev.filter(c => c.id !== idToDelete));
      if (selectedCardId === idToDelete) setSelectedCardId(null);
      setCardToDelete(null);

      (async () => {
        try {
          await localDB.delete('cards', idToDelete);
          triggerRefresh();
        } catch (err) {
          console.error(err);
          triggerRefresh();
        }
      })();
    }
  };

  const handleEditCard = (card: any) => {
    setEditingCard(card);
    setNewCard({
      name: card.name,
      bank: card.bank,
      brand: card.brand,
      type: card.type,
      closingDay: (card.closingDay || 10).toString()
    });
    setIsOtherBrand(!['Visa', 'Mastercard', 'Elo', 'Amex'].includes(card.brand) && card.brand !== '');
    setIsModalOpen(true);
  };

  const categoryData = React.useMemo(() => {
    const data: { [key: string]: number } = {};
    const selectedCard = cards.find(c => c.id === selectedCardId);
    const closingDay = selectedCard?.closingDay || 10;

    // Se o filtro selecionado é a Fatura que VENCE em Mês M (ex: AGOSTO),
    // O período de compras é de closingDay do Mês M-2 (ex: 30 JUN) até (closingDay + 1 ou 31) do Mês M-1 (ex: 31 JUL)
    const selYear = selectedMonth.getFullYear();
    const selMonth = selectedMonth.getMonth();

    const startCycle = new Date(selYear, selMonth - 2, closingDay);
    const endCycle = new Date(selYear, selMonth - 1, closingDay + 1);

    const filtered = transactions.filter(t => {
      const tDate = parseLocalDate(t.date);
      return isWithinInterval(tDate, { start: startCycle, end: endCycle });
    });

    filtered
      .forEach(t => {
        data[t.category] = (data[t.category] || 0) + t.value;
      });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [transactions, cards, selectedCardId, selectedMonth]);

  if (!isAuthReady || !user) return null;

  const isBusiness = context === 'empresa';
  const themeColor = isBusiness ? 'text-[#1d8490]' : 'text-[#ff6330]';
  const themeBg = isBusiness ? 'bg-[#1d8490]' : 'bg-[#ff6330]';
  const themeBorder = isBusiness ? 'border-[#1d8490]' : 'border-[#ff6330]';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const selectedCard = cards.find(c => c.id === selectedCardId);
  const closingDay = selectedCard?.closingDay || 10;

  const selYear = selectedMonth.getFullYear();
  const selMonth = selectedMonth.getMonth();

  const cycleStart = new Date(selYear, selMonth - 2, closingDay);
  const cycleEnd = new Date(selYear, selMonth - 1, closingDay + 1);

  const filteredTransactions = transactions.filter(t => {
    const tDate = parseLocalDate(t.date);
    const matchesMonth = isWithinInterval(tDate, { start: cycleStart, end: cycleEnd });
    if (!matchesMonth) return false;

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      ((t.entityName || '').toLowerCase()).includes(searchLower) ||
      ((t.category || '').toLowerCase()).includes(searchLower) ||
      ((t.description || '').toLowerCase()).includes(searchLower) ||
      (t.value || '').toString().includes(searchLower) ||
      formatCurrency(t.value || 0).toLowerCase().includes(searchLower) ||
      format(tDate, 'dd/MM/yyyy').includes(searchLower);

    const matchesCategory = selectedCategory === 'todas' || t.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const duplicateIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < filteredTransactions.length; i++) {
      for (let j = i + 1; j < filteredTransactions.length; j++) {
        const a = filteredTransactions[i];
        const b = filteredTransactions[j];

        const sameDate = a.date === b.date;
        const sameValue = Math.abs(Number(a.value) - Number(b.value)) < 0.01;

        const nameA = (a.entityName || '').toLowerCase().trim();
        const nameB = (b.entityName || '').toLowerCase().trim();

        const isNameSimilar = nameA === nameB ||
          (nameA.length > 3 && nameB.length > 3 && (nameA.includes(nameB) || nameB.includes(nameA)));

        if (sameDate && sameValue && isNameSimilar) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [filteredTransactions]);

  const totalInvoice = filteredTransactions.reduce((acc: number, t: any) => acc + t.value, 0);

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = ['Data', 'Cartão', 'Entidade', 'Descrição', 'Categoria', 'Valor (R$)', 'Parcela', 'Status'];
    const rows = filteredTransactions.map(t => [
      format(parseLocalDate(t.date), 'dd/MM/yyyy'),
      selectedCard?.name || '',
      t.entityName || '',
      t.description || '',
      t.category || '',
      t.value.toFixed(2),
      t.currentInstallment && t.installments > 1 ? `${t.currentInstallment}/${t.installments}` : 'À vista',
      t.status || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fatura_${(selectedCard?.name || 'cartao').toLowerCase().replace(/\s+/g, '_')}_${format(selectedMonth, 'MM_yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

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
            <h2 className="text-3xl font-black tracking-tight text-on-surface">Gestão de Cartões</h2>
            <p className="text-on-surface-variant font-medium mt-1">Monitore suas faturas e gerencie seus limites.</p>
          </div>
          <button
            onClick={() => {
              setEditingCard(null);
              setNewCard({ name: '', bank: '', brand: '', type: isBusiness ? 'pj' : 'pessoal', closingDay: '1' });
              setIsModalOpen(true);
            }}
            className={cn("px-6 py-3 rounded-2xl text-white font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all", themeBg)}
          >
            <Plus size={20} />
            Novo Cartão
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Cards List */}
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-2">Seus Cartões</h3>
            <div className="space-y-4">
              {cards.length > 0 ? (
                cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className={cn(
                      "relative p-6 rounded-[32px] border-2 transition-all cursor-pointer group overflow-hidden",
                      selectedCardId === card.id ? themeBorder + " bg-surface-container-low" : "border-outline-variant/20 bg-surface-container-lowest hover:border-outline-variant/60"
                    )}
                  >
                    {/* Card Background Pattern */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-surface-container-highest/20 rounded-full blur-2xl group-hover:bg-surface-container-highest/40 transition-colors"></div>

                    <div className="flex items-start justify-between mb-8">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                        card.type === 'pj' ? "bg-[#1d8490]" : "bg-[#ff6330]"
                      )}>
                        <CreditCard size={20} />
                      </div>
                      <div className="flex items-center gap-1 relative z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditCard(card); }}
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        {(isAdmin || isFinanceiro) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }}
                            className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-black text-on-surface">{card.name}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">{card.bank} • {card.brand}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                            Fecha dia {card.closingDay || 10}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full",
                            card.type === 'pj' ? "bg-[#1d8490]/10 text-[#1d8490]" : "bg-[#ff6330]/10 text-[#ff6330]"
                          )}>
                            {card.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center bg-surface-container-lowest rounded-[32px] border border-dashed border-outline-variant/40">
                  <p className="text-on-surface-variant font-medium">Nenhum cartão cadastrado.</p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="lg:col-span-2">
            {selectedCardId ? (
              <div className="bg-surface-container-lowest rounded-[40px] border border-outline-variant/20 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-8 border-b border-outline-variant/20 bg-surface-container-low/30">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-1">Valor da Fatura</p>
                      <h3 className="text-4xl font-black text-on-surface">{formatCurrency(totalInvoice)}</h3>
                      <p className="text-sm text-on-surface-variant font-medium mt-1">
                        {selectedCard?.name} • {selectedCard?.bank}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest font-black text-on-surface-variant/60 mt-2 flex items-center gap-2">
                        {getMonth(new Date()) === getMonth(selectedMonth) && getYear(new Date()) === getYear(selectedMonth) && (
                          <span className="text-[10px] font-black bg-success/10 text-success px-2 py-0.5 rounded-full uppercase tracking-widest">
                            Fatura Atual
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleExportCSV}
                        disabled={filteredTransactions.length === 0}
                        title="Exportar fatura do cartão em CSV"
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                          themeBg,
                          "text-white"
                        )}
                      >
                        <Download size={16} />
                        <span className="hidden sm:inline">Exportar Fatura</span>
                      </button>
                      <div className="flex items-center gap-2 bg-surface-container-high p-1 rounded-2xl">
                        <select
                          value={getMonth(selectedMonth)}
                          onChange={(e) => setSelectedMonth(setMonth(selectedMonth, parseInt(e.target.value)))}
                          className="bg-transparent border-none text-xs font-black uppercase tracking-widest focus:ring-0 py-2 px-3 cursor-pointer"
                        >
                          {months.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                        <select
                          value={getYear(selectedMonth)}
                          onChange={(e) => setSelectedMonth(setYear(selectedMonth, parseInt(e.target.value)))}
                          className="bg-transparent border-none text-xs font-black uppercase tracking-widest focus:ring-0 py-2 px-3 cursor-pointer"
                        >
                          {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-8 overflow-y-auto space-y-12">
                  {/* Category Chart */}
                  {categoryData.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2">
                        <PieChartIcon size={18} className="text-on-surface-variant" />
                        <h4 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">Gastos por Categoria</h4>
                      </div>
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <PieChart>
                            <Pie
                              data={categoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1a1c1e',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#fff',
                                fontWeight: 'bold'
                              }}
                              itemStyle={{ color: '#fff' }}
                              formatter={(value: any) => formatCurrency(value as number)}
                            />
                            <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6 pt-4 border-t border-outline-variant/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-on-surface-variant" />
                        <h4 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">
                          Lançamentos na Fatura ({filteredTransactions.length})
                        </h4>
                      </div>

                      {/* Filtros da Fatura */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Filtro por Categoria */}
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="bg-surface-container-high border-none rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 text-on-surface-variant cursor-pointer max-w-[160px]"
                        >
                          <option value="todas">Todas as Categorias</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>

                        {/* Campo Unificado de Busca (Nome, Categoria, Descrição, Valor) */}
                        <div className="relative min-w-[200px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={14} />
                          <input
                            type="text"
                            placeholder="Buscar por nome, valor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-2 bg-surface-container-high border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20 w-full"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Resumo do Valor Total Filtrado na Fatura */}
                    <div className="p-4 rounded-2xl bg-surface-container-high flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total da Fatura Exibida</span>
                      <span className="text-base font-black text-error">{formatCurrency(totalInvoice)}</span>
                    </div>

                    {duplicateIds.size > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-600"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <AlertTriangle size={20} className="shrink-0" />
                        </motion.div>
                        <div className="text-xs font-bold">
                          <p className="font-black uppercase tracking-wider text-[11px]">Possível Lançamento Duplicado Detectado!</p>
                          <p className="opacity-90 font-medium">Identificamos compras com mesma data, valor e nomes parecidos nesta fatura. Verifique os itens marcados abaixo.</p>
                        </div>
                      </motion.div>
                    )}

                    <div className="space-y-4">
                      {filteredTransactions.length > 0 ? (
                        filteredTransactions.map((t) => {
                          const isDuplicate = duplicateIds.has(t.id);
                          return (
                            <div
                              key={t.id}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-2xl transition-colors group relative overflow-hidden",
                                isDuplicate ? "bg-amber-500/10 border-2 border-amber-500/40 hover:bg-amber-500/15" : "hover:bg-surface-container-low"
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-error/10 text-error rounded-xl flex items-center justify-center shrink-0">
                                  <ArrowDownRight size={18} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-on-surface">{t.entityName}</p>
                                    {isDuplicate && (
                                      <motion.span
                                        animate={{ opacity: [0.6, 1, 0.6], scale: [0.98, 1.02, 0.98] }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                        className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500 text-black flex items-center gap-1 shadow-sm"
                                      >
                                        <AlertTriangle size={10} />
                                        Possível Duplicado
                                      </motion.span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                    <p className="text-xs text-on-surface-variant font-medium">
                                      {t.category} • {format(parseLocalDate(t.date), 'dd MMM', { locale: ptBR })}
                                    </p>
                                    {t.createdBy && (
                                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                        por: {t.createdBy}
                                      </span>
                                    )}
                                    {t.currentInstallment && t.installments > 1 && (
                                      <span className="text-[10px] font-black bg-surface-container-highest px-2 py-0.5 rounded-full text-on-surface-variant">
                                        Parcela {t.currentInstallment}/{t.installments}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="font-black text-error">- {formatCurrency(t.value)}</p>
                                </div>
                                <button
                                  onClick={() => router.push(`/transactions?editId=${t.id}`)}
                                  title="Abrir no Lançamento"
                                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                >
                                  <ExternalLink size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-20 text-center opacity-40">
                          <p className="font-bold">Nenhum lançamento nesta fatura.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-surface-container-low/30 rounded-[40px] border-2 border-dashed border-outline-variant/40 p-12 text-center">
                <div className="w-20 h-20 bg-surface-container-high rounded-3xl flex items-center justify-center text-on-surface-variant mb-6">
                  <CreditCard size={40} />
                </div>
                <h3 className="text-xl font-black text-on-surface">Selecione um Cartão</h3>
                <p className="text-on-surface-variant font-medium mt-2 max-w-xs">Escolha um cartão ao lado para visualizar os detalhes da fatura e lançamentos.</p>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {cardToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCardToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative bg-surface-container-lowest p-8 rounded-[32px] shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="text-error" size={32} />
              </div>
              <h3 className="text-xl font-black text-on-surface mb-2">Excluir Cartão</h3>
              <p className="text-on-surface-variant mb-8">Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setCardToDelete(null)}
                  className="flex-1 py-3 bg-surface-container-high text-on-surface font-black rounded-2xl hover:bg-outline-variant/20 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-error text-white font-black rounded-2xl shadow-lg hover:bg-error/90 transition-all"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Card Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-surface-container-lowest w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
                <h3 className="text-xl font-black text-on-surface">
                  {editingCard ? 'Editar Cartão' : 'Novo Cartão'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome do Cartão</label>
                  <input
                    value={newCard.name}
                    onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                    placeholder="Ex: Nubank PJ, Inter Pessoal"
                    className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Banco</label>
                    <input
                      value={newCard.bank}
                      onChange={(e) => setNewCard({ ...newCard, bank: e.target.value })}
                      placeholder="Ex: Nubank"
                      className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Dia de Fechamento</label>
                    <select
                      value={newCard.closingDay}
                      onChange={(e) => setNewCard({ ...newCard, closingDay: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day.toString()}>{day}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Bandeira</label>
                    <select
                      value={isOtherBrand ? 'Outro' : newCard.brand}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Outro') {
                          setIsOtherBrand(true);
                          setNewCard({ ...newCard, brand: '' });
                        } else {
                          setIsOtherBrand(false);
                          setNewCard({ ...newCard, brand: val });
                        }
                      }}
                      className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Selecione...</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="Elo">Elo</option>
                      <option value="Amex">Amex</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  {isOtherBrand && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome da Bandeira</label>
                      <input
                        value={newCard.brand}
                        onChange={(e) => setNewCard({ ...newCard, brand: e.target.value })}
                        placeholder="Digite o nome da bandeira"
                        className="w-full px-4 py-3 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-surface-container-high text-on-surface font-black rounded-2xl hover:bg-outline-variant/20 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={loading || !newCard.name}
                    onClick={handleAddCard}
                    className={cn("flex-1 py-4 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50", themeBg)}
                  >
                    {loading ? 'Salvando...' : editingCard ? 'Salvar' : 'Cadastrar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}
