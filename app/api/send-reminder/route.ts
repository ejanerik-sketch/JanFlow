import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
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
    if (!rateLimit(clientKey(request, 'send-reminder'), 10, 60_000)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    const authedUser = await getAuthedUser(request);

    const { transactionName, value, dueDate, type, customSubject, customHtml } = await request.json();

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        { error: 'Credenciais de SMTP não estão configuradas nas variáveis de ambiente.' },
        { status: 500 }
      );
    }

    const to = authedUser.email;
    if (!to) {
      return NextResponse.json(
        { error: 'Usuário autenticado não possui e-mail válido.' },
        { status: 400 }
      );
    }

    if (!transactionName || !value || !dueDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes (transactionName, value, dueDate)' },
        { status: 400 }
      );
    }

    const isReceita = type === 'receita';
    const actionText = isReceita ? 'receber' : 'pagar';
    const titleText = isReceita ? 'Lembrete de Recebimento' : 'Lembrete de Pagamento';

    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);

    let subject = `[JanFlow] Lembrete: ${transactionName}`;
    let html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #1d8490;">${titleText}</h2>
        <p>Olá,</p>
        <p>Este é um lembrete automático do JanFlow sobre uma transação que está próxima do vencimento ou atrasada.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Descrição:</strong> ${transactionName}</p>
          <p style="margin: 0 0 10px 0;"><strong>Valor:</strong> ${formattedValue}</p>
          <p style="margin: 0 0 10px 0;"><strong>Vencimento:</strong> ${dueDate}</p>
          <p style="margin: 0;"><strong>Tipo:</strong> ${isReceita ? 'A Receber' : 'A Pagar'}</p>
        </div>
        
        <p>Por favor, lembre-se de ${actionText} este valor e atualizar o status no sistema.</p>
        <p>Abraços,<br>Equipe JanFlow</p>
      </div>
    `;

    if (customSubject) {
      subject = customSubject
        .replace('{{transactionName}}', transactionName)
        .replace('{{value}}', formattedValue)
        .replace('{{dueDate}}', dueDate)
        .replace('{{type}}', isReceita ? 'A Receber' : 'A Pagar');
    }

    if (customHtml) {
      html = customHtml
        .replace(/{{transactionName}}/g, transactionName)
        .replace(/{{value}}/g, formattedValue)
        .replace(/{{dueDate}}/g, dueDate)
        .replace(/{{type}}/g, isReceita ? 'A Receber' : 'A Pagar')
        .replace(/{{actionText}}/g, actionText)
        .replace(/{{titleText}}/g, titleText);
    }

    const info = await transporter.sendMail({
      from: `"JanFlow Notificações" <${process.env.SMTP_USER}>`,
      to: [to],
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
