import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with the API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { to, transactionName, value, dueDate, type, customSubject, customHtml } = await request.json();

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY não está configurada nas variáveis de ambiente.' },
        { status: 500 }
      );
    }

    if (!to || !transactionName || !value || !dueDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes (to, transactionName, value, dueDate)' },
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

    // Default template
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

    // Apply custom template if provided
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

    const { data, error } = await resend.emails.send({
      from: 'JanFlow Notificações <onboarding@resend.dev>', // Resend default testing domain
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return NextResponse.json(
      { error: 'Falha ao enviar e-mail', details: error.message },
      { status: 500 }
    );
  }
}
