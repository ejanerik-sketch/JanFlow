'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import { 
  History, 
  Search, 
  Filter, 
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
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDB } from '@/lib/localDB';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
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

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedContext, setSelectedContext] = useState<string>('todos');
  const [selectedEntity, setSelectedEntity] = useState<string>('todos');
  const [selectedAction, setSelectedAction] = useState<string>('todos');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

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
        const data = await localDB.get('activity_logs', user.uid);
        // Ordenar por data decrescente
        const sorted = (data || []).sort((a: any, b: any) => 
          new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime()
        );
        setLogs(sorted);
      } catch (err) {
        console.error('Erro ao buscar histórico de atividades:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, refreshTrigger]);

  // Filtragem dos logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Filtro por texto (pesquisa)
      if (search) {
        const query = search.toLowerCase();
        const matchesDetails = (log.details || '').toLowerCase().includes(query);
        const matchesUser = (log.userName || '').toLowerCase().includes(query) || (log.userEmail || '').toLowerCase().includes(query);
        const matchesEntity = (log.entity || '').toLowerCase().includes(query);
        if (!matchesDetails && !matchesUser && !matchesEntity) return false;
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
        const logDateStr = (log.createdAt || (log as any).created_at || '').substring(0, 10);
        if (startDate && logDateStr < startDate) return false;
        if (endDate && logDateStr > endDate) return false;
      }

      return true;
    });
  }, [logs, search, selectedContext, selectedEntity, selectedAction, startDate, endDate]);

  // Agrupamento por dia
  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: ActivityLog[] } = {};
    filteredLogs.forEach(log => {
      const rawDate = log.createdAt || (log as any).created_at;
      if (!rawDate) return;
      const dateObj = parseISO(rawDate);
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
                  Registro completo de lançamentos, edições e exclusões no JanFlow.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={triggerRefresh}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-sm transition-all active:scale-95 border border-outline-variant/10 shadow-sm"
            >
              <RefreshCw size={18} className={cn(loading && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Painel de Filtros */}
        <div className="bg-surface-container-lowest p-6 rounded-[28px] border border-outline-variant/15 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Pesquisa por Texto */}
            <div className="relative md:col-span-2">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input 
                type="text"
                placeholder="Buscar por detalhe, usuário ou item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Contexto */}
            <div>
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

          {/* Filtro de Datas */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-outline-variant/10 text-xs font-bold">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Calendar size={14} />
              <span>Período:</span>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-surface-container-high border-none rounded-xl px-3 py-1.5 font-bold text-on-surface"
              />
              <span className="text-on-surface-variant">até</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-surface-container-high border-none rounded-xl px-3 py-1.5 font-bold text-on-surface"
              />
            </div>

            {(search || selectedContext !== 'todos' || selectedEntity !== 'todos' || selectedAction !== 'todos' || startDate || endDate) && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedContext('todos');
                  setSelectedEntity('todos');
                  setSelectedAction('todos');
                  setStartDate('');
                  setEndDate('');
                }}
                className="ml-auto text-xs font-black text-primary hover:underline cursor-pointer"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Contador de Resultados */}
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'registro encontrado' : 'registros encontrados'}
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
            <h3 className="text-lg font-black text-on-surface mb-1">Nenhum registro de histórico encontrado</h3>
            <p className="text-sm text-on-surface-variant max-w-md mx-auto">
              As ações de criação, edição ou exclusão realizadas pelos usuários serão registradas automaticamente aqui.
            </p>
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
                    const rawDate = log.createdAt || (log as any).created_at;
                    const formattedTime = rawDate ? format(parseISO(rawDate), 'HH:mm:ss') : '';

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
                              <span>{log.userName || 'Usuário'}</span>
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
