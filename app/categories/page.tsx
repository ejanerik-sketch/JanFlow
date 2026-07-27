'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  GripVertical,
  Building2,
  UserCircle2,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  Save,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDB } from '@/lib/localDB';
import { cn } from '@/lib/utils';

const defaultCategories = [
  // Empresa - Receitas
  { name: 'CONTRATO', flow: 'receita', context: 'empresa', color: '#10b981' },
  { name: 'SERVIÇO AVULSO', flow: 'receita', context: 'empresa', color: '#3b82f6' },
  { name: 'EM ABERTO', flow: 'receita', context: 'empresa', color: '#f59e0b' },
  // Empresa - Despesas Fixas
  { name: 'Fixas', flow: 'despesa_fixa', context: 'empresa', color: '#ef4444' },
  { name: 'PRO LABORE', flow: 'despesa_fixa', context: 'empresa', color: '#8b5cf6' },
  { name: 'IMPOSTO', flow: 'despesa_fixa', context: 'empresa', color: '#6366f1' },
  { name: 'TAXA DE BANCO', flow: 'despesa_fixa', context: 'empresa', color: '#64748b' },
  // Empresa - Despesas Variáveis
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
  // Pessoal - Receitas
  { name: 'SALÁRIO', flow: 'receita', context: 'pessoal', color: '#10b981' },
  { name: 'COMISSÃO', flow: 'receita', context: 'pessoal', color: '#3b82f6' },
  { name: 'BÔNUS', flow: 'receita', context: 'pessoal', color: '#f59e0b' },
  // Pessoal - Despesas
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

const getRandomColor = () => {
  const colors = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#6366f1', '#64748b', '#ec4899', '#06b6d4', '#f97316', 
    '#84cc16', '#14b8a6', '#facc15', '#fb7185', '#a855f7', 
    '#d946ef', '#475569', '#94a3b8', '#1d8490', '#ff6330'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default function CategoriesPage() {
  const router = useRouter();
  const { user, isAuthReady, isAdmin } = useAppContext();
  const [categories, setCategories] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<any>(null);
  const [newCategory, setNewCategory] = useState({ name: '', flow: 'despesa_variavel', context: 'empresa', color: '#1d8490' });
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    if (isAuthReady && (!user || !isAdmin)) {
      router.push('/');
    }
  }, [user, isAuthReady, isAdmin, router]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // 1. Cache Instantâneo
      const cachedEmpresa = localDB.getCached('categories', user.uid, 'empresa');
      const cachedPessoal = localDB.getCached('categories', user.uid, 'pessoal');
      if (cachedEmpresa.length > 0 || cachedPessoal.length > 0) {
        setCategories([...cachedEmpresa, ...cachedPessoal]);
      }

      // 2. Busca Atualizada
      const catsEmpresa = await localDB.get('categories', user.uid, 'empresa');
      const catsPessoal = await localDB.get('categories', user.uid, 'pessoal');
      const cats = catsEmpresa.concat(catsPessoal);
      
      if (cats.length === 0 && !cachedEmpresa.length) {
        // Seed default categories
        await localDB.saveMany('categories', defaultCategories.map(cat => ({ ...cat, uid: user.uid })));
        const seededEmpresa = await localDB.get('categories', user.uid, 'empresa');
        const seededPessoal = await localDB.get('categories', user.uid, 'pessoal');
        setCategories(seededEmpresa.concat(seededPessoal));
      } else {
        setCategories(cats);
      }
    };

    loadData();
  }, [user, refreshTrigger]);

  const handleAddCategory = async () => {
    if (!newCategory.name || !user) return;
    
    const optimisticCat = {
      ...newCategory,
      id: 'temp_' + Date.now(),
      uid: user.uid,
      createdAt: new Date().toISOString()
    };

    setCategories(prev => [...prev, optimisticCat]);
    setNewCategory({ name: '', flow: 'despesa_variavel', context: 'empresa', color: getRandomColor() });
    setIsModalOpen(false);
    setHasChanges(true);

    (async () => {
      try {
        const savedCat = await localDB.save('categories', optimisticCat);
        if (savedCat && savedCat.id) {
          setCategories(prev => prev.map(c => c.id === optimisticCat.id ? savedCat : c));
        }
        triggerRefresh();
      } catch (err) {
        console.error('Error saving category:', err);
        triggerRefresh();
      }
    })();
  };

  const confirmDelete = (id: string) => {
    setCategoryToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (categoryToDelete) {
      const idToDelete = categoryToDelete;
      setCategories(prev => prev.filter(c => c.id !== idToDelete));
      setIsDeleteModalOpen(false);
      setCategoryToDelete(null);
      setHasChanges(true);

      (async () => {
        try {
          await localDB.delete('categories', idToDelete);
          triggerRefresh();
        } catch (err) {
          console.error(err);
          triggerRefresh();
        }
      })();
    }
  };

  const handleStartEdit = (cat: any) => {
    setCurrentCategory(cat);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!currentCategory || !currentCategory.name) return;
    
    const catToSave = currentCategory;
    setCategories(prev => prev.map(c => c.id === catToSave.id ? catToSave : c));
    setIsEditModalOpen(false);
    setCurrentCategory(null);
    setHasChanges(true);

    (async () => {
      try {
        await localDB.save('categories', catToSave);
        triggerRefresh();
      } catch (err) {
        console.error(err);
        triggerRefresh();
      }
    })();
  };

  const handleSaveChanges = () => {
    setShowSuccess(true);
    setHasChanges(false);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  if (!isAuthReady || !user || !isAdmin) return null;

  const renderCategoryList = (context: 'empresa' | 'pessoal') => {
    const filtered = categories.filter(c => c.context === context);
    const flows = [
      { id: 'receita', name: 'Receitas', icon: TrendingUp, color: 'text-success' },
      { id: 'despesa_fixa', name: 'Despesas Fixas', icon: TrendingDown, color: 'text-error' },
      { id: 'despesa_variavel', name: 'Despesas Variáveis', icon: Layers, color: 'text-amber-500' }
    ];

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-white",
              context === 'empresa' ? "bg-[#1d8490]" : "bg-[#ff6330]"
            )}>
              {context === 'empresa' ? <Building2 size={20} /> : <UserCircle2 size={20} />}
            </div>
            <h3 className="text-xl font-black text-on-surface">Categorias {context === 'empresa' ? 'Empresariais' : 'Pessoais'}</h3>
          </div>
          <button 
            onClick={() => {
              setNewCategory({ name: '', flow: 'despesa_variavel', context, color: getRandomColor() });
              setIsModalOpen(true);
            }}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-all",
              context === 'empresa' ? "bg-[#1d8490]" : "bg-[#ff6330]"
            )}
          >
            <Plus size={20} />
          </button>
        </div>

        {flows.map(flow => (
          <div key={flow.id} className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <flow.icon size={16} className={flow.color} />
              <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{flow.name}</h4>
            </div>

            <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
              <div className="divide-y divide-outline-variant/10">
                {filtered.filter(c => c.flow === flow.id).map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-4 hover:bg-surface-container-high transition-colors group">
                    <div className="flex items-center gap-3 flex-1">
                      <GripVertical size={16} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: cat.color || '#ccc' }}
                      />
                      <span className="text-sm font-bold text-on-surface">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleStartEdit(cat)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => confirmDelete(cat.id)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {filtered.filter(c => c.flow === flow.id).length === 0 && (
                  <div className="p-4 text-center">
                    <p className="text-xs text-on-surface-variant font-medium italic">Nenhuma categoria neste fluxo.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-8 pb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-on-surface">Gerenciamento de Categorias</h2>
            <p className="text-on-surface-variant font-medium mt-1">Organize seus fluxos financeiros por contexto e tipo.</p>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-xl text-sm font-bold"
                >
                  <Check size={16} />
                  Alterações salvas!
                </motion.div>
              )}
            </AnimatePresence>
            <button 
              onClick={handleSaveChanges}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all active:scale-95",
                hasChanges 
                  ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" 
                  : "bg-surface-container-high text-on-surface-variant opacity-70"
              )}
            >
              <Save size={20} />
              Salvar Alterações
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Empresa Column */}
          <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
            {renderCategoryList('empresa')}
          </div>

          {/* Pessoal Column */}
          <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/20 shadow-sm">
            {renderCategoryList('pessoal')}
          </div>
        </div>
      </div>

      {/* Add Category Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-md bg-surface-container-lowest rounded-[32px] p-8 shadow-2xl border border-outline-variant/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-on-surface">Nova Categoria</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-1">Nome da Categoria</label>
                  <input 
                    autoFocus
                    placeholder="Ex: Marketing, Salário..."
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    className="w-full bg-surface-container-high border-none rounded-2xl px-4 py-3 font-bold focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-1">Tipo de Fluxo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'receita', name: 'Receita', color: 'bg-success' },
                      { id: 'despesa_fixa', name: 'Fixa', color: 'bg-error' },
                      { id: 'despesa_variavel', name: 'Variável', color: 'bg-amber-500' }
                    ].map(flow => (
                      <button
                        key={flow.id}
                        onClick={() => setNewCategory({ ...newCategory, flow: flow.id })}
                        className={cn(
                          "py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all",
                          newCategory.flow === flow.id ? flow.color + " text-white shadow-md" : "bg-surface-container-high text-on-surface-variant"
                        )}
                      >
                        {flow.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-1">Cor da Categoria</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      className="w-12 h-12 rounded-xl border-none cursor-pointer bg-surface-container-high p-1"
                    />
                    <span className="text-sm font-bold text-on-surface font-mono uppercase">{newCategory.color}</span>
                  </div>
                </div>

                <button 
                  onClick={handleAddCategory}
                  disabled={!newCategory.name}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  Adicionar Categoria
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Category Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-[32px] p-8 shadow-2xl border border-outline-variant/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-on-surface">Editar Categoria</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-1">Nome da Categoria</label>
                  <input 
                    autoFocus
                    value={currentCategory?.name || ''}
                    onChange={(e) => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                    className="w-full bg-surface-container-high border-none rounded-2xl px-4 py-3 font-bold focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-1">Cor da Categoria</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color"
                      value={currentCategory?.color || '#1d8490'}
                      onChange={(e) => setCurrentCategory({ ...currentCategory, color: e.target.value })}
                      className="w-12 h-12 rounded-xl border-none cursor-pointer bg-surface-container-high p-1"
                    />
                    <span className="text-sm font-bold text-on-surface font-mono uppercase">{currentCategory?.color}</span>
                  </div>
                </div>

                <button 
                  onClick={handleSaveEdit}
                  disabled={!currentCategory?.name}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-surface-container-lowest rounded-[32px] p-8 shadow-2xl border border-outline-variant/20"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center text-error mb-6">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-black text-on-surface mb-2">Excluir Categoria?</h3>
                <p className="text-on-surface-variant font-medium mb-8">
                  Esta ação não pode ser desfeita. Transações vinculadas a esta categoria podem ficar sem classificação.
                </p>
                <div className="flex flex-col w-full gap-3">
                  <button 
                    onClick={handleDelete}
                    className="w-full py-4 bg-error text-white rounded-2xl font-black shadow-lg shadow-error/20 active:scale-95 transition-all"
                  >
                    Sim, Excluir
                  </button>
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="w-full py-4 bg-surface-container-high text-on-surface font-black rounded-2xl active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
