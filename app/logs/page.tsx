'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import { 
  History, 
  Search, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  User, 
  Calendar, 
  Building2, 
  UserCircle2, 
  RefreshCw,
  Clock,
  Layers,
  Tag,
  CreditCard,
  Target,
  FileText,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { localDB } from '@/lib/localDB';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  userId?: string;
  userName: string;
  userEmail: string;
  action: 'Criação' | 'Edição' | 'Exclusão' | string;
  entity: 'Lançamentos' | 'Categorias' | 'Cartões' | 'Clientes' | 'Orçamentos' | 'Usuários' | string;
  details: string;
  context: 'empresa' | 'pessoal' | 'sistema' | string;
  createdAt: string;
}

export default function LogsPage() {
  const router = useRouter();
  const { user, isAuthReady, isAdmin, isFinanceiro } = useAppContext();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Pesquisa por texto (com enter e X para limpar)
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Filtro de Datas Pré-configurado para o MÊS ATUAL por padrão
  const now = new Date();
  const defaultStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const defaultEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);

  // Demais Filtros
  const [selectedUser, setSelectedUser] = useState<string>('todos');
  const [selectedContext, setSelectedContext] = useState<string>('todos');
  const [selectedEntity, setSelectedEntity] = useState<string>('todos');
  const [selectedAction, setSelectedAction] = useState<string>('todos');

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  // Handlers para pesquisa por texto
  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
  };

  // Presets de Data
  const applyCurrentMonth = () => {
    const currentDate = new Date();
    setStartDate(format(startOfMonth(currentDate), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(currentDate), 'yyyy-MM-dd'));
  };

  const applyPreviousMonth = () => {
    const prevDate = subMonths(new Date(), 1);
    setStartDate(format(startOfMonth(prevDate), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(prevDate), 'yyyy-MM-dd'));
  };

  const applyAllDates = () => {
    setStartDate('');
    setEndDate('');
  };

  // Proteção de rota: apenas Admin ou Financeiro
  useEffect(() => {
    if (isAuthReady && (!user || (!isAdmin && !isFinanceiro))) {
      router.push('/');
    }
  }, [user, isAuthReady, isAdmin, isFinanceiro, router]);

  useEffect(() => {
    if (!user) return;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        // Buscar lista de perfis/usuários para mapeamento correto de nomes de autor
        const profiles = await localDB.get('profiles', user.uid);
        const profilesMap = new Map<string, { name: string; email: string }>();
        (profiles || []).forEach((p: any) => {
          const id = p.id || p.uid;
          if (id) {
            profilesMap.set(id, {
              name: p.name || p.email?.split('@')[0] || 'Usuário',
              email: p.email || ''
            });
          }
        });

        // 1. Logs da tabela activity_logs no Supabase
        const remoteLogs = await localDB.get('activity_logs', user.uid);
        
        // 2. Logs salvos no localStorage como backup local
        let localLogs: ActivityLog[] = [];
        try {
          const stored = localStorage.getItem('janflow_activity_logs_v1');
          if (stored) localLogs = JSON.parse(stored);
        } catch (e) {
          localLogs = [];
        }

        // 3. Sintetizar histórico baseado em registros existentes de todos os usuários
        const synthesizedLogs: ActivityLog[] = [];
        
        const [transactions, categories, cards, clients] = await Promise.all([
          localDB.get('transactions', user.uid, 'empresa').then(t1 => 
            localDB.get('transactions', user.uid, 'pessoal').then(t2 => [...t1, ...t2])
          ),
          localDB.get('categories', user.uid, 'empresa').then(c1 => 
            localDB.get('categories', user.uid, 'pessoal').then(c2 => [...c1, ...c2])
          ),
          localDB.get('cards', user.uid, 'empresa').then(cd1 => 
            localDB.get('cards', user.uid, 'pessoal').then(cd2 => [...cd1, ...cd2])
          ),
          localDB.get('clients', user.uid)
        ]);

        (transactions || []).forEach((t: any) => {
          if (t.id && !t.id.startsWith('temp_')) {
            const ownerId = t.userId || t.user_id || user.uid;
            const ownerProfile = profilesMap.get(ownerId);
            synthesizedLogs.push({
              id: 'synth_tx_' + t.id,
              userId: ownerId,
              userName: ownerProfile?.name || t.userName || t.user_name || 'Usuário',
              userEmail: ownerProfile?.email || t.userEmail || t.user_email || '',
              action: 'Criação',
              entity: 'Lançamentos',
              details: `Lançamento: "${t.entityName || t.description || t.category || 'Lançamento'}" (R$ ${Number(t.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
              context: t.context || 'empresa',
              createdAt: t.createdAt || t.created_at || t.date || new Date().toISOString()
            });
          }
        });

        (categories || []).forEach((c: any) => {
          if (c.id && !c.id.startsWith('temp_')) {
            const ownerId = c.userId || c.user_id || user.uid;
            const ownerProfile = profilesMap.get(ownerId);
            synthesizedLogs.push({
              id: 'synth_cat_' + c.id,
              userId: ownerId,
              userName: ownerProfile?.name || c.userName || c.user_name || 'Usuário',
              userEmail: ownerProfile?.email || c.userEmail || c.user_email || '',
              action: 'Criação',
              entity: 'Categorias',
              details: `Categoria: "${c.name}"`,
              context: c.context || 'empresa',
              createdAt: c.createdAt || c.created_at || new Date().toISOString()
            });
          }
        });

        (cards || []).forEach((cd: any) => {
          if (cd.id && !cd.id.startsWith('temp_')) {
            const ownerId = cd.userId || cd.user_id || user.uid;
            const ownerProfile = profilesMap.get(ownerId);
            synthesizedLogs.push({
              id: 'synth_card_' + cd.id,
              userId: ownerId,
              userName: ownerProfile?.name || cd.userName || cd.user_name || 'Usuário',
              userEmail: ownerProfile?.email || cd.userEmail || cd.user_email || '',
              action: 'Criação',
              entity: 'Cartões',
              details: `Cartão de crédito "${cd.name}" (Limite: R$ ${Number(cd.limit_amount || cd.limitAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
              context: cd.context || 'empresa',
              createdAt: cd.createdAt || cd.created_at || new Date().toISOString()
            });
          }
        });

        (clients || []).forEach((cl: any) => {
          if (cl.id && !cl.id.startsWith('temp_')) {
            const ownerId = cl.userId || cl.user_id || user.uid;
            const ownerProfile = profilesMap.get(ownerId);
            synthesizedLogs.push({
              id: 'synth_cli_' + cl.id,
              userId: ownerId,
              userName: ownerProfile?.name || cl.userName || cl.user_name || 'Usuário',
              userEmail: ownerProfile?.email || cl.userEmail || cl.user_email || '',
              action: 'Criação',
              entity: 'Clientes',
              details: `Cliente: "${cl.companyName || cl.company_name || cl.name || 'Cliente'}"`,
              context: 'empresa',
              createdAt: cl.createdAt || cl.created_at || new Date().toISOString()
            });
          }
        });

        // Combinar fontes e resolver perfis de usuários
        const allLogsMap = new Map<string, ActivityLog>();
        
        [...remoteLogs, ...localLogs, ...synthesizedLogs].forEach((item: any) => {
          const itemUserId = item.userId || item.user_id;
          const matchedProfile = itemUserId ? profilesMap.get(itemUserId) : null;

          const normalized: ActivityLog = {
            id: item.id || 'log_' + Math.random(),
            userId: itemUserId,
            userName: matchedProfile?.name || item.userName || item.user_name || 'Usuário',
            userEmail: matchedProfile?.email || item.userEmail || item.user_email || '',
            action: item.action || 'Criação',
            entity: item.entity || 'Lançamentos',
            details: item.details || 'Ação no sistema',
            context: item.context || 'empresa',
            createdAt: item.createdAt || item.created_at || new Date().toISOString()
          };

          const key = normalized.details + '_' + (normalized.createdAt || '').substring(0, 10);
          if (!allLogsMap.has(key)) {
            allLogsMap.set(key, normalized);
          }
        });

        const combinedLogs = Array.from(allLogsMap.values()).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setLogs(combinedLogs);
      } catch (err) {
        console.error('Erro ao carregar histórico:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, refreshTrigger]);

  // Lista única de usuários para o filtro
  const availableUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    logs.forEach(log => {
      const key = log.userId || log.userEmail || log.userName;
      if (key && !map.has(key)) {
        map.set(key, {
          id: key,
          name: log.userName || log.userEmail || 'Usuário',
          email: log.userEmail || ''
        });
      }
    });
    return Array.from(map.values());
  }, [logs]);

  // Filtragem dos logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Filtro por Usuário
      if (selectedUser !== 'todos') {
        const matchesUser = log.userId === selectedUser || log.userEmail === selectedUser || log.userName === selectedUser;
        if (!matchesUser) return false;
      }

      // Filtro por texto pesquisado (appliedSearch)
      if (appliedSearch) {
        const query = appliedSearch.toLowerCase();
        const matchesDetails = (log.details || '').toLowerCase().includes(query);
        const matchesUserText = (log.userName || '').toLowerCase().includes(query) || (log.userEmail || '').toLowerCase().includes(query);
        const matchesEntity = (log.entity || '').toLowerCase().includes(query);
        if (!matchesDetails && !matchesUserText && !matchesEntity) return false;
      }

      // Filtro por contexto
      if (selectedContext !== 'todos' && log.context !== selectedContext) {
        return false;
      }

      // Filtro por entidade
      if (selectedEntity !== 'todos' && log.entity !== selectedEntity) {
        return false;
      }

      // Filtro por ação
      if (selectedAction !== 'todos' && log.action !== selectedAction) {
        return false;
      }

      // Filtro por intervalo de datas
      if (startDate || endDate) {
        const logDateStr = (log.createdAt || '').substring(0, 10);
        if (startDate && logDateStr < startDate) return false;
        if (endDate && logDateStr > endDate) return false;
      }

      return true;
    });
  }, [logs, selectedUser, appliedSearch, selectedContext, selectedEntity, selectedAction, startDate, endDate]);

  // Agrupamento por dia
  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: ActivityLog[] } = {};
    filteredLogs.forEach(log => {
      const rawDate = log.createdAt;
      if (!rawDate) return;
      let dateObj = parseISO(rawDate);
      if (isNaN(dateObj.getTime())) dateObj = new Date();
      
      let dayKey = '';
      if (isToday(dateObj)) {
        dayKey = 'Hoje';
      } else if (isYesterday(dateObj)) {
        dayKey = 'Ontem';
      } else {
        dayKey = format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      }

      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(log);
    });
    return groups;
  }, [filteredLogs]);

  if (!isAuthReady || !user || (!isAdmin && !isFinanceiro)) {
    return null;
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'Criação':
        return { label: 'Criação', icon: PlusCircle, bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
      case 'Edição':
        return { label: 'Edição', icon: Edit3, bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      case 'Exclusão':
        return { label: 'Exclusão', icon: Trash2, bg: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
      default:
        return { label: action, icon: Clock, bg: 'bg-surface-container-high text-on-surface-variant' };
    }
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'Lançamentos': return FileText;
      case 'Categorias': return Tag;
      case 'Cartões': return CreditCard;
      case 'Clientes': return Building2;
      case 'Orçamentos': return Target;
      case 'Usuários': return User;
      default: return Layers;
    }
  };

  return (
    <Layout>
      <div className="space-y-8 pb-24">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <History size={26} />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-on-surface">Histórico de Atividades</h2>
                <p className="text-on-surface-variant font-medium text-sm mt-0.5">
                  Registro de ações, lançamentos, edições e exclusões no JanFlow por usuário.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={triggerRefresh}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-sm transition-all active:scale-95 border border-outline-variant/10 shadow-sm cursor-pointer"
            >
              <RefreshCw size={18} className={cn(loading && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Painel de Filtros */}
        <div className="bg-surface-container-lowest p-6 rounded-[28px] border border-outline-variant/15 shadow-sm space-y-5">
          {/* Formulário de Busca por Texto com Lupa + Enter + Botão 'X' */}
          <form onSubmit={handleExecuteSearch} className="flex gap-2">
            <div className="relative flex-1">
              <button 
                type="submit" 
                title="Pesquisar (ou pressione Enter)"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
              >
                <Search size={18} />
              </button>
              
              <input 
                type="text"
                placeholder="Digite para pesquisar e pressione Enter ou clique na lupa..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteSearch(e);
                }}
                className="w-full pl-11 pr-10 py-3.5 bg-surface-container-high border-none rounded-2xl text-sm font-bold text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary/20"
              />

              {/* Botão 'X' para limpar */}
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  title="Apagar pesquisa"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-error rounded-full hover:bg-surface-container-highest transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-6 py-3.5 bg-primary text-white font-black text-sm rounded-2xl shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Search size={18} />
              Buscar
            </button>
          </form>

          {/* Seletores Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filtro por Usuário */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1 mb-1 block">Usuário</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="todos">Todos os Usuários</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} {u.email ? `(${u.email})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Contexto */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1 mb-1 block">Contexto</label>
              <select
                value={selectedContext}
                onChange={(e) => setSelectedContext(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="todos">Todos os Contextos</option>
                <option value="empresa">Empresarial</option>
                <option value="pessoal">Pessoal</option>
                <option value="sistema">Sistema</option>
              </select>
            </div>

            {/* Entidade */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1 mb-1 block">Área / Entidade</label>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="todos">Todas as Áreas</option>
                <option value="Lançamentos">Lançamentos</option>
                <option value="Categorias">Categorias</option>
                <option value="Cartões">Cartões</option>
                <option value="Clientes">Clientes</option>
                <option value="Orçamentos">Orçamentos</option>
                <option value="Usuários">Usuários</option>
              </select>
            </div>

            {/* Ação */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1 mb-1 block">Tipo de Ação</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="todos">Todas as Ações</option>
                <option value="Criação">Criação (+)</option>
                <option value="Edição">Edição (✎)</option>
                <option value="Exclusão">Exclusão (🗑)</option>
              </select>
            </div>
          </div>

          {/* Filtro de Datas + Presets de Período */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-outline-variant/10">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <Calendar size={15} className="text-primary" />
                <span>Período:</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-surface-container-high border-none rounded-xl px-3 py-2 font-bold text-on-surface focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-on-surface-variant">até</span>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-surface-container-high border-none rounded-xl px-3 py-2 font-bold text-on-surface focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Botões Rápidos de Período */}
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={applyCurrentMonth}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer",
                  startDate === defaultStart && endDate === defaultEnd
                    ? "bg-primary text-white shadow-sm"
                    : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                )}
              >
                Mês Atual
              </button>
              <button
                type="button"
                onClick={applyPreviousMonth}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all whitespace-nowrap cursor-pointer"
              >
                Mês Anterior
              </button>
              <button
                type="button"
                onClick={applyAllDates}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  !startDate && !endDate
                    ? "bg-primary text-white shadow-sm"
                    : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                )}
              >
                Todo o Período
              </button>
            </div>
          </div>
        </div>

        {/* Contador de Resultados */}
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'registro encontrado' : 'registros encontrados'}
            {appliedSearch && ` para "${appliedSearch}"`}
          </span>
        </div>

        {/* Lista de Histórico / Linha do Tempo */}
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-sm font-bold text-on-surface-variant">Carregando histórico de atividades...</p>
          </div>
        ) : Object.keys(groupedLogs).length === 0 ? (
          <div className="bg-surface-container-lowest rounded-[32px] p-12 text-center border border-outline-variant/15">
            <div className="w-16 h-16 bg-surface-container-high rounded-2xl flex items-center justify-center text-on-surface-variant mx-auto mb-4">
              <History size={32} />
            </div>
            <h3 className="text-lg font-black text-on-surface mb-1">Nenhum registro encontrado com os filtros atuais</h3>
            <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
              Tente alterar o filtro de usuário, período de datas ou busca por texto para visualizar outros registros.
            </p>
            <button
              onClick={applyAllDates}
              className="px-6 py-3 bg-surface-container-high text-on-surface font-black text-xs rounded-xl hover:bg-surface-container-highest transition-all cursor-pointer"
            >
              Ver Todo o Histórico
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedLogs).map(([dayLabel, dayLogs]) => (
              <div key={dayLabel} className="space-y-4">
                {/* Cabeçalho do Dia */}
                <div className="flex items-center gap-3 px-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <h3 className="text-sm font-black tracking-tight text-on-surface uppercase">{dayLabel}</h3>
                  <div className="flex-1 h-px bg-outline-variant/15" />
                </div>

                {/* Cartões do Dia */}
                <div className="space-y-3">
                  {dayLogs.map((log) => {
                    const badge = getActionBadge(log.action);
                    const EntityIcon = getEntityIcon(log.entity);
                    const rawDate = log.createdAt;
                    let formattedTime = '12:00:00';
                    if (rawDate) {
                      const d = parseISO(rawDate);
                      if (!isNaN(d.getTime())) {
                        formattedTime = format(d, 'HH:mm:ss');
                      }
                    }

                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 shadow-sm hover:border-outline-variant/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-4 flex-1">
                          {/* Ícone da Ação */}
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 mt-0.5",
                            badge.bg
                          )}>
                            <badge.icon size={20} />
                          </div>

                          {/* Detalhes do Log */}
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Tipo de Ação */}
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                                badge.bg
                              )}>
                                {badge.label}
                              </span>

                              {/* Entidade */}
                              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-surface-container-high text-on-surface flex items-center gap-1 border border-outline-variant/10">
                                <EntityIcon size={12} />
                                {log.entity}
                              </span>

                              {/* Contexto */}
                              {log.context && (
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1",
                                  log.context === 'empresa' ? "bg-[#1d8490]" : log.context === 'pessoal' ? "bg-[#ff6330]" : "bg-slate-600"
                                )}>
                                  {log.context === 'empresa' ? <Building2 size={10} /> : <UserCircle2 size={10} />}
                                  {log.context}
                                </span>
                              )}
                            </div>

                            {/* Descrição em destaque */}
                            <p className="text-sm font-bold text-on-surface leading-snug">
                              {log.details}
                            </p>

                            {/* Usuário e E-mail */}
                            <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant/80">
                              <User size={13} className="text-primary" />
                              <span className="font-bold text-on-surface">{log.userName || 'Usuário'}</span>
                              {log.userEmail && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-[11px] opacity-70">{log.userEmail}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Horário */}
                        <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant/70 shrink-0 self-end md:self-center bg-surface-container-high/60 px-3 py-1.5 rounded-xl border border-outline-variant/10">
                          <Clock size={14} />
                          <span>{formattedTime}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
