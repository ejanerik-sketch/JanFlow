import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import PocketBase from 'pocketbase';
import { POCKETBASE_URL } from '@/lib/pocketbase';
import { getAuthedUser, AuthError } from '@/lib/apiAuth';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(request: Request) {
  try {
    if (!rateLimit(clientKey(request, 'send-report'), 10, 60_000)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    const authedUser = await getAuthedUser(request);

    const { emails, period, options } = await request.json();

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        { error: 'Credenciais de SMTP não estão configuradas nas variáveis de ambiente.' },
        { status: 500 }
      );
    }

    if (!emails || typeof emails !== 'string') {
      return NextResponse.json(
        { error: 'E-mails inválidos' },
        { status: 400 }
      );
    }

    const emailList = emails.split(',').map(e => e.trim()).filter(e => e);

    if (emailList.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum e-mail fornecido' },
        { status: 400 }
      );
    }

    
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.janagencia.com.br');
    if (token) pb.authStore.save(token, null);

    let transactions: any[] = [];
    try {
      transactions = await pb.collection('transactions').getFullList();
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    let periodLabel = period;

    if (period === 'mes_anterior') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = 'Mês Anterior';
    } else if (period === 'mes_atual') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = 'Mês Atual';
    } else if (period === '7_dias') {
      startDate.setDate(now.getDate() - 7);
      periodLabel = 'Últimos 7 dias';
    } else if (period === '30_dias') {
      startDate.setDate(now.getDate() - 30);
      periodLabel = 'Últimos 30 dias';
    } else {
      startDate = new Date(0); // all time fallback
    }

    const filtered = transactions.filter(t => {
      const d = new Date(t.date || t.dueDate || t.created);
      return d >= startDate && d <= endDate;
    });

    let geral = { r: 0, d: 0, s: 0 };
    let emp = { r: 0, d: 0, s: 0 };
    let pes = { r: 0, d: 0, s: 0 };
    const categoriesEmp: Record<string, number> = {};
    const categoriesPes: Record<string, number> = {};

    filtered.forEach(t => {
      const val = Number(t.value) || 0;
      if (t.type === 'receita') {
        geral.r += val;
        if (t.context === 'pessoal') pes.r += val;
        if (t.context === 'empresa') emp.r += val;
      } else {
        geral.d += val;
        if (t.context === 'pessoal') pes.d += val;
        if (t.context === 'empresa') emp.d += val;
        
        const cat = t.category || 'Outros';
        if (t.context === 'empresa') {
          categoriesEmp[cat] = (categoriesEmp[cat] || 0) + val;
        } else {
          categoriesPes[cat] = (categoriesPes[cat] || 0) + val;
        }
      }
    });

    geral.s = geral.r - geral.d;
    emp.s = emp.r - emp.d;
    pes.s = pes.r - pes.d;

    const formatCurrency = (val: number) => 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Design Tokens (NeilAi / JanAgência)
    const T = {
      orange: '#ff6330',
      teal: '#1d8490',
      dark: '#1a1a1a',
      gray: '#f3f4f6',
      success: '#10b981',
      danger: '#ef4444',
      bg: '#f8fafc',
      card: '#ffffff'
    };

    let htmlContent = '';
    
    if (options.resume) {
      htmlContent += `
        <div style="background-color: ${T.card}; margin-bottom: 24px; padding: 24px; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; color: ${T.dark}; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">Visão Geral</h3>
          <div style="margin-bottom: 12px; display: flex; justify-content: space-between; border-bottom: 1px solid ${T.gray}; padding-bottom: 8px;">
            <span style="color: #6b7280; font-weight: bold;">Receitas</span>
            <span style="color: ${T.success}; font-weight: bold;">${formatCurrency(geral.r)}</span>
          </div>
          <div style="margin-bottom: 12px; display: flex; justify-content: space-between; border-bottom: 1px solid ${T.gray}; padding-bottom: 8px;">
            <span style="color: #6b7280; font-weight: bold;">Despesas</span>
            <span style="color: ${T.danger}; font-weight: bold;">${formatCurrency(geral.d)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 16px;">
            <span style="color: ${T.dark}; font-weight: 900; font-size: 16px;">SALDO LÍQUIDO</span>
            <span style="color: ${geral.s >= 0 ? T.success : T.danger}; font-weight: 900; font-size: 18px;">${formatCurrency(geral.s)}</span>
          </div>
        </div>
      `;
    }

    if (options.business) {
      htmlContent += `
        <div style="background-color: ${T.card}; margin-bottom: 24px; padding: 24px; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb; border-left: 6px solid ${T.teal};">
          <h3 style="margin-top: 0; color: ${T.teal}; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">🏢 Balanço Empresarial</h3>
          <div style="margin-bottom: 8px;">
            <span style="color: #6b7280; font-size: 14px;">Entradas:</span> <span style="font-weight: bold; color: ${T.success};">${formatCurrency(emp.r)}</span>
          </div>
          <div style="margin-bottom: 16px;">
            <span style="color: #6b7280; font-size: 14px;">Saídas:</span> <span style="font-weight: bold; color: ${T.danger};">${formatCurrency(emp.d)}</span>
          </div>
          <div style="background-color: ${T.gray}; padding: 12px; border-radius: 12px; display: inline-block;">
            <span style="color: ${T.dark}; font-size: 14px; font-weight: bold;">Saldo Empresarial: </span>
            <span style="color: ${emp.s >= 0 ? T.success : T.danger}; font-weight: 900;">${formatCurrency(emp.s)}</span>
          </div>
        </div>
      `;
    }

    if (options.personal) {
      htmlContent += `
        <div style="background-color: ${T.card}; margin-bottom: 24px; padding: 24px; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb; border-left: 6px solid ${T.orange};">
          <h3 style="margin-top: 0; color: ${T.orange}; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">👤 Balanço Pessoal</h3>
          <div style="margin-bottom: 8px;">
            <span style="color: #6b7280; font-size: 14px;">Entradas:</span> <span style="font-weight: bold; color: ${T.success};">${formatCurrency(pes.r)}</span>
          </div>
          <div style="margin-bottom: 16px;">
            <span style="color: #6b7280; font-size: 14px;">Saídas:</span> <span style="font-weight: bold; color: ${T.danger};">${formatCurrency(pes.d)}</span>
          </div>
          <div style="background-color: ${T.gray}; padding: 12px; border-radius: 12px; display: inline-block;">
            <span style="color: ${T.dark}; font-size: 14px; font-weight: bold;">Saldo Pessoal: </span>
            <span style="color: ${pes.s >= 0 ? T.success : T.danger}; font-weight: 900;">${formatCurrency(pes.s)}</span>
          </div>
        </div>
      `;
    }

    if (options.category && (Object.keys(categoriesEmp).length > 0 || Object.keys(categoriesPes).length > 0)) {
      htmlContent += `
        <div style="background-color: ${T.card}; margin-bottom: 24px; padding: 24px; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; color: ${T.dark}; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">📊 Despesas por Categoria</h3>
      `;
      
      if (Object.keys(categoriesEmp).length > 0) {
        const sortedEmp = Object.entries(categoriesEmp).sort((a, b) => b[1] - a[1]);
        htmlContent += `
          <h4 style="margin: 0 0 12px 0; color: ${T.teal}; font-size: 14px; text-transform: uppercase;">🏢 Categorias Empresariais</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            ${sortedEmp.map(([cat, val]) => `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid ${T.gray}; color: #4b5563; font-size: 14px;">${cat}</td>
                <td style="padding: 10px 0; border-bottom: 1px solid ${T.gray}; text-align: right; font-weight: bold; color: ${T.danger}; font-size: 14px;">${formatCurrency(val)}</td>
              </tr>
            `).join('')}
          </table>
        `;
      }
      
      if (Object.keys(categoriesPes).length > 0) {
        const sortedPes = Object.entries(categoriesPes).sort((a, b) => b[1] - a[1]);
        htmlContent += `
          <h4 style="margin: 0 0 12px 0; color: ${T.orange}; font-size: 14px; text-transform: uppercase;">👤 Categorias Pessoais</h4>
          <table style="width: 100%; border-collapse: collapse;">
            ${sortedPes.map(([cat, val]) => `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid ${T.gray}; color: #4b5563; font-size: 14px;">${cat}</td>
                <td style="padding: 10px 0; border-bottom: 1px solid ${T.gray}; text-align: right; font-weight: bold; color: ${T.danger}; font-size: 14px;">${formatCurrency(val)}</td>
              </tr>
            `).join('')}
          </table>
        `;
      }
      
      htmlContent += `</div>`;
    }

    if (options.alerts) {
      const insight = (geral.s) > 0 
        ? "Você teve um mês positivo! Considere investir o saldo excedente ou separar um valor como reserva estratégica."
        : "As despesas superaram as receitas no período. Revise seus maiores gastos nas categorias acima para encontrar oportunidades de redução.";
      htmlContent += `
        <div style="background-color: ${T.dark}; margin-bottom: 24px; padding: 24px; border-radius: 24px; color: #ffffff;">
          <h3 style="margin-top: 0; color: ${T.orange}; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">💡 Dicas da NeilAi</h3>
          <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #d1d5db;">${insight}</p>
        </div>
      `;
    }

    const html = `
      <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: ${T.bg}; padding: 32px 20px; border-radius: 32px;">
        
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: ${T.dark}; font-weight: 900; font-size: 28px; margin: 0;">JanFlow</h1>
          <p style="color: ${T.orange}; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 2px; margin-top: 8px;">Relatório Financeiro</p>
        </div>

        <div style="margin-bottom: 24px; text-align: center;">
          <p style="color: #4b5563; font-size: 16px; margin: 0;">Resumo detalhado referente ao período:</p>
          <p style="color: ${T.dark}; font-size: 20px; font-weight: 900; margin: 4px 0 0 0; text-transform: capitalize;">${periodLabel.replace('_', ' ')}</p>
        </div>
        
        ${htmlContent || '<div style="text-align: center; padding: 40px; color: #6b7280;">Nenhum dado selecionado para este relatório.</div>'}
        
        <div style="margin-top: 40px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 24px;">
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">Para ver os detalhes completos das transações, acesse o painel online.</p>
          <a href="https://app.janagencia.com.br" style="display: inline-block; background-color: ${T.orange}; color: #ffffff; text-decoration: none; font-weight: bold; padding: 14px 28px; border-radius: 100px; font-size: 14px;">Acessar JanFlow</a>
        </div>
      </div>
    `;


    const subject = `[JanFlow] Relatório Financeiro - ${periodLabel}`;
    const info = await transporter.sendMail({
      from: `"JanFlow Relatórios" <${process.env.SMTP_USER}>`,
      to: emailList,
      subject,
      html,
    });

    return NextResponse.json({ success: true, data: info.messageId });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to send email:', error);
    return NextResponse.json(
      { error: 'Falha ao enviar e-mail', details: error.message },
      { status: 500 }
    );
  }
}
