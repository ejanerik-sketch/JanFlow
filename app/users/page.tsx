'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { pb, POCKETBASE_URL } from '@/lib/pocketbase';
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
  Loader2, 
  Eye, 
  EyeOff,
  KeyRound,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crop
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
  const [showPassword, setShowPassword] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados para recorte de imagem e senha
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);
  const [passwordModalSuccess, setPasswordModalSuccess] = useState<string | null>(null);

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
      const cached = localStorage.getItem('janflow_cache_users_list');
      if (cached) {
        setUsers(JSON.parse(cached));
        setLoading(false);
      }

      try {
        const token = pb.authStore.token;
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'get', collection: 'users' })
        });
        if (res.ok) {
          const { data } = await res.json();
          // Converte para o formato esperado pelo frontend com resolução de foto
          const camelData = data.map((u: any) => ({
            ...u,
            photoURL: u.photoURL || u.photo_url || (u.avatar ? `${POCKETBASE_URL}/api/files/_pb_users_auth_/${u.id}/${u.avatar}` : '')
          }));
          setUsers(camelData);
          localStorage.setItem('janflow_cache_users_list', JSON.stringify(camelData));
        }
      } catch (err) {
        console.error('Failed to load users', err);
      }
      setLoading(false);
    };

    loadUsers();
  }, [isAdmin, isFinanceiro]);

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
    setError(null);
    setSuccess(null);
    setModalLoading(true);

    try {
      const token = pb.authStore.token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      if (editingUser) {
        const updatePayload: any = {
          id: editingUser.id,
          name: formData.name.trim(),
          role: formData.role,
          photoURL: formData.photoURL
        };
        
        if (formData.password && formData.password.trim()) {
          if (formData.password.trim().length < 6) {
            setError("A nova senha deve ter ao menos 6 caracteres.");
            setModalLoading(false);
            return;
          }
          updatePayload.password = formData.password.trim();
        }

        const response = await fetch('/api/users/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(updatePayload),
        });
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || 'Erro ao atualizar usuário');
        }

        const updated = {
          ...resData.user,
          photoURL: resData.user?.photoURL || (resData.user?.avatar ? `${POCKETBASE_URL}/api/files/_pb_users_auth_/${resData.user.id}/${resData.user.avatar}` : formData.photoURL)
        };
        const finalUsers = users.map(u => u.id === editingUser.id ? { ...u, ...updated } : u);
        setUsers(finalUsers);
        localStorage.setItem('janflow_cache_users_list', JSON.stringify(finalUsers));

        if (editingUser.email === user?.email || editingUser.id === user?.uid) {
          await refreshUserData();
        }
        setIsModalOpen(false);
      } else {
        if (!formData.password || formData.password.trim().length < 6) {
          setError("A senha inicial deve ter ao menos 6 caracteres.");
          setModalLoading(false);
          return;
        }

        const response = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: formData.email.trim(),
            password: formData.password.trim(),
            name: formData.name.trim(),
            role: formData.role,
            photoURL: formData.photoURL,
          }),
        });
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || 'Erro ao criar usuário');
        }

        const newUser = {
          ...resData.user,
          photoURL: resData.user?.photoURL || (resData.user?.avatar ? `${POCKETBASE_URL}/api/files/_pb_users_auth_/${resData.user.id}/${resData.user.avatar}` : formData.photoURL)
        };
        const finalUsers = [newUser, ...users];
        setUsers(finalUsers);
        localStorage.setItem('janflow_cache_users_list', JSON.stringify(finalUsers));
        setIsModalOpen(false);
      }
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      setError(err.message || 'Falha ao salvar usuário. Tente novamente.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    setPasswordModalError(null);
    setPasswordModalSuccess(null);

    if (!newPassword || newPassword.trim().length < 6) {
      setPasswordModalError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setPasswordModalLoading(true);
    try {
      const token = pb.authStore.token;
      const res = await fetch('/api/users/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: passwordModalUser.id, password: newPassword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao atualizar senha.');
      }
      setPasswordModalSuccess('Senha atualizada com sucesso!');
      setTimeout(() => {
        setPasswordModalUser(null);
        setNewPassword('');
        setPasswordModalSuccess(null);
      }, 1000);
    } catch (err: any) {
      setPasswordModalError(err.message || 'Erro ao atualizar senha.');
    } finally {
      setPasswordModalLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!isAdmin || !userToDelete) return;
    
    const currentUserId = user?.uid || user?.id;
    const userIdToDelete = userToDelete.id || userToDelete.uid;
    
    // Safety check: don't delete current user
    if (String(userIdToDelete) === String(currentUserId)) {
      setError("Você não pode excluir o seu próprio usuário logado.");
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      return;
    }

    // Otimista
    const updatedUsers = users.filter(u => String(u.id) !== String(userIdToDelete));
    setUsers(updatedUsers);
    localStorage.setItem('janflow_cache_users_list', JSON.stringify(updatedUsers));
    setIsDeleteModalOpen(false);
    setUserToDelete(null);

    (async () => {
      try {
        const token = pb.authStore.token;
        if (token) {
          await fetch('/api/users/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ uid: userIdToDelete }),
          });
        }
        await pb.collection('users').delete(userIdToDelete).catch(() => {});
      } catch (err: any) {
        console.error('Erro ao deletar:', err);
        // refresh full on error
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` },
          body: JSON.stringify({ action: 'get', collection: 'users' })
        });
        if (res.ok) {
          const { data } = await res.json();
          setUsers(data.map((u: any) => ({ ...u, photoURL: u.photoURL || u.photo_url || '' })));
        }
      }
    })();
  };

  const confirmDelete = (u: any) => {
    if (!isAdmin) return;
    setUserToDelete(u);
    setIsDeleteModalOpen(true);
  };

  const handleResetPassword = async (email: string) => {
    if (window.confirm(`Deseja enviar um e-mail de redefinição de senha para ${email}?`)) {
      try {
        await pb.collection('users').requestPasswordReset(email);
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
          {isAdmin && (
            <button
              onClick={() => handleOpenModal()}
              className="bg-primary text-on-primary px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              <UserPlus size={20} />
              Novo Usuário
            </button>
          )}
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
                        <Image src={u.photoURL} alt={u.name} width={56} height={56} unoptimized={true} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                    {isAdmin && (
                      <button 
                        onClick={() => handleOpenModal(u)}
                        className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors"
                        title="Editar Usuário"
                      >
                        <Edit2 size={18} />
                      </button>
                    )}
                    {isAdmin && String(u.id) !== String(user?.uid || user?.id) && String(u.uid) !== String(user?.uid || user?.id) && (
                      <button 
                        onClick={() => confirmDelete(u)}
                        className="p-2 text-error hover:bg-error/10 rounded-xl transition-colors"
                        title="Excluir Usuário"
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
                  {isAdmin && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setPasswordModalUser(u);
                          setNewPassword('');
                          setShowNewPassword(false);
                          setPasswordModalError(null);
                          setPasswordModalSuccess(null);
                        }}
                        className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest flex items-center gap-1"
                        title="Alterar senha deste usuário"
                      >
                        <KeyRound size={12} />
                        Alterar Senha
                      </button>
                    </div>
                  )}
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
                          <Image src={formData.photoURL} alt="Preview" width={80} height={80} unoptimized={true} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 px-4 py-3 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                          >
                            <Camera size={18} />
                            Anexar Foto
                          </button>
                          {formData.photoURL && (
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, photoURL: ''})}
                              className="px-4 py-3 bg-error/10 text-error hover:bg-error/20 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                              title="Remover Foto"
                            >
                              <X size={18} />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-medium text-center">
                          Formatos aceitos: JPG, PNG, WebP. Enquadramento e compressão automática inclusos.
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
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required={!editingUser}
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full px-5 py-4 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all pr-12"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nível de Acesso</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['admin', 'financeiro', 'analista'] as const).map((role) => (
                        <button
                          key={role}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => setFormData({...formData, role})}
                          className={cn(
                            "py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                            formData.role === role 
                              ? "bg-primary/10 border-primary text-primary shadow-sm" 
                              : "bg-surface-container-high border-transparent text-on-surface-variant hover:bg-surface-container-highest",
                            !isAdmin && "opacity-50 cursor-not-allowed"
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

      {/* Modal de Alteração de Senha Direta */}
      <AnimatePresence>
        {passwordModalUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPasswordModalUser(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-on-surface">Alterar Senha</h3>
                    <p className="text-xs text-on-surface-variant font-medium">{passwordModalUser.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPasswordModalUser(null)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {passwordModalError && (
                <div className="mb-4 p-3 bg-error/10 text-error text-xs rounded-xl font-bold border border-error/20">
                  {passwordModalError}
                </div>
              )}

              {passwordModalSuccess && (
                <div className="mb-4 p-3 bg-success/10 text-success text-xs rounded-xl font-bold border border-success/20">
                  {passwordModalSuccess}
                </div>
              )}

              <form onSubmit={handleChangePasswordSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      autoFocus
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-5 py-3.5 bg-surface-container-high border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-medium ml-1">
                    Defina uma nova senha para o usuário <strong>{passwordModalUser.email}</strong>.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModalUser(null)}
                    className="flex-1 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-high text-xs transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={passwordModalLoading}
                    className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {passwordModalLoading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Check size={16} />
                    )}
                    Salvar Nova Senha
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Recorte e Compressão de Foto */}
      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onConfirm={(croppedDataUrl) => {
            setFormData(prev => ({ ...prev, photoURL: croppedDataUrl }));
            setCropImageSrc(null);
          }}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </Layout>
  );
}

function ImageCropperModal({
  imageSrc,
  onConfirm,
  onCancel
}: {
  imageSrc: string;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const imageRef = React.useRef<HTMLImageElement>(null);
  const containerSize = 260;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const handleCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    const targetDim = 256;
    const canvas = document.createElement('canvas');
    canvas.width = targetDim;
    canvas.height = targetDim;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetDim, targetDim);

    const aspect = (img.naturalWidth || containerSize) / (img.naturalHeight || containerSize);
    let baseW = containerSize;
    let baseH = containerSize;
    if (aspect > 1) {
      baseW = containerSize * aspect;
    } else {
      baseH = containerSize / aspect;
    }

    const scale = targetDim / containerSize;
    const drawW = baseW * zoom * scale;
    const drawH = baseH * zoom * scale;
    const drawX = (targetDim - drawW) / 2 + pan.x * scale;
    const drawY = (targetDim - drawH) / 2 + pan.y * scale;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Salva com compressão automática JPEG otimizada (~12KB a 20KB)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    onConfirm(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-surface-container-lowest rounded-[32px] p-6 shadow-2xl space-y-5 text-center">
        <div>
          <h3 className="text-lg font-black text-on-surface">Ajustar e Recortar Foto</h3>
          <p className="text-xs text-on-surface-variant font-medium">Arraste a foto e ajuste o zoom para enquadrar</p>
        </div>

        <div
          className="relative w-[260px] h-[260px] mx-auto overflow-hidden rounded-full border-4 border-primary/40 shadow-inner bg-black cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop"
            draggable={false}
            className="absolute max-w-none pointer-events-none"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center'
            }}
          />
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-3 px-2">
          <ZoomOut size={16} className="text-on-surface-variant" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-primary cursor-pointer"
          />
          <ZoomIn size={16} className="text-on-surface-variant" />
          <button
            type="button"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant"
            title="Redefinir enquadramento"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-high text-xs transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCrop}
            className="flex-1 py-3 rounded-xl font-bold bg-primary text-on-primary text-xs shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Check size={16} />
            Aplicar Foto
          </button>
        </div>
      </div>
    </div>
  );
}
