'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import Layout from '@/components/Layout';
import Image from 'next/image';
import { 
  UserPlus, 
  Search, 
  Mail, 
  Shield, 
  Trash2, 
  Edit2, 
  X, 
  Check,
  Camera,
  ShieldCheck,
  ShieldAlert,
  User as UserIcon,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export default function UsersPage() {
  const { user, isAdmin, isFinanceiro, isAuthReady, refreshUserData } = useAppContext();
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'analista' as 'admin' | 'financeiro' | 'analista',
    photoURL: ''
  });

  useEffect(() => {
    if (isAuthReady && !isAdmin && !isFinanceiro) {
      router.push('/');
    }
  }, [isAdmin, isFinanceiro, isAuthReady, router]);

  useEffect(() => {
    if (!isAdmin && !isFinanceiro) return;

    const loadUsers = async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (data) {
        setUsers(data);
      }
      setLoading(false);
    };

    loadUsers();
  }, [isAdmin, isFinanceiro]);

  const saveUsersToLocal = (newUsers: any[]) => {
    localStorage.setItem('janflow_users_list', JSON.stringify(newUsers));
    setUsers(newUsers);
  };

  const handleOpenModal = (userToEdit: any = null) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setFormData({
        name: userToEdit.name || '',
        email: userToEdit.email || '',
        password: '',
        role: userToEdit.role || 'analista',
        photoURL: userToEdit.photoURL || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'analista',
        photoURL: ''
      });
    }
    setIsModalOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingUser) {
        // 1. Update Profile in public.profiles
        const profileUpdate: any = {
          name: formData.name,
          role: formData.role,
          photoURL: formData.photoURL
        };
        
        // If password is provided, also update it in the profiles table if it's used there
        if (formData.password) {
          profileUpdate.password = formData.password;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', editingUser.id);

        if (profileError) throw profileError;

        // 2. Update Password if provided
        if (formData.password) {
          const isCurrentUser = String(editingUser.id) === String(user?.uid || user?.id);
          
          if (isCurrentUser) {
            // Update current user password
            const { error: authError } = await supabase.auth.updateUser({
              password: formData.password
            });
            if (authError) throw authError;
          } else {
            // Update via API route — exige sessão de admin (token no header)
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              throw new Error('Sessão expirada. Faça login novamente.');
            }
            const response = await fetch('/api/users/update-password', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ userId: editingUser.id, password: formData.password }),
            });
            
            if (!response.ok) {
              const resData = await response.json();
              throw new Error(resData.error || 'Erro ao atualizar senha de outro usuário. Certifique-se que o Admin tenha a Role Key configurada.');
            }
          }
        }
        
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, name: formData.name, role: formData.role, photoURL: formData.photoURL } : u));
        setSuccess('Usuário atualizado com sucesso!');
      } else {
        // Criação via rota admin server-side (admin.createUser com email_confirm:true).
        // Isso garante que o usuário já entra confirmado e consegue logar na hora —
        // o signUp client-side antigo deixava o usuário preso como não-confirmado em
        // produção (confirmação de e-mail ativa + sem SMTP), quebrando o login.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        const response = await fetch('/api/users/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: formData.role,
            photoURL: formData.photoURL,
          }),
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || 'Erro ao criar usuário. Certifique-se que o Admin tenha a Role Key configurada.');
        }

        const createdUser = resData.user;

        // Busca o perfil recém-criado para exibir na lista
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', createdUser.id)
          .single();

        if (newProfile) {
          setUsers([newProfile, ...users]);
        } else {
          // Fallback se a leitura do perfil falhar
          setUsers([{
            id: createdUser.id,
            email: formData.email,
            name: formData.name,
            role: formData.role,
            photoURL: formData.photoURL,
            created_at: new Date().toISOString()
          }, ...users]);
        }

        setSuccess('Usuário criado com sucesso!');
      }
      
      // Refresh context if editing current user
      if (editingUser && (editingUser.email === user?.email || editingUser.uid === user?.uid)) {
        refreshUserData();
      }

      setTimeout(() => {
        setIsModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar usuário.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) { // ~800KB limit to be safe with localStorage
        alert("A imagem é muito grande. Escolha uma imagem menor que 800KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteUser = async () => {
    if (!isAdmin || !userToDelete) return;
    
    const currentUserId = user?.uid || user?.id;
    const userIdToDelete = userToDelete.id || userToDelete.uid;
    
    // Safety check: don't delete current user or the main admin
    if (String(userIdToDelete) === String(currentUserId) || userToDelete.email === 'ejanerik@gmail.com') {
      setError("Você não pode excluir o administrador principal ou o usuário logado.");
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      return;
    }

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userIdToDelete);
      if (error) throw error;

      const updatedUsers = users.filter(u => 
        String(u.id) !== String(userIdToDelete) && 
        String(u.uid) !== String(userIdToDelete)
      );
      
      setUsers(updatedUsers);
      setSuccess('Usuário excluído com sucesso!');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir usuário.');
    }
  };

  const confirmDelete = (u: any) => {
    if (!isAdmin) return;
    setUserToDelete(u);
    setIsDeleteModalOpen(true);
  };

  const handleResetPassword = async (email: string) => {
    if (window.confirm(`Deseja enviar um e-mail de redefinição de senha para ${email}?`)) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        alert(`E-mail de redefinição enviado para ${email}`);
      } catch (err: any) {
        alert(`Erro ao enviar e-mail: ${err.message}`);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthReady || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-on-surface">Gestão de Usuários</h1>
            <p className="text-on-surface-variant font-medium">Controle quem tem acesso ao sistema e seus níveis de permissão.</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="bg-primary text-on-primary px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <UserPlus size={20} />
            Novo Usuário
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-surface-container-high border-none rounded-2xl text-on-surface font-medium focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredUsers.map((u) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center overflow-hidden border-2 border-outline-variant/30">
                      {u.photoURL ? (
                        <Image src={u.photoURL} alt={u.name} width={56} height={56} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon size={28} className="text-on-surface-variant" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface line-clamp-1">{u.name}</h3>
                      <p className="text-xs text-on-surface-variant font-medium line-clamp-1">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleOpenModal(u)}
                      className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    {isAdmin && String(u.id) !== String(user?.uid || user?.id) && String(u.uid) !== String(user?.uid || user?.id) && (
                      <button 
                        onClick={() => confirmDelete(u)}
                        className="p-2 text-error hover:bg-error/10 rounded-xl transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                    u.role === 'admin' ? "bg-primary/10 text-primary" :
                    u.role === 'financeiro' ? "bg-secondary/10 text-secondary" :
                    "bg-on-surface-variant/10 text-on-surface-variant"
                  )}>
                    {u.role === 'admin' ? <ShieldCheck size={12} /> : 
                     u.role === 'financeiro' ? <Shield size={12} /> : 
                     <ShieldAlert size={12} />}
                    {u.role}
                  </div>
                  <button
                    onClick={() => handleResetPassword(u.email)}
                    className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
                  >
                    Redefinir Senha
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal Novo/Editar Usuário */}
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
              className="relative w-full max-w-lg bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black tracking-tight text-on-surface">
                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                  </h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-error/10 text-error text-sm rounded-2xl font-bold border border-error/20">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mb-6 p-4 bg-success/10 text-success text-sm rounded-2xl font-bold border border-success/20">
                    {success}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Foto de Perfil</label>
                    <div className="flex gap-4 items-center">
                      <div className="w-20 h-20 rounded-2xl bg-surface-container-high flex items-center justify-center overflow-hidden border-2 border-outline-variant/30 shrink-0">
                        {formData.photoURL ? (
                          <Image src={formData.photoURL} alt="Preview" width={80} height={80} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <UserIcon size={32} className="text-on-surface-variant" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full px-4 py-3 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                        >
                          <Camera size={18} />
                          Anexar Foto
                        </button>
                        <p className="text-[10px] text-on-surface-variant font-medium text-center">
                          Formatos aceitos: JPG, PNG. Máx 800KB.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-5 py-4 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder="Ex: João Silva"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">E-mail</label>
                    <input
                      type="email"
                      required
                      disabled={!!editingUser}
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-5 py-4 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">
                      {editingUser ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha Inicial'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full px-5 py-4 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nível de Acesso</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['admin', 'financeiro', 'analista'] as const).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setFormData({...formData, role})}
                          className={cn(
                            "py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                            formData.role === role 
                              ? "bg-primary/10 border-primary text-primary shadow-sm" 
                              : "bg-surface-container-high border-transparent text-on-surface-variant hover:bg-surface-container-highest"
                          )}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={modalLoading}
                      className="flex-[2] bg-primary text-on-primary py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {modalLoading ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <Check size={20} />
                      )}
                      {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-on-surface mb-2">Excluir Usuário?</h3>
              <p className="text-on-surface-variant mb-8">
                Esta ação removerá permanentemente o acesso de <strong>{userToDelete?.name}</strong> ao sistema.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="flex-1 bg-error text-on-error py-3 rounded-2xl font-bold shadow-lg shadow-error/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
