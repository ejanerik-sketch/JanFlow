'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import { 
  BarChart3, 
  Download, 
  FileText, 
  Table, 
  Calendar, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  CreditCard, 
  Activity,
  FileCheck,
  ChevronRight,
  Search,
  ChevronLeft,
  ArrowRightLeft,
  Briefcase,
  User as UserIcon,
  Layers,
  Building
} from 'lucide-react';
import { localDB } from '@/lib/localDB';
import { format, startOfMonth, endOfMonth, subMonths, getYear, setYear, setMonth, addMonths, startOfYear, endOfYear, subYears, isSameMonth, isSameYear, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

export default function ReportsPage() {
  const router = useRouter();
  const { user, isAuthReady, context } = useAppContext();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'mensal' | 'anual'>('mensal');
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadCatsCards = async () => {
      const cats = await localDB.get('categories', user.uid, context);
      const crdsRaw = await localDB.get('cards', user.uid);
      const crds = crdsRaw.filter((c: any) => c.context === context);
      setCategories(cats);
      setCards(crds);
    };
    loadCatsCards();
  }, [user, context]);

  useEffect(() => {
    if (isAuthReady && !user) {
      router.push('/login');
    }
  }, [user, isAuthReady, router]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const start = viewMode === 'mensal' ? startOfMonth(selectedMonth) : startOfYear(selectedMonth);
      const end = viewMode === 'mensal' ? endOfMonth(selectedMonth) : endOfYear(selectedMonth);

      const allTrans = await localDB.get('transactions', user.uid, context);
      setAllTransactions(allTrans);
      
      const filtered = allTrans.filter((t: any) => {
        const tDate = new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date);
        return tDate >= start && tDate <= end;
      }).sort((a: any, b: any) => {
        const dateA = new Date(a.date?.seconds ? a.date.seconds * 1000 : a.date).getTime();
        const dateB = new Date(b.date?.seconds ? b.date.seconds * 1000 : b.date).getTime();
        return dateA - dateB;
      });

      setTransactions(filtered);

      // Load clients for contract info
      const savedClients = localStorage.getItem('janflow_clients_list');
      if (savedClients) {
        setClients(JSON.parse(savedClients));
      }

      // Comparison data (previous year)
      if (viewMode === 'anual') {
        const prevYearStart = startOfYear(subYears(selectedMonth, 1));
        const prevYearEnd = endOfYear(subYears(selectedMonth, 1));
        const prevYearTrans = allTrans.filter((t: any) => {
          const tDate = new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date);
          return tDate >= prevYearStart && tDate <= prevYearEnd;
        });
        
        // Group by month for comparison
        const currentYearByMonth = Array.from({ length: 12 }, (_, i) => {
          const monthTrans = filtered.filter((t: any) => new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date).getMonth() === i);
          return {
            month: format(new Date(2000, i, 1), 'MMM', { locale: ptBR }),
            current: monthTrans.reduce((acc: number, t: any) => t.type === 'receita' ? acc + t.value : acc - t.value, 0),
            previous: 0
          };
        });

        const prevYearByMonth = Array.from({ length: 12 }, (_, i) => {
          const monthTrans = prevYearTrans.filter((t: any) => new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date).getMonth() === i);
          return monthTrans.reduce((acc: number, t: any) => t.type === 'receita' ? acc + t.value : acc - t.value, 0);
        });

        const comparison = currentYearByMonth.map((item, i) => ({
          ...item,
          previous: prevYearByMonth[i]
        }));
        setComparisonData(comparison);
      }
    };

    loadData();
  }, [user, context, selectedMonth, viewMode]);

  const annualCategoryData = useMemo(() => {
    if (!user || viewMode !== 'anual' || allTransactions.length === 0) return [];
    
    return Array.from({ length: 12 }, (_, i) => {
      const monthTrans = allTransactions.filter((t: any) => {
        const tDate = new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date);
        return tDate.getFullYear() === getYear(selectedMonth) && tDate.getMonth() === i;
      });
      
      const monthData: any = {
        name: format(new Date(getYear(selectedMonth), i), 'MMM', { locale: ptBR }),
        receita: monthTrans.filter((t: any) => t.type === 'receita').reduce((acc: number, t: any) => acc + t.value, 0),
        despesa: monthTrans.filter((t: any) => t.type === 'despesa').reduce((acc: number, t: any) => acc + t.value, 0),
      };

      categories.forEach(cat => {
        monthData[cat.name] = monthTrans
          .filter((t: any) => t.category === cat.name && t.type === 'despesa')
          .reduce((acc: number, t: any) => acc + t.value, 0);
      });

      return monthData;
    });
  }, [user, selectedMonth, viewMode, categories, allTransactions]);

  const annualCardData = useMemo(() => {
    if (!user || viewMode !== 'anual' || allTransactions.length === 0) return [];
    
    return Array.from({ length: 12 }, (_, i) => {
      const monthTrans = allTransactions.filter((t: any) => {
        const tDate = new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date);
        return tDate.getFullYear() === getYear(selectedMonth) && tDate.getMonth() === i;
      });
      
      const monthData: any = {
        name: format(new Date(getYear(selectedMonth), i), 'MMM', { locale: ptBR }),
      };

      cards.forEach(card => {
        monthData[card.name] = monthTrans
          .filter((t: any) => t.paymentMethod === 'cartao_credito' && t.cardId === card.id)
          .reduce((acc: number, t: any) => acc + t.value, 0);
      });

      return monthData;
    });
  }, [user, selectedMonth, viewMode, cards, allTransactions]);

  if (!isAuthReady || !user) return null;

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

  // Data processing for charts
  const categoryData = transactions.reduce((acc: any, t) => {
    if (t.type === 'despesa') {
      const catObj = categories.find(c => c.name === t.category);
      const existing = acc.find((item: any) => item.name === t.category);
      if (existing) existing.value += t.value;
      else acc.push({ name: t.category, value: t.value, color: catObj?.color || '#94a3b8' });
    }
    return acc;
  }, []);

  // Fixed vs Variable
  const fixedExpenses = transactions.filter((t: any) => t.type === 'despesa' && t.recurrent).reduce((acc: number, t: any) => acc + t.value, 0);
  const variableExpenses = transactions.filter((t: any) => t.type === 'despesa' && !t.recurrent).reduce((acc: number, t: any) => acc + t.value, 0);

  // Card breakdown
  const cardMap: Record<string, { id: string, name: string, bank: string, lastDigits: string, spending: number }> = {};
  
  cards.forEach(c => {
    cardMap[c.id] = {
      id: c.id,
      name: c.name,
      bank: c.bank || 'Desconhecido',
      lastDigits: c.lastDigits || '****',
      spending: 0
    };
  });

  transactions.forEach(t => {
    if (t.paymentMethod === 'cartao_credito') {
      const cardObj = cards.find(c => c.id === t.cardId);
      if (cardObj && cardMap[cardObj.id]) {
        cardMap[cardObj.id].spending += t.value;
      }
    }
  });
  const cardBreakdown = Object.values(cardMap).sort((a, b) => b.spending - a.spending);

  // Financing breakdown
  const financingSpending = transactions
    .filter((t: any) => t.paymentMethod === 'financiamento')
    .reduce((acc: number, t: any) => acc + t.value, 0);

  const dailyData = transactions.reduce((acc: any, t) => {
    const tDate = new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date);
    const day = viewMode === 'mensal' ? format(tDate, 'dd/MM') : format(tDate, 'MMM', { locale: ptBR });
    const existing = acc.find((item: any) => item.day === day);
    if (existing) {
      if (t.type === 'receita') existing.receita += t.value;
      else existing.despesa += t.value;
    } else {
      acc.push({ 
        day, 
        receita: t.type === 'receita' ? t.value : 0, 
        despesa: t.type === 'despesa' ? t.value : 0 
      });
    }
    return acc;
  }, []);

  // Card Analysis: Empresa vs Pessoa
  const cardAnalysis = transactions.reduce((acc: any, t) => {
    if (t.paymentMethod === 'cartao_credito') {
      const cat = t.context === 'empresa' ? 'Empresa' : 'Pessoa';
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += t.value;
    }
    return acc;
  }, { Empresa: 0, Pessoa: 0 });

  // Status Summary in values
  const statusSummary = transactions.reduce((acc: any, t) => {
    if (t.status === 'pago' || t.status === 'recebido') acc.pago += t.value;
    else if (t.status === 'pendente' || t.status === 'a_pagar' || t.status === 'a_receber') acc.pendente += t.value;
    else if (t.status === 'atrasado') acc.atrasado += t.value;
    return acc;
  }, { pago: 0, pendente: 0, atrasado: 0 });

  // Receivables: Contrato vs Serviço Avulso
  const receivables = {
    contrato: clients.reduce((acc: number, c: any) => acc + (Number(c.contractValue) || 0), 0),
    avulso: transactions.filter((t: any) => t.type === 'receita' && !t.recurrent).reduce((acc: number, t: any) => acc + t.value, 0)
  };

  // Active Contracts: Clients + Recurring Receipts
  const activeContracts = [
    ...clients.map(c => ({ name: c.name, value: Number(c.contractValue) || 0, type: 'Cliente' })),
    ...transactions.filter((t: any) => t.type === 'receita' && t.recurrent && !clients.find(c => c.name === t.entityName))
      .map(t => ({ name: t.entityName, value: t.value, type: 'Recorrente' }))
  ].sort((a, b) => b.value - a.value);

  // Commercial Indicators logic
  const commercialIndicators = transactions.reduce((acc: any, t) => {
    if (t.type === 'receita') {
      if (t.category?.toLowerCase().includes('contrato') || t.description?.toLowerCase().includes('novo contrato')) {
        acc.new++;
      }
    } else if (t.type === 'despesa') {
      if (t.description?.toLowerCase().includes('cancelamento') || t.description?.toLowerCase().includes('cancelado')) {
        acc.cancelled++;
      }
    }
    return acc;
  }, { new: 0, cancelled: 0 });

  // Installment Analysis: Count and Total
  const installmentAnalysis = transactions.reduce((acc: any, t) => {
    if (t.installments > 1 && t.groupId) {
      if (!acc.groups.has(t.groupId)) {
        acc.groups.add(t.groupId);
        acc.count++;
      }
      acc.total += t.value;
    }
    return acc;
  }, { count: 0, total: 0, groups: new Set() });

  // Shared Purchases (Pessoal only)
  const sharedPurchases = transactions.filter((t: any) => t.context === 'pessoal' && t.isShared && t.sharedWith);
  const sharedByPerson = sharedPurchases.reduce((acc: any, t: any) => {
    const people = t.sharedWith.split(',').map((p: string) => p.trim()).filter(Boolean);
    people.forEach((person: string) => {
      const normalizedPerson = person.toLowerCase();
      const existingKey = Object.keys(acc).find(k => k.toLowerCase() === normalizedPerson);
      const keyToUse = existingKey || person;

      if (!acc[keyToUse]) acc[keyToUse] = { total: 0, items: [] };
      acc[keyToUse].total += t.value;
      acc[keyToUse].items.push(t);
    });
    return acc;
  }, {});

  const handleExportCSV = () => {
    const data = transactions.map(t => ({
      Data: format(new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date), 'dd/MM/yyyy'),
      Tipo: t.type === 'receita' ? 'Receita' : 'Despesa',
      Entidade: t.entityName,
      Descrição: t.description || '',
      Categoria: t.category,
      Valor: t.value,
      Status: t.status,
      'Método de Pagamento': t.paymentMethod,
      'Parcelas': t.installments || 1,
      'Parcela Atual': t.currentInstallment || 1,
      'Recorrente': t.recurrent ? 'Sim' : 'Não',
      'Contexto': t.context === 'empresa' ? 'Empresa' : 'Pessoal',
      'Observação': t.observation || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Completo");
    XLSX.writeFile(wb, `Relatorio_Financeiro_${format(selectedMonth, 'yyyy_MM')}.xlsx`);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('report-content');
    if (!element) {
      setIsExporting(false);
      return;
    }

    try {
      // Create a clone to modify for printing
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
        onclone: (clonedDoc) => {
          const noPrint = clonedDoc.querySelectorAll('.no-print');
          noPrint.forEach(el => (el as HTMLElement).style.display = 'none');
          
          // Ensure charts are visible
          const charts = clonedDoc.querySelectorAll('.recharts-wrapper');
          charts.forEach(el => (el as HTMLElement).style.visibility = 'visible');
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const contentWidth = pdfWidth - 20; // 10mm margins
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;
      
      let heightLeft = contentHeight;
      let position = 10; // Start with 10mm margin

      // First page
      pdf.addImage(imgData, 'PNG', 10, position, contentWidth, contentHeight);
      heightLeft -= (pdfHeight - 20);

      // Subsequent pages
      while (heightLeft > 0) {
        position = heightLeft - contentHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, contentWidth, contentHeight);
        heightLeft -= (pdfHeight - 20);
      }

      pdf.save(`Relatorio_Financeiro_${format(selectedMonth, 'yyyy_MM')}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const COLORS = ['#1d8490', '#ff6330', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <Layout>
      <div id="report-content" className="space-y-10 p-4 relative">
        {isExporting && (
          <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center no-print">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-black text-on-surface">Gerando PDF...</p>
            <p className="text-sm text-on-surface-variant font-medium">Isso pode levar alguns segundos.</p>
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-on-surface">Relatórios Financeiros</h2>
            <p className="text-on-surface-variant font-medium mt-1">
              Análise detalhada {viewMode === 'mensal' ? `de ${format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}` : `do ano de ${getYear(selectedMonth)}`}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-surface-container-high p-1.5 rounded-2xl shadow-inner">
            <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-xl shadow-sm">
              <button 
                onClick={() => setViewMode('mensal')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                  viewMode === 'mensal' ? themeBg + " text-white shadow-md" : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                Mensal
              </button>
              <button 
                onClick={() => setViewMode('anual')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                  viewMode === 'anual' ? themeBg + " text-white shadow-md" : "text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                Anual
              </button>
            </div>

            <div className="flex items-center gap-2 px-2">
              <button 
                onClick={() => setSelectedMonth(viewMode === 'mensal' ? subMonths(selectedMonth, 1) : subYears(selectedMonth, 1))}
                className="p-2 hover:bg-surface-container-highest rounded-xl transition-colors text-on-surface-variant"
              >
                <ChevronLeft size={18} />
              </button>
              
              <select 
                value={getYear(selectedMonth)}
                onChange={(e) => setSelectedMonth(setYear(selectedMonth, parseInt(e.target.value)))}
                className="bg-transparent border-none text-sm font-bold text-on-surface focus:ring-0 pr-8"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              
              {viewMode === 'mensal' && (
                <select 
                  value={selectedMonth.getMonth()}
                  onChange={(e) => setSelectedMonth(setMonth(selectedMonth, parseInt(e.target.value)))}
                  className="bg-transparent border-none text-sm font-bold text-on-surface focus:ring-0 pr-8"
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              )}

              <button 
                onClick={() => setSelectedMonth(viewMode === 'mensal' ? addMonths(selectedMonth, 1) : addMonths(selectedMonth, 12))}
                className="p-2 hover:bg-surface-container-highest rounded-xl transition-colors text-on-surface-variant"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="w-px h-6 bg-outline-variant/30"></div>
            <div className="flex items-center gap-1">
              <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="p-2.5 hover:bg-surface-container-highest rounded-xl transition-colors text-on-surface-variant disabled:opacity-50" 
                title="Exportar PDF"
              >
                <FileText size={20} />
              </button>
              <button 
                onClick={handleExportCSV}
                className="p-2.5 hover:bg-surface-container-highest rounded-xl transition-colors text-on-surface-variant" 
                title="Exportar Excel"
              >
                <Table size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-success/10 text-success rounded-xl flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Total Receitas</p>
            </div>
            <h3 className="text-2xl font-black text-on-surface">
              {formatCurrency(transactions.filter((t: any) => t.type === 'receita').reduce((acc: number, t: any) => acc + t.value, 0))}
            </h3>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-error/10 text-error rounded-xl flex items-center justify-center">
                <TrendingDown size={20} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Despesas Fixas</p>
            </div>
            <h3 className="text-2xl font-black text-on-surface">
              {formatCurrency(fixedExpenses)}
            </h3>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                <Layers size={20} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Despesas Variáveis</p>
            </div>
            <h3 className="text-2xl font-black text-on-surface">
              {formatCurrency(variableExpenses)}
            </h3>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-error/10 text-error rounded-xl flex items-center justify-center">
                <TrendingDown size={20} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Despesas Totais</p>
            </div>
            <h3 className="text-2xl font-black text-on-surface">
              {formatCurrency(fixedExpenses + variableExpenses)}
            </h3>
          </div>

          <div className={cn("p-6 rounded-3xl border shadow-lg", themeBorder, themeBg)}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center">
                <Activity size={20} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-white/70">Saldo do Período</p>
            </div>
            <h3 className="text-2xl font-black text-white">
              {formatCurrency(transactions.reduce((acc: number, t: any) => t.type === 'receita' ? acc + t.value : acc - t.value, 0))}
            </h3>
          </div>
        </div>

        {/* Cards and Installments Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Registered Cards */}
          <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
            <h3 className="text-xl font-black text-on-surface mb-6">Cartões Cadastrados ({isBusiness ? 'Empresa' : 'Pessoal'})</h3>
            <div className="space-y-4">
              {cardBreakdown.map(card => (
                <div key={card.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <Link href={card.id !== 'unknown' ? `/cards?id=${card.id}` : '#'} className="text-sm font-bold text-on-surface hover:text-primary transition-colors">
                        {card.name}
                      </Link>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{card.bank} • Final {card.lastDigits}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-on-surface">{formatCurrency(card.spending)}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Gasto no Mês</p>
                  </div>
                </div>
              ))}
              {cardBreakdown.length === 0 && (
                <p className="text-sm text-on-surface-variant italic text-center py-8">Nenhum cartão cadastrado para este contexto.</p>
              )}
            </div>
          </div>

          {/* Installment Analysis */}
          <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
            <h3 className="text-xl font-black text-on-surface mb-6">Compras Parceladas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Cartão de Crédito</p>
                <p className="text-2xl font-black text-on-surface">{formatCurrency(transactions.filter((t: any) => t.paymentMethod === 'cartao_credito' && t.installments > 1).reduce((acc: number, t: any) => acc + t.value, 0))}</p>
              </div>
              <div className="p-6 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Financiamento</p>
                <p className="text-2xl font-black text-on-surface">{formatCurrency(transactions.filter((t: any) => t.paymentMethod === 'financiamento' && t.installments > 1).reduce((acc: number, t: any) => acc + t.value, 0))}</p>
              </div>
            </div>
            <div className="mt-6 p-6 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold text-on-surface">Total Parcelado</p>
                <p className="text-xl font-black text-primary">{formatCurrency(transactions.filter((t: any) => (t.paymentMethod === 'cartao_credito' || t.paymentMethod === 'financiamento') && t.installments > 1).reduce((acc: number, t: any) => acc + t.value, 0))}</p>
              </div>
            </div>
          </div>
        </div>

        {viewMode === 'anual' ? (
          <div className="space-y-8">
            <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-on-surface">Análise Anual</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Fluxo de caixa ao longo de {getYear(selectedMonth)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-success"></div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Receita</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-error"></div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Despesa</span>
                  </div>
                </div>
              </div>
              <div className="min-h-[400px] w-full">
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={comparisonData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(value as number)}
                    />
                    <Area type="monotone" dataKey="current" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" name="Este Ano" />
                    <Area type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="transparent" name="Ano Anterior" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
              <h3 className="text-xl font-black text-on-surface mb-8">Gastos Mensais por Categoria</h3>
              <div className="min-h-[400px] w-full">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={annualCategoryData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(value as number)}
                    />
                    {categories.map((cat, index) => (
                      <Bar 
                        key={cat.id} 
                        dataKey={cat.name} 
                        stackId="a" 
                        fill={cat.color} 
                        radius={index === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
              <h3 className="text-xl font-black text-on-surface mb-8">Faturas de Cartão por Mês</h3>
              <div className="min-h-[400px] w-full">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={annualCardData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(value as number)}
                    />
                    {cards.map((card, index) => (
                      <Bar 
                        key={card.id} 
                        dataKey={card.name} 
                        stackId="a" 
                        fill={COLORS[index % COLORS.length]} 
                        radius={index === cards.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Daily Analysis */}
            <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-on-surface">Análise Diária</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Fluxo de caixa ao longo do mês</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-success"></div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Receita</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-error"></div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Despesa</span>
                  </div>
                </div>
              </div>
              <div className="min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(value as number)}
                    />
                    <Area type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Distribution */}
            <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-on-surface">Distribuição por Categoria</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Onde você está gastando mais</p>
                </div>
                <PieChart size={24} className="text-on-surface-variant opacity-40" />
              </div>
              <div className="h-[300px] w-full flex flex-col md:flex-row items-center">
                <div className="w-full md:w-1/2 min-h-[300px]">
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(value as number)} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-3 mt-6 md:mt-0 px-4">
                  {categoryData.slice(0, 5).map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                        <span className="text-xs font-bold text-on-surface">{entry.name}</span>
                      </div>
                      <span className="text-xs font-black text-on-surface-variant">{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                  {categoryData.length === 0 && (
                    <p className="text-xs text-on-surface-variant italic text-center py-4">Sem dados de gastos este mês.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compras Parceladas */}
        <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-on-surface">Compras Parceladas</h3>
              <p className="text-sm text-on-surface-variant font-medium">Controle de parcelas futuras (Cartão e Financiamento)</p>
            </div>
            <Calendar size={24} className="text-on-surface-variant opacity-40" />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Descrição</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Método</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Valor Total</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Parcelas</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Valor Parcela</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Próxima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {transactions
                  .filter((t: any) => (t.paymentMethod === 'cartao_credito' || t.paymentMethod === 'financiamento') && t.installments > 1)
                  .map((t, idx) => (
                    <tr key={idx} className="group hover:bg-surface-container-low transition-colors">
                      <td className="py-4 text-sm font-bold text-on-surface">{t.entityName || t.description}</td>
                      <td className="py-4 text-xs font-bold text-on-surface-variant uppercase">{t.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-4 text-sm font-black text-on-surface">{formatCurrency(t.value)}</td>
                      <td className="py-4 text-sm font-bold text-on-surface-variant">{t.installments}x</td>
                      <td className="py-4 text-sm font-black text-primary">{formatCurrency(t.value / t.installments)}</td>
                      <td className="py-4 text-sm font-bold text-on-surface-variant">
                        {format(new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date), 'dd/MM/yyyy')}
                      </td>
                    </tr>
                  ))}
                {transactions.filter((t: any) => (t.paymentMethod === 'cartao_credito' || t.paymentMethod === 'financiamento') && t.installments > 1).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-on-surface-variant italic">Nenhuma compra parcelada encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compras Compartilhadas (Pessoal Only) */}
        {context === 'pessoal' && Object.keys(sharedByPerson).length > 0 && (
          <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-on-surface">Compras Compartilhadas (Família)</h3>
                <p className="text-sm text-on-surface-variant font-medium">Gastos divididos por pessoa no mês</p>
              </div>
              <UserIcon size={24} className="text-on-surface-variant opacity-40" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(sharedByPerson).map(([person, data]: [string, any]) => (
                <div key={person} className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-black text-on-surface">{person}</h4>
                    <span className="text-sm font-black text-primary">{formatCurrency(data.total)}</span>
                  </div>
                  <div className="space-y-3">
                    {data.items.map((t: any, idx: number) => (
                      <div key={idx} className="flex flex-col gap-1 pb-3 border-b border-outline-variant/10 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <Link href={`/transactions?edit=${t.id}`} className="text-xs font-bold text-on-surface hover:text-primary transition-colors">
                            {t.entityName || t.description}
                          </Link>
                          <span className="text-xs font-black text-on-surface-variant">{formatCurrency(t.value)}</span>
                        </div>
                        {t.installments > 1 && (
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase">
                            Parcela {t.currentInstallment || 1}/{t.installments}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
