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
  Building,
  Database,
  DownloadCloud,
  UploadCloud,
  RefreshCw,
  Printer,
  Eye,
  EyeOff
} from 'lucide-react';
import { localDB } from '@/lib/localDB';
import { format, startOfMonth, endOfMonth, subMonths, getYear, setYear, setMonth, addMonths, startOfYear, endOfYear, subYears, isSameMonth, isSameYear, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, parseLocalDate } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
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
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [valuesHidden, setValuesHidden] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('janflow_values_hidden') === 'true';
    }
    return false;
  });

  const toggleValuesHidden = () => {
    setValuesHidden(prev => {
      const next = !prev;
      localStorage.setItem('janflow_values_hidden', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('janflow_last_backup');
      if (saved) setLastBackup(saved);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadCatsCards = async () => {
      const [cats, crdsRaw] = await Promise.all([
        localDB.get('categories', user.uid, context),
        localDB.get('cards', user.uid),
      ]);
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

      const rawAllTrans = await localDB.get('transactions', user.uid, context);
      const allTrans = rawAllTrans.map((t: any) => {
        let userPortion = t.value;
        if (t.isShared && t.sharedSplit) {
          try {
            const split = JSON.parse(t.sharedSplit);
            const othersTotal = Object.values(split).reduce((sum: number, v: any) => sum + Number(v), 0);
            const p = Number(t.value) - othersTotal;
            userPortion = p > 0 ? Math.round(p * 100) / 100 : 0;
          } catch {}
        }
        return { ...t, originalValue: t.value, value: userPortion };
      }).filter((t: any) => t.value > 0 || t.isShared); // Keep 0-portion if it's shared for the family report

      setAllTransactions(allTrans);
      
      const filtered = allTrans.filter((t: any) => {
        const tDate = parseLocalDate(t.date);
        return tDate >= start && tDate <= end;
      }).sort((a: any, b: any) => {
        const dateA = parseLocalDate(a.date).getTime();
        const dateB = parseLocalDate(b.date).getTime();
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
          const tDate = parseLocalDate(t.date);
          return tDate >= prevYearStart && tDate <= prevYearEnd;
        });
        
        // Group by month for comparison
        const currentYearByMonth = Array.from({ length: 12 }, (_, i) => {
          const monthTrans = filtered.filter((t: any) => parseLocalDate(t.date).getMonth() === i);
          return {
            month: format(new Date(2000, i, 1), 'MMM', { locale: ptBR }),
            current: monthTrans.reduce((acc: number, t: any) => t.type === 'receita' ? acc + t.value : acc - t.value, 0),
            previous: 0
          };
        });

        const prevYearByMonth = Array.from({ length: 12 }, (_, i) => {
          const monthTrans = prevYearTrans.filter((t: any) => parseLocalDate(t.date).getMonth() === i);
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
        const tDate = parseLocalDate(t.date);
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
        const tDate = parseLocalDate(t.date);
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
    if (valuesHidden) return 'R$ •••••';
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
  const cardMap: Record<string, { id: string, name: string, bank: string, lastDigits: string, spending: number, originalSpending?: number }> = {};
  
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
    const tDate = parseLocalDate(t.date);
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
      if ((t.category || '').toLowerCase().includes('contrato') || (t.description || '').toLowerCase().includes('novo contrato')) {
        acc.new++;
      }
    } else if (t.type === 'despesa') {
      if ((t.description || '').toLowerCase().includes('cancelamento') || (t.description || '').toLowerCase().includes('cancelado')) {
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

  // Shared Purchases (Pessoal only) — grouped by groupId to avoid duplicates
  const sharedPurchases = transactions.filter((t: any) => t.context === 'pessoal' && t.isShared && t.sharedWith);
  
  // Deduplicate: group installments by groupId so the same purchase doesn't appear multiple times
  const uniqueSharedPurchases: any[] = [];
  const seenGroupIds = new Set<string>();
  sharedPurchases.forEach((t: any) => {
    if (t.groupId && seenGroupIds.has(t.groupId)) return; // Skip duplicate installment groups
    if (t.groupId) seenGroupIds.add(t.groupId);
    uniqueSharedPurchases.push(t);
  });
  
  const sharedByPerson = uniqueSharedPurchases.reduce((acc: any, t: any) => {
    const people = t.sharedWith.split(',').map((p: string) => p.trim()).filter(Boolean);
    let splitData: Record<string, number> = {};
    try {
      if (t.sharedSplit) splitData = JSON.parse(t.sharedSplit);
    } catch {}
    
    const totalValue = t.installments > 1 ? t.originalValue * t.installments : t.originalValue;
    
    people.forEach((person: string) => {
      const normalizedPerson = (person || '').toLowerCase();
      const existingKey = Object.keys(acc).find(k => (k || '').toLowerCase() === normalizedPerson);
      const keyToUse = existingKey || person;

      if (!acc[keyToUse]) acc[keyToUse] = { total: 0, items: [] };
      
      const personMonthValue = splitData[person] !== undefined ? splitData[person] : t.originalValue;
      acc[keyToUse].total += personMonthValue;
      acc[keyToUse].items.push({
        ...t,
        personMonthValue,
        totalPurchaseValue: totalValue,
        cleanEntityName: (t.entityName || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim(),
      });
    });
    return acc;
  }, {});

  const handleExportCSV = () => {
    const data = transactions.map(t => ({
      Data: format(parseLocalDate(t.date), 'dd/MM/yyyy'),
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

  const handleExportBackup = async () => {
    if (!user) return;
    setIsBackingUp(true);
    try {
      // Get all environments data (we omit context to get everything, localDB.get supports undefined context)
      const [trans, cats, crds, bdgts, clnts] = await Promise.all([
        localDB.get('transactions', user.uid),
        localDB.get('categories', user.uid),
        localDB.get('cards', user.uid),
        localDB.get('budgets', user.uid),
        localDB.get('clients', user.uid),
      ]);
      
      const backupData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        user_id: user.uid,
        data: {
          transactions: trans,
          categories: cats,
          cards: crds,
          budgets: bdgts,
          clients: clnts
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `janflow_backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      const backupTime = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
      setLastBackup(backupTime);
      localStorage.setItem('janflow_last_backup', backupTime);
    } catch (e) {
      console.error("Backup failed", e);
      alert("Erro ao gerar backup de segurança.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!confirm("Atenção: A importação irá adicionar e mesclar os dados do arquivo ao seu sistema. Deseja continuar?")) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backup = JSON.parse(content);
        
        if (!backup.data || !backup.version) {
          throw new Error("Arquivo de backup inválido.");
        }

        // Import process inside localDB (iterate over collections and save them)
        const collections = ['transactions', 'categories', 'cards', 'budgets', 'clients'];
        for (const col of collections) {
          if (backup.data[col] && Array.isArray(backup.data[col])) {
            for (const item of backup.data[col]) {
              // Ensure we re-map to current user logically though IDs shouldn't change
              const safeItem = { ...item, user_id: user.uid, uid: user.uid };
              await localDB.save(col, safeItem);
            }
          }
        }
        
        alert("Importação concluída com sucesso! Recarregando a página...");
        window.location.reload();
      } catch (err) {
        console.error("Import error", err);
        alert("Erro ao processar arquivo de importação. Verifique se o arquivo está correto.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
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
        scale: 1.5, // 1.5 scale is safe for memory limits
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
        onclone: (clonedDoc) => {
          const noPrint = clonedDoc.querySelectorAll('.no-print');
          noPrint.forEach(el => (el as HTMLElement).style.display = 'none');
          
          // Replace profile photos and other potentially tainted images with text placeholders to avoid CORS/Taint canvas bugs
          const images = clonedDoc.querySelectorAll('img');
          images.forEach(img => {
            const parent = img.parentElement;
            if (parent) {
              const placeholder = clonedDoc.createElement('div');
              placeholder.className = "w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs text-primary no-print";
              placeholder.innerText = "U";
              parent.replaceChild(placeholder, img);
            }
          });

          // Ensure charts are visible
          const charts = clonedDoc.querySelectorAll('.recharts-wrapper');
          charts.forEach(el => {
            (el as HTMLElement).style.visibility = 'visible';
            (el as HTMLElement).style.display = 'block';
          });
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
      alert("Houve um erro ao gerar o PDF. Tente novamente.");
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleValuesHidden}
              className={cn(
                "p-2.5 rounded-xl transition-all duration-300 border",
                valuesHidden
                  ? "bg-surface-container-high border-outline-variant/30 text-on-surface-variant"
                  : "border-transparent text-on-surface-variant hover:bg-surface-container-high"
              )}
              title={valuesHidden ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {valuesHidden ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
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
          </div>
          </div>
        </div>

        {/* Action Bar (Export/Backup) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-4 rounded-3xl border border-outline-variant/20 shadow-sm no-print">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Database size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-on-surface">Central de Backup</h3>
              {lastBackup ? (
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1">
                  <RefreshCw size={10} /> Último: {lastBackup}
                </p>
              ) : (
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Nenhum backup recente</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={handleExportBackup}
              disabled={isBackingUp}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:bg-[#16808c] active:scale-95 transition-all disabled:opacity-70"
            >
              {isBackingUp ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <DownloadCloud size={16} />}
              Fazer Backup
            </button>

            <label className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest text-on-surface rounded-xl text-sm font-bold hover:bg-outline-variant/20 active:scale-95 transition-all cursor-pointer disabled:opacity-70">
              {isImporting ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <UploadCloud size={16} />}
              Importar Dados
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={handleImportBackup} 
                disabled={isImporting}
              />
            </label>

            <div className="w-px h-6 bg-outline-variant/30 hidden md:block mx-1"></div>

            <button 
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/20 text-on-surface rounded-xl text-sm font-bold hover:bg-surface-container-highest active:scale-95 transition-all disabled:opacity-70"
              title="Exportar Visual PDF em A4"
            >
              <FileText size={16} /> Ver & Salvar PDF
            </button>
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/20 text-on-surface rounded-xl text-sm font-bold hover:bg-surface-container-highest active:scale-95 transition-all"
              title="Imprimir relatório completo usando o navegador"
            >
              <Printer size={16} /> Imprimir Relatório
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/20 text-on-surface rounded-xl text-sm font-bold hover:bg-surface-container-highest active:scale-95 transition-all"
            >
              <Table size={16} /> Planilha EXCEL
            </button>
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

          {isBusiness && (
            <div className={cn("p-6 rounded-3xl border shadow-lg", themeBorder, themeBg)}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center">
                  <Activity size={20} />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-white/70">Lucro Real</p>
              </div>
              <h3 className="text-2xl font-black text-white">
                {formatCurrency(transactions.reduce((acc: number, t: any) => t.type === 'receita' ? acc + t.value : acc - t.value, 0))}
              </h3>
            </div>
          )}
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
                    <p className="text-sm font-black text-on-surface text-right">R$ {(card.originalSpending || card.spending).toFixed(2)}</p>
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
                  <h3 className="text-xl font-black text-on-surface">Comparativo de Fluxo de Caixa</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Receitas - Despesas (Este Ano vs Ano Anterior)</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Este Ano</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-outline-variant"></div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Ano Anterior</span>
                  </div>
                </div>
              </div>
              <div className="min-h-[400px] w-full">
                <ResponsiveContainer width="100%" height={400} minWidth={1} minHeight={1}>
                  <LineChart data={comparisonData}>
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
                    <Line type="monotone" dataKey="current" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} name="Este Ano" />
                    <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#94a3b8' }} name="Ano Anterior" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
              <h3 className="text-xl font-black text-on-surface mb-8">Gastos Mensais por Categoria</h3>
              <div className="min-h-[400px] w-full">
                <ResponsiveContainer width="100%" height={400} minWidth={1} minHeight={1}>
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
                <ResponsiveContainer width="100%" height={400} minWidth={1} minHeight={1}>
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
                <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
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
                  <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
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
                <div className="w-full md:w-1/2 space-y-3 mt-6 md:mt-0 px-4 max-h-[300px] overflow-y-auto">
                  {categoryData.sort((a: any, b: any) => b.value - a.value).map((entry: any, index: number) => (
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
                      <td className="py-4 text-sm font-black text-on-surface">{formatCurrency(t.value * t.installments)}</td>
                      <td className="py-4 text-sm font-bold text-on-surface-variant">{t.installments}x</td>
                      <td className="py-4 text-sm font-black text-primary">{formatCurrency(t.value)}</td>
                      <td className="py-4 text-sm font-bold text-on-surface-variant">
                        {format(parseLocalDate(t.date), 'dd/MM/yyyy')}
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
          <div className="bg-surface-container-lowest p-4 md:p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-on-surface">Compras Compartilhadas (Família)</h3>
                <p className="text-sm text-on-surface-variant font-medium">Detalhamento por pessoa — parcelas do mês</p>
              </div>
              <UserIcon size={24} className="text-on-surface-variant opacity-40" />
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
              {Object.entries(sharedByPerson).map(([person, data]: [string, any]) => (
                <div key={person} className="bg-surface-container-low rounded-2xl border border-outline-variant/20 overflow-hidden">
                  <div className="flex items-center justify-between p-3 md:p-4 bg-surface-container-high/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-black text-primary">{person.charAt(0).toUpperCase()}</span>
                      </div>
                      <h4 className="text-base font-black text-on-surface">{person}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Total do Mês</p>
                      <p className="text-base font-black text-primary">{formatCurrency(data.total)}</p>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-primary/5 border-b border-primary/10">
                          <th className="text-left px-3 md:px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary/80">Compra</th>
                          <th className="text-left px-3 md:px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary/80 hidden sm:table-cell">Descrição</th>
                          <th className="text-right px-3 md:px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary/80 hidden md:table-cell">Valor Total</th>
                          <th className="text-right px-3 md:px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary/80">Parcela do Mês</th>
                          <th className="text-center px-3 md:px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary/80">Parcela</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((t: any, idx: number) => (
                          <tr key={idx} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-high/30 transition-colors">
                            <td className="px-3 md:px-4 py-3">
                              <Link href={`/transactions?edit=${t.id}`} className="text-xs font-bold text-on-surface hover:text-primary transition-colors">
                                {t.cleanEntityName || t.entityName}
                              </Link>
                            </td>
                            <td className="px-3 md:px-4 py-3 text-xs text-on-surface-variant font-medium hidden sm:table-cell">
                              {t.description ? t.description.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() : '-'}
                            </td>
                            <td className="px-3 md:px-4 py-3 text-xs font-bold text-on-surface-variant text-right hidden md:table-cell">
                              {formatCurrency(t.totalPurchaseValue)}
                            </td>
                            <td className="px-3 md:px-4 py-3 text-xs font-black text-on-surface text-right">
                              {formatCurrency(t.personMonthValue)}
                            </td>
                            <td className="px-3 md:px-4 py-3 text-center">
                              {t.installments > 1 ? (
                                <span className="text-[10px] font-black bg-surface-container-highest px-2 py-0.5 rounded-full text-on-surface-variant whitespace-nowrap">
                                  {t.currentInstallment || 1}/{t.installments}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-on-surface-variant uppercase">Única</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-surface-container-high/30">
                          <td colSpan={3} className="px-4 md:px-6 py-3 text-xs font-black text-on-surface-variant uppercase tracking-widest text-right hidden md:table-cell">Total das Parcelas do Mês:</td>
                          <td colSpan={3} className="px-4 md:px-6 py-3 text-xs font-black text-on-surface-variant uppercase tracking-widest text-right md:hidden">Total:</td>
                          <td className="px-4 md:px-6 py-3 text-sm font-black text-primary text-right hidden md:table-cell">{formatCurrency(data.total)}</td>
                          <td className="px-4 md:px-6 py-3 text-sm font-black text-primary text-right md:hidden">{formatCurrency(data.total)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
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
