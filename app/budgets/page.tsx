'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import { 
  Plus, 
  Target, 
  AlertCircle, 
  Trash2, 
  Edit2, 
  X, 
  Check,
  TrendingUp,
  TrendingDown,
  PieChart,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDB } from '@/lib/localDB';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const budgetSchema = z.object({
  category: z.string().min(1, 'Categoria é obrigatória'),
  amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
  recurrence: z.enum(['mensal', 'anual']),
  description: z.string().optional(),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

export default function BudgetsPage() {
  const router = useRouter();
  const { user, isAuthReady, context } = useAppContext();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      recurrence: 'mensal',
    }
  });

  useEffect(() => {
    if (isAuthReady && !user) {
      router.push('/login');
    }
  }, [user, isAuthReady, router]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const b = await localDB.get('budgets', user.uid, context);
      const t = await localDB.get('transactions', user.uid, context);
      const c = await localDB.get('categories', user.uid, context);
      setBudgets(b);
      setTransactions(t);
      setCategories(c);
    };

    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [user, context]);

  const onSubmit = async (data: BudgetFormValues) => {
    if (!user) return;
    setLoading(true);
    try {
      const budgetData = {
        ...data,
        uid: user.uid,
        context: context,
        id: editingBudget?.id || undefined,
        updatedAt: new Date().toISOString(),
      };
      
      await localDB.save('budgets', budgetData);
      setIsModalOpen(false);
      setEditingBudget(null);
      reset();
    } catch (error) {
      console.error('Error saving budget:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (budgetToDelete) {
      await localDB.delete('budgets', budgetToDelete);
      setBudgetToDelete(null);
    }
  };

  const handleEdit = (budget: any) => {
    setEditingBudget(budget);
    reset(budget);
    setIsModalOpen(true);
  };

  if (!isAuthReady || !user) return null;

  const isBusiness = context === 'empresa';
  const themeColor = isBusiness ? 'text-[#1d8490]' : 'text-[#ff6330]';
  const themeBg = isBusiness ? 'bg-[#1d8490]' : 'bg-[#ff6330]';
  const themeBorder = isBusiness ? 'border-[#1d8490]' : 'border-[#ff6330]';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const start = startOfMonth(new Date());
  const end = endOfMonth(new Date());

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-on-surface">Orçamentos Inteligentes</h2>
            <p className="text-on-surface-variant font-medium mt-1">Planeje seus gastos e evite surpresas.</p>
          </div>
          <button
            onClick={() => {
              setEditingBudget(null);
              reset();
              setIsModalOpen(true);
            }}
            className={cn("px-6 py-3 rounded-2xl text-white font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all", themeBg)}
          >
            <Plus size={20} />
            Novo Orçamento
          </button>
        </div>

        {/* Budgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((budget) => {
            const spent = transactions
              .filter(t => {
                const tDate = new Date(t.date?.seconds ? t.date.seconds * 1000 : t.date);
                return t.category === budget.category && 
                       t.type === 'despesa' && 
                       isWithinInterval(tDate, { start, end });
              })
              .reduce((acc, t) => acc + t.value, 0);
            
            const percentage = Math.min((spent / budget.amount) * 100, 100);
            const remaining = budget.amount - spent;
            const isNearLimit = percentage >= 80;
            const isOverLimit = spent > budget.amount;

            return (
              <motion.div 
                layout
                key={budget.id}
                className="bg-surface-container-lowest p-6 rounded-[32px] border border-outline-variant/20 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isOverLimit ? "bg-error/10 text-error" : "bg-primary/10 text-primary")}>
                      <Target size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-on-surface">{budget.category}</h4>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{budget.recurrence}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(budget)} className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setBudgetToDelete(budget.id)} className="p-2 text-on-surface-variant hover:text-error transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Gasto Atual</p>
                      <p className={cn("text-xl font-black", isOverLimit ? "text-error" : "text-on-surface")}>
                        {formatCurrency(spent)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Limite</p>
                      <p className="text-sm font-bold text-on-surface-variant">{formatCurrency(budget.amount)}</p>
                    </div>
                  </div>

                  <div className="relative h-3 bg-surface-container-high rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-colors duration-500",
                        isOverLimit ? "bg-error" : isNearLimit ? "bg-amber-500" : "bg-primary"
                      )}
                    ></motion.div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      {isOverLimit ? (
                        <AlertCircle size={14} className="text-error" />
                      ) : isNearLimit ? (
                        <AlertCircle size={14} className="text-amber-500" />
                      ) : (
                        <Check size={14} className="text-success" />
                      )}
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-tight",
                        isOverLimit ? "text-error" : isNearLimit ? "text-amber-500" : "text-success"
                      )}>
                        {isOverLimit ? 'Limite Excedido' : isNearLimit ? 'Próximo ao Limite' : 'Dentro do Limite'}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-on-surface-variant">{Math.round(percentage)}%</span>
                  </div>

                  {remaining > 0 ? (
                    <div className="pt-4 border-t border-outline-variant/10">
                      <p className="text-xs font-medium text-on-surface-variant">
                        Você ainda pode gastar <span className="font-bold text-on-surface">{formatCurrency(remaining)}</span> este mês.
                      </p>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-outline-variant/10">
                      <p className="text-xs font-medium text-error">
                        Você ultrapassou o orçamento em <span className="font-bold">{formatCurrency(Math.abs(remaining))}</span>.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {budgets.length === 0 && (
            <div className="col-span-full py-20 text-center bg-surface-container-low/50 rounded-[40px] border-2 border-dashed border-outline-variant/30">
              <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-6 text-on-surface-variant/30">
                <Target size={40} />
              </div>
              <h3 className="text-xl font-black text-on-surface mb-2">Nenhum orçamento ainda</h3>
              <p className="text-on-surface-variant font-medium max-w-xs mx-auto mb-8">
                Crie orçamentos para suas categorias e tenha controle total sobre seus gastos recorrentes.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className={cn("px-8 py-4 rounded-2xl text-white font-black shadow-lg active:scale-95 transition-all", themeBg)}
              >
                Criar Primeiro Orçamento
              </button>
            </div>
          )}
        </div>

        {/* Modal */}
        <AnimatePresence>
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
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-surface-container-lowest rounded-[40px] shadow-2xl overflow-hidden border border-outline-variant/20"
              >
                <div className="p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black text-on-surface">
                      {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Categoria</label>
                      <select
                        {...register('category')}
                        className="w-full px-5 py-4 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                      >
                        <option value="">Selecione uma categoria</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                      {errors.category && <p className="text-error text-[10px] font-bold ml-1">{errors.category.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Valor Limite</label>
                        <input
                          type="number"
                          step="0.01"
                          {...register('amount', { valueAsNumber: true })}
                          className="w-full px-5 py-4 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="0,00"
                        />
                        {errors.amount && <p className="text-error text-[10px] font-bold ml-1">{errors.amount.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Recorrência</label>
                        <select
                          {...register('recurrence')}
                          className="w-full px-5 py-4 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                          <option value="mensal">Mensal</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Descrição (Opcional)</label>
                      <textarea
                        {...register('description')}
                        rows={3}
                        className="w-full px-5 py-4 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                        placeholder="Ex: Orçamento para campanhas de tráfego pago..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className={cn(
                        "w-full py-5 rounded-2xl text-white font-black shadow-lg active:scale-95 transition-all mt-4",
                        themeBg,
                        loading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {loading ? 'Salvando...' : editingBudget ? 'Atualizar Orçamento' : 'Criar Orçamento'}
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {budgetToDelete && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setBudgetToDelete(null)}
                className="absolute inset-0 bg-surface-container-highest/80 backdrop-blur-sm"
              ></motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-surface-container-lowest rounded-[32px] p-8 shadow-2xl border border-outline-variant/20 text-center"
              >
                <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black text-on-surface mb-2">Excluir Orçamento?</h3>
                <p className="text-sm text-on-surface-variant mb-8">Esta ação não pode ser desfeita. Tem certeza que deseja continuar?</p>
                
                <div className="flex gap-4">
                  <button
                    onClick={() => setBudgetToDelete(null)}
                    className="flex-1 py-4 rounded-2xl font-bold text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-4 rounded-2xl font-bold text-white bg-error hover:bg-error/90 shadow-lg shadow-error/20 transition-all active:scale-95"
                  >
                    Excluir
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
