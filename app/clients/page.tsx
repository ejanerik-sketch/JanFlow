'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import { 
  Building2, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  Check,
  Briefcase,
  User,
  FileText,
  Loader2,
  Building,
  Download,
  FileDown,
  Calendar,
  RefreshCw,
  Clock,
  History,
  DollarSign,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDB } from '@/lib/localDB';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientsPage() {
  const { user, isAdmin, isFinanceiro, isAuthReady } = useAppContext();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: '',
    cnpj: '',
    companyEmail: '',
    responsibleName: '',
    responsibleCpf: '',
    responsibleEmail: '',
    description: '',
    contractDate: '',
    renewalPeriod: '365', // Fixed to 365 days
    paymentHistory: [] as any[],
    renewalHistory: [] as any[]
  });

  const [newPayment, setNewPayment] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    service: '',
    value: ''
  });

  useEffect(() => {
    if (isAuthReady && !isAdmin && !isFinanceiro) {
      router.push('/');
    }
  }, [isAdmin, isFinanceiro, isAuthReady, router]);

  useEffect(() => {
    if (!isAdmin && !isFinanceiro) return;
    if (!user) return;

    const loadData = async () => {
      const clientsList = await localDB.get('clients', user.uid);
      setClients(clientsList);
      setLoading(false);
    };

    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [isAdmin, isFinanceiro, user]);

  const handleOpenModal = (clientToEdit: any = null) => {
    if (clientToEdit) {
      setEditingClient(clientToEdit);
      setFormData({
        companyName: clientToEdit.companyName || '',
        cnpj: clientToEdit.cnpj || '',
        companyEmail: clientToEdit.companyEmail || '',
        responsibleName: clientToEdit.responsibleName || '',
        responsibleCpf: clientToEdit.responsibleCpf || '',
        responsibleEmail: clientToEdit.responsibleEmail || '',
        description: clientToEdit.description || '',
        contractDate: clientToEdit.contractDate || '',
        renewalPeriod: clientToEdit.renewalPeriod || '365',
        paymentHistory: clientToEdit.paymentHistory || [],
        renewalHistory: clientToEdit.renewalHistory || []
      });
    } else {
      setEditingClient(null);
      setFormData({
        companyName: '',
        cnpj: '',
        companyEmail: '',
        responsibleName: '',
        responsibleCpf: '',
        responsibleEmail: '',
        description: '',
        contractDate: '',
        renewalPeriod: '365',
        paymentHistory: [],
        renewalHistory: []
      });
    }
    setIsModalOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleAddPayment = () => {
    if (!newPayment.service || !newPayment.value) return;
    
    const payment = {
      id: Date.now().toString(),
      ...newPayment,
      value: parseFloat(newPayment.value)
    };
    
    setFormData({
      ...formData,
      paymentHistory: [payment, ...formData.paymentHistory]
    });
    
    setNewPayment({
      date: format(new Date(), 'yyyy-MM-dd'),
      service: '',
      value: ''
    });
  };

  const handleRemovePayment = (id: string) => {
    setFormData({
      ...formData,
      paymentHistory: formData.paymentHistory.filter((p: any) => p.id !== id)
    });
  };

  const handleAddRenewal = (date: string) => {
    if (!date) return;
    const renewal = {
      id: Date.now().toString(),
      date: date,
      createdAt: new Date().toISOString()
    };
    setFormData({
      ...formData,
      renewalHistory: [renewal, ...formData.renewalHistory]
    });
  };

  const handleRemoveRenewal = (id: string) => {
    setFormData({
      ...formData,
      renewalHistory: formData.renewalHistory.filter((r: any) => r.id !== id)
    });
  };

  const calculateRenewal = (contractDate: string) => {
    if (!contractDate) return null;
    try {
      const start = parseISO(contractDate);
      const today = new Date();
      
      // Find the next occurrence of the contract's month and day
      let nextRenewal = new Date(today.getFullYear(), start.getMonth(), start.getDate());
      
      // If the date has already passed this year, set it to next year
      if (nextRenewal < today) {
        nextRenewal.setFullYear(today.getFullYear() + 1);
      }
      
      const daysLeft = differenceInDays(nextRenewal, today);
      
      return {
        date: format(nextRenewal, 'dd/MM/yyyy'),
        daysLeft: daysLeft
      };
    } catch (e) {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setModalLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...formData,
        uid: user.uid,
        createdAt: new Date().toISOString()
      };

      if (editingClient) {
        await localDB.save('clients', { ...payload, id: editingClient.id });
        setSuccess('Cliente atualizado com sucesso!');
      } else {
        await localDB.save('clients', payload);
        setSuccess('Cliente cadastrado com sucesso!');
      }
      
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar cliente.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!isAdmin || !clientToDelete) return;

    try {
      await localDB.delete('clients', clientToDelete);
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const confirmDelete = (clientId: string) => {
    if (!isAdmin) return;
    setClientToDelete(clientId);
    setIsDeleteModalOpen(true);
  };

  const filteredClients = clients.filter(c => 
    (c.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cnpj || '').includes(searchTerm) ||
    (c.responsibleName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['ID', 'Empresa', 'CNPJ', 'E-mail Empresa', 'Responsável', 'CPF Responsável', 'E-mail Responsável', 'Data de Contrato', 'Próxima Renovação', 'Descrição', 'Data Cadastro'];
    const rows = clients.map(c => {
      const renewal = calculateRenewal(c.contractDate);
      return [
        c.id,
        c.companyName,
        c.cnpj,
        c.companyEmail,
        c.responsibleName,
        c.responsibleCpf,
        c.responsibleEmail,
        c.contractDate ? format(parseISO(c.contractDate), 'dd/MM/yyyy') : '-',
        renewal ? renewal.date : '-',
        c.description,
        c.createdAt
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_janflow_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = (client: any) => {
    const doc = new jsPDF();
    const primaryColor = [29, 132, 144]; // #1d8490
    const secondaryColor = [255, 99, 48]; // #ff6330
    const textColor = [44, 62, 80];
    const lightGray = [245, 247, 250];

    // --- HEADER ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('JanFlow', 20, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('GESTÃO FINANCEIRA INTEGRADA', 20, 28);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FICHA CADASTRAL DO CLIENTE', 190, 25, { align: 'right' });

    // --- CLIENT MAIN INFO ---
    let y = 55;
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('DADOS DA EMPRESA', 20, y);
    
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(20, y + 2, 60, y + 2);

    y += 15;
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(20, y - 5, 170, 50, 3, 3, 'F');

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(9);
    
    // Column 1 - Company
    doc.setFont('helvetica', 'bold');
    doc.text('EMPRESA:', 25, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${client.companyName}`, 55, y + 5, { maxWidth: 50 });

    doc.setFont('helvetica', 'bold');
    doc.text('CNPJ:', 25, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(`${client.cnpj || 'Não informado'}`, 55, y + 20);

    doc.setFont('helvetica', 'bold');
    doc.text('E-MAIL EMP.:', 25, y + 30);
    doc.setFont('helvetica', 'normal');
    doc.text(`${client.companyEmail || 'Não informado'}`, 55, y + 30, { maxWidth: 50 });

    // Column 2 - Responsible
    doc.setFont('helvetica', 'bold');
    doc.text('RESPONSÁVEL:', 110, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${client.responsibleName}`, 140, y + 5, { maxWidth: 45 });

    doc.setFont('helvetica', 'bold');
    doc.text('CPF RESP.:', 110, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(`${client.responsibleCpf || 'Não informado'}`, 140, y + 20);

    doc.setFont('helvetica', 'bold');
    doc.text('E-MAIL RESP.:', 110, y + 30);
    doc.setFont('helvetica', 'normal');
    doc.text(`${client.responsibleEmail || 'Não informado'}`, 140, y + 30, { maxWidth: 45 });

    // --- CONTRACT INFO ---
    y += 60;
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('CONTRATO E RENOVAÇÃO', 20, y);
    doc.line(20, y + 2, 75, y + 2);

    y += 15;
    const renewal = calculateRenewal(client.contractDate);
    
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(230, 230, 230);
    doc.roundedRect(20, y - 5, 170, 30, 2, 2, 'FD');

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Data do Contrato:', 25, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${client.contractDate ? format(parseISO(client.contractDate), 'dd/MM/yyyy') : 'Não definida'}`, 70, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text('Período de Renovação:', 25, y + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(`Anual (365 dias)`, 70, y + 15);

    if (renewal) {
      doc.setFont('helvetica', 'bold');
      doc.text('Próxima Renovação:', 25, y + 25);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(`${renewal.date} (${renewal.daysLeft} dias restantes)`, 70, y + 25);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    }

    // Move Y down after the contract box
    y += 35;

    // --- RENEWAL HISTORY ---
    if (client.renewalHistory && client.renewalHistory.length > 0) {
      y += 10;
      if (y > 250) { doc.addPage(); y = 30; }
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(12);
      doc.text('HISTÓRICO DE RENOVAÇÕES', 20, y);
      doc.line(20, y + 1, 75, y + 1);
      
      y += 10;
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFontSize(9);
      client.renewalHistory.forEach((r: any, idx: number) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(`• Renovação registrada em: ${format(parseISO(r.date), 'dd/MM/yyyy')}`, 25, y);
        y += 7;
      });
      y += 5; // Extra space after history
    }

    // --- DESCRIPTION ---
    y += 15;
    if (y > 250) {
      doc.addPage();
      y = 30;
    }
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text('OBSERVAÇÕES', 20, y);
    doc.line(20, y + 2, 55, y + 2);

    y += 12;
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const splitDesc = doc.splitTextToSize(client.description || 'Nenhuma observação registrada.', 170);
    doc.text(splitDesc, 20, y);

    // --- PAYMENT HISTORY ---
    if (client.paymentHistory && client.paymentHistory.length > 0) {
      doc.addPage();
      
      // Header for second page
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`HISTÓRICO FINANCEIRO - ${client.companyName.toUpperCase()}`, 20, 13);

      y = 40;
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(14);
      doc.text('RECEBIMENTOS REGISTRADOS', 20, y);
      doc.line(20, y + 2, 85, y + 2);

      y += 15;
      // Table Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(20, y, 170, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('DATA', 25, y + 5.5);
      doc.text('DESCRIÇÃO DO SERVIÇO', 55, y + 5.5);
      doc.text('VALOR (R$)', 160, y + 5.5);

      y += 8;
      client.paymentHistory.forEach((p: any, index: number) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        if (index % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(20, y, 170, 8, 'F');
        }
        
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(format(parseISO(p.date), 'dd/MM/yyyy'), 25, y + 5.5);
        doc.text(p.service, 55, y + 5.5);
        doc.setFont('helvetica', 'bold');
        doc.text(p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 185, y + 5.5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        
        y += 8;
      });
    }

    // --- FOOTER ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(230, 230, 230);
      doc.line(20, 282, 190, 282);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`JanFlow - Sistema de Gestão Financeira | Gerado em ${new Date().toLocaleString('pt-BR')}`, 20, 288);
      doc.text(`Página ${i} de ${pageCount}`, 190, 288, { align: 'right' });
    }

    doc.save(`Ficha_Cliente_${client.companyName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleExportListPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
    const primaryColor = [29, 132, 144];
    const textColor = [44, 62, 80];

    // Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 297, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTA DE CLIENTES - JANFLOW', 15, 13);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 282, 13, { align: 'right' });

    // Table Header
    let y = 30;
    doc.setFillColor(240, 240, 240);
    doc.rect(10, y, 277, 8, 'F');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(8);
    doc.text('EMPRESA', 15, y + 5.5);
    doc.text('CNPJ', 65, y + 5.5);
    doc.text('RESPONSÁVEL', 105, y + 5.5);
    doc.text('E-MAIL EMPRESA', 155, y + 5.5);
    doc.text('CONTRATO', 215, y + 5.5);
    doc.text('RENOVAÇÃO', 245, y + 5.5);

    y += 8;
    clients.forEach((c: any, index: number) => {
      if (y > 180) {
        doc.addPage('a4', 'l');
        y = 20;
        // Repeat header on new page
        doc.setFillColor(240, 240, 240);
        doc.rect(10, y, 277, 8, 'F');
        doc.text('EMPRESA', 15, y + 5.5);
        doc.text('CNPJ', 65, y + 5.5);
        doc.text('RESPONSÁVEL', 105, y + 5.5);
        doc.text('E-MAIL EMPRESA', 155, y + 5.5);
        doc.text('CONTRATO', 215, y + 5.5);
        doc.text('RENOVAÇÃO', 245, y + 5.5);
        y += 8;
      }

      if (index % 2 === 0) {
        doc.setFillColor(252, 252, 252);
        doc.rect(10, y, 277, 7, 'F');
      }

      const renewal = calculateRenewal(c.contractDate);
      doc.text(c.companyName.substring(0, 30), 15, y + 5);
      doc.text(c.cnpj || '-', 65, y + 5);
      doc.text(c.responsibleName.substring(0, 25), 105, y + 5);
      doc.text(c.companyEmail || '-', 155, y + 5);
      doc.text(c.contractDate ? format(parseISO(c.contractDate), 'dd/MM/yy') : '-', 215, y + 5);
      doc.text(renewal ? renewal.date : '-', 245, y + 5);

      y += 7;
    });

    // Footer for List PDF
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(230, 230, 230);
      doc.line(10, 195, 287, 195);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`JanFlow - Relatório de Clientes | Gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 202);
      doc.text(`Página ${i} de ${pageCount}`, 282, 202, { align: 'right' });
    }

    doc.save(`Lista_Clientes_JanFlow_${new Date().toISOString().split('T')[0]}.pdf`);
  };

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
            <h1 className="text-3xl font-black tracking-tight text-on-surface">Gestão de Clientes</h1>
            <p className="text-on-surface-variant font-medium">Cadastre e gerencie as empresas que sua agência atende.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="bg-surface-container-high text-on-surface px-4 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all text-xs"
              title="Exportar CSV"
            >
              <Download size={18} />
              CSV
            </button>
            <button
              onClick={handleExportListPDF}
              className="bg-surface-container-high text-on-surface px-4 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all text-xs"
              title="Exportar PDF da Lista"
            >
              <FileDown size={18} />
              PDF Lista
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="bg-primary text-on-primary px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={20} />
              Novo Cliente
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input
            type="text"
            placeholder="Buscar por empresa, CNPJ ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-surface-container-high border-none rounded-2xl text-on-surface font-medium focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredClients.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Building size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface line-clamp-1">{c.companyName}</h3>
                      <p className="text-xs text-on-surface-variant font-medium">{c.cnpj || 'Sem CNPJ'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleDownloadPDF(c)}
                      title="Baixar PDF"
                      className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
                    >
                      <FileDown size={18} />
                    </button>
                    <button 
                      onClick={() => handleOpenModal(c)}
                      className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => confirmDelete(c.id)}
                        className="p-2 text-error hover:bg-error/10 rounded-xl transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-outline-variant/30">
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <User size={14} className="text-primary" />
                    <span className="font-bold">Responsável:</span>
                    <span className="font-medium">{c.responsibleName}</span>
                  </div>
                  {(c.companyEmail || c.responsibleEmail) && (
                    <div className="flex flex-col gap-1 mt-1">
                      {c.companyEmail && (
                        <div className="text-[10px] text-on-surface-variant opacity-70 flex items-center gap-1">
                          <span className="font-bold">E-mail Empresa:</span> {c.companyEmail}
                        </div>
                      )}
                      {c.responsibleEmail && (
                        <div className="text-[10px] text-on-surface-variant opacity-70 flex items-center gap-1">
                          <span className="font-bold">E-mail Resp.:</span> {c.responsibleEmail}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <FileText size={14} className="text-primary" />
                    <span className="font-bold">CPF:</span>
                    <span className="font-medium">{c.responsibleCpf || '-'}</span>
                  </div>
                  
                  {c.contractDate && (
                    <div className="pt-3 mt-3 border-t border-outline-variant/20 space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1 text-on-surface-variant">
                          <Calendar size={12} className="text-primary" />
                          <span>Contrato: {format(parseISO(c.contractDate), 'dd/MM/yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1 text-on-surface-variant">
                          <RefreshCw size={12} className="text-primary" />
                          <span>Anual</span>
                        </div>
                      </div>
                      
                      {(() => {
                        const renewal = calculateRenewal(c.contractDate);
                        if (!renewal) return null;
                        const isUrgent = renewal.daysLeft <= 30; // 30 days for annual is more reasonable
                        const isExpired = renewal.daysLeft < 0;
                        
                        return (
                          <div className={cn(
                            "flex items-center justify-between p-2 rounded-lg text-[10px] font-bold",
                            isExpired ? "bg-error/10 text-error" : 
                            isUrgent ? "bg-warning/10 text-warning" : 
                            "bg-success/10 text-success"
                          )}>
                            <div className="flex items-center gap-1">
                              <Clock size={12} />
                              <span>Próxima Renovação: {renewal.date}</span>
                            </div>
                            <span>
                              {isExpired ? `Expirado há ${Math.abs(renewal.daysLeft)}d` : 
                               isUrgent ? `Renova em ${renewal.daysLeft}d` : 
                               `${renewal.daysLeft} dias restantes`}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {c.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-2 italic mt-2">
                      &quot;{c.description}&quot;
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredClients.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant opacity-40">
            <Building2 size={64} />
            <p className="mt-4 font-bold">Nenhum cliente encontrado.</p>
          </div>
        )}
      </div>

      {/* Modal Novo/Editar Cliente */}
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
              className="relative w-full max-w-2xl bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black tracking-tight text-on-surface">
                    {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary border-b border-primary/10 pb-2">Dados da Empresa</h3>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome da Empresa</label>
                        <input
                          type="text"
                          required
                          value={formData.companyName}
                          onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                          className="w-full px-5 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="Ex: Agência Digital X"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">CNPJ</label>
                        <input
                          type="text"
                          value={formData.cnpj}
                          onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                          className="w-full px-5 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="00.000.000/0000-00"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">E-mail da Empresa</label>
                        <input
                          type="email"
                          value={formData.companyEmail}
                          onChange={(e) => setFormData({...formData, companyEmail: e.target.value})}
                          className="w-full px-5 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="empresa@email.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Responsável</label>
                        <input
                          type="text"
                          required
                          value={formData.responsibleName}
                          onChange={(e) => setFormData({...formData, responsibleName: e.target.value})}
                          className="w-full px-5 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="Nome do contato"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">CPF do Responsável</label>
                        <input
                          type="text"
                          value={formData.responsibleCpf}
                          onChange={(e) => setFormData({...formData, responsibleCpf: e.target.value})}
                          className="w-full px-5 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="000.000.000-00"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">E-mail do Responsável</label>
                        <input
                          type="email"
                          value={formData.responsibleEmail}
                          onChange={(e) => setFormData({...formData, responsibleEmail: e.target.value})}
                          className="w-full px-5 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="responsavel@email.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary border-b border-primary/10 pb-2">Contrato e Renovação</h3>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Data do Contrato</label>
                        <input
                          type="date"
                          value={formData.contractDate}
                          onChange={(e) => setFormData({...formData, contractDate: e.target.value})}
                          className="w-full px-5 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Período de Renovação</label>
                        <div className="w-full px-5 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold text-on-surface-variant">
                          Anual (365 dias)
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Descrição / Observações</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          rows={2}
                          className="w-full px-5 py-3 bg-surface-container-high border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                          placeholder="Informações adicionais..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary border-b border-primary/10 pb-2 flex items-center gap-2">
                        <RefreshCw size={16} />
                        Histórico de Renovações
                      </h3>
                      <div className="bg-surface-container-high p-4 rounded-2xl space-y-4">
                        <div className="flex gap-2">
                          <input
                            type="date"
                            id="newRenewalDate"
                            className="flex-1 px-4 py-2 bg-surface-container-lowest border-none rounded-xl text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById('newRenewalDate') as HTMLInputElement;
                              handleAddRenewal(input.value);
                              input.value = '';
                            }}
                            className="p-2 bg-primary text-on-primary rounded-xl hover:scale-105 transition-all"
                          >
                            <PlusCircle size={20} />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                          {formData.renewalHistory.length === 0 ? (
                            <p className="text-[10px] text-on-surface-variant text-center py-4 italic">Nenhuma renovação registrada.</p>
                          ) : (
                            formData.renewalHistory.map((r: any) => (
                              <div key={r.id} className="flex items-center justify-between bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/20">
                                <div className="text-xs font-bold text-on-surface">
                                  {format(parseISO(r.date), 'dd/MM/yyyy')}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRenewal(r.id)}
                                  className="text-error hover:bg-error/10 p-1 rounded-md transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary border-b border-primary/10 pb-2 flex items-center gap-2">
                        <History size={16} />
                        Histórico de Recebimentos
                      </h3>
                      
                      <div className="bg-surface-container-high p-4 rounded-2xl space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input
                            type="date"
                            value={newPayment.date}
                            onChange={(e) => setNewPayment({...newPayment, date: e.target.value})}
                            className="px-4 py-2 bg-surface-container-lowest border-none rounded-xl text-xs font-bold"
                          />
                          <input
                            type="text"
                            placeholder="Serviço"
                            value={newPayment.service}
                            onChange={(e) => setNewPayment({...newPayment, service: e.target.value})}
                            className="px-4 py-2 bg-surface-container-lowest border-none rounded-xl text-xs font-bold"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Valor"
                              value={newPayment.value}
                              onChange={(e) => setNewPayment({...newPayment, value: e.target.value})}
                              className="flex-1 px-4 py-2 bg-surface-container-lowest border-none rounded-xl text-xs font-bold"
                            />
                            <button
                              type="button"
                              onClick={handleAddPayment}
                              className="p-2 bg-primary text-on-primary rounded-xl hover:scale-105 transition-all"
                            >
                              <PlusCircle size={20} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                          {formData.paymentHistory.length === 0 ? (
                            <p className="text-[10px] text-on-surface-variant text-center py-4 italic">Nenhum recebimento registrado.</p>
                          ) : (
                            formData.paymentHistory.map((p: any) => (
                              <div key={p.id} className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/20">
                                <div className="flex items-center gap-3">
                                  <div className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded-md">
                                    {format(parseISO(p.date), 'dd/MM/yy')}
                                  </div>
                                  <div className="text-xs font-bold text-on-surface">{p.service}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-xs font-black text-success">
                                    R$ {p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePayment(p.id)}
                                    className="text-error hover:bg-error/10 p-1 rounded-md transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3 sticky bottom-0 bg-surface-container-lowest pb-2">
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
                      {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
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
              <h3 className="text-xl font-black text-on-surface mb-2">Excluir Cliente?</h3>
              <p className="text-on-surface-variant mb-8">
                Esta ação não pode ser desfeita. Todos os dados, histórico de renovações e recebimentos serão removidos permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteClient}
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
