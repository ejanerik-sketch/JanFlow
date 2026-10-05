import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight, ArrowDownRight, Tag } from 'lucide-react';
import { parseLocalDate } from '@/lib/utils';
import { format } from 'date-fns';

interface CategoryTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  transactions: any[];
}

export function CategoryTransactionsModal({ isOpen, onClose, categoryName, transactions }: CategoryTransactionsModalProps) {
  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatLocalDate = (date: Date, f: string) => format(date, f);

  // Filter transactions exactly by this category
  // If the category was "Outros" in the chart, it might be that t.category was empty.
  const filtered = transactions.filter(t => {
    const cat = t.category || 'Outros';
    return cat === categoryName;
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-16 pb-4 sm:p-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface w-full max-w-2xl rounded-[32px] shadow-xl overflow-hidden relative z-10 max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-6 sm:p-8 pb-4 flex items-center justify-between border-b border-outline-variant/20 shrink-0 bg-surface">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Tag size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-on-surface">{categoryName}</h2>
                <p className="text-sm font-medium text-on-surface-variant mt-1">
                  {filtered.length} {filtered.length === 1 ? 'transação' : 'transações'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 overflow-y-auto space-y-4 bg-surface-container-lowest/50">
            {filtered.length === 0 ? (
              <p className="text-center text-on-surface-variant font-medium py-8">Nenhuma transação encontrada.</p>
            ) : (
              filtered.map((t, i) => (
                <div key={t.id || i} className="flex items-center justify-between p-4 rounded-2xl bg-surface border border-outline-variant/20 hover:border-outline-variant/40 transition-colors shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'receita' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                      {t.type === 'receita' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface line-clamp-1">{t.entityName || t.description || 'Sem descrição'}</h4>
                      <p className="text-xs font-medium text-on-surface-variant">
                        {t.date ? formatLocalDate(parseLocalDate(t.date), 'dd/MM/yyyy') : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black ${t.type === 'receita' ? 'text-primary' : 'text-error'}`}>
                      {t.type === 'receita' ? '+' : '-'}{formatCurrency(Number(t.value))}
                    </p>
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mt-1 px-2 py-0.5 rounded-full bg-surface-container-high inline-block">
                      {t.status.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
