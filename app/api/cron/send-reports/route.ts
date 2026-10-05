import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getPocketBaseAdmin } from '@/lib/pocketbaseAdmin';

export async function GET(req: Request) {
  try {
    const today = new Date();
    const currentDay = today.getDate().toString().padStart(2, '0');

    // Em um sistema multi-usuário complexo, buscaríamos do BD.
    // Como é sistema financeiro de casa/agência, usamos o padrão definido pelo usuário.
    const targetDay = '03'; // Dia de envio configurado
    const emails = ['ejanerik@gmail.com', 'neilalima@hotmail.com'];

    // Se hoje não for o dia de envio e não estivermos forçando o envio via param "?force=true", aborta.
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === 'true';

    if (currentDay !== targetDay && !force) {
      return NextResponse.json({ message: `Hoje é dia ${currentDay}. O relatório está programado para o dia ${targetDay}.` });
    }

    // --- Buscar dados do PocketBase ---
    const pb = await getPocketBaseAdmin();

    // Calcula as datas do mês anterior
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const monthStr = (lastMonthDate.getMonth() + 1).toString().padStart(2, '0');
    const yearStr = lastMonthDate.getFullYear().toString();
    const monthName = lastMonthDate.toLocaleString('pt-BR', { month: 'long' });

    const startStr = `${yearStr}-${monthStr}-01 00:00:00`;
    const lastDay = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate();
    const endStr = `${yearStr}-${monthStr}-${lastDay} 23:59:59`;

    const records = await pb.collection('transactions').getFullList({
      filter: `date >= '${startStr}' && date <= '${endStr}'`,
    });

    // --- Preparar o E-mail ---
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: {
        user: 'financeiro@janagencia.com.br',
        pass: 'Paraiso186*',
      },
    });

    const contexts = [
      { id: 'empresa', name: 'Empresa', color: '#1d8490' },
      { id: 'pessoal', name: 'Pessoal', color: '#f97316' }
    ];

    let summaryData = { empresa: 0, pessoal: 0 };

    for (const ctx of contexts) {
      const ctxRecords = records.filter(r => r.context === ctx.id);
      
      let despesas = 0;
      let receitas = 0;
      const categories: Record<string, number> = {};
      
      ctxRecords.forEach(r => {
        if (r.type === 'despesa') {
          despesas += r.value;
          const cat = r.category || 'Outros';
          categories[cat] = (categories[cat] || 0) + r.value;
        }
        if (r.type === 'receita') receitas += r.value;
      });

      const saldo = receitas - despesas;
      summaryData[ctx.id as keyof typeof summaryData] = saldo;
      const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

      const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
      let categoriesHtml = '';
      
      if (sortedCategories.length > 0) {
        categoriesHtml = `
          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid ${ctx.color}; padding-bottom: 10px; display: inline-block;">Top Gastos por Categoria</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                ${sortedCategories.map(([cat, val]) => `
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #4b5563; font-size: 14px; font-weight: 500;">${cat}</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #ef4444; font-size: 14px; font-weight: 800; text-align: right;">${formatBRL(val)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f3f4f6;">
        <!-- Header -->
        <div style="background-color: #1a1a1a; padding: 30px 20px; text-align: center; border-top: 5px solid ${ctx.color};">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
            Jan<span style="color: ${ctx.color};">Flow</span>
          </h1>
          <p style="color: #a3a3a3; margin: 10px 0 0 0; font-size: 14px;">Fechamento ${ctx.name}</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
          <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 20px;">Relatório - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${yearStr}</h2>
          
          <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
            Olá! O seu relatório da conta <strong>${ctx.name}</strong> está disponível. Confira o resumo:
          </p>

          <!-- Cards -->
          <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
            <div style="margin-bottom: 15px;">
              <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Receitas Totais</p>
              <p style="margin: 5px 0 0 0; color: #10b981; font-size: 24px; font-weight: 800;">${formatBRL(receitas)}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Despesas Totais</p>
              <p style="margin: 5px 0 0 0; color: #ef4444; font-size: 24px; font-weight: 800;">${formatBRL(despesas)}</p>
            </div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 15px;">
              <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Balanço do Mês</p>
              <p style="margin: 5px 0 0 0; color: ${saldo >= 0 ? '#10b981' : '#ef4444'}; font-size: 24px; font-weight: 800;">${formatBRL(saldo)}</p>
            </div>
          </div>

          <!-- Categorias -->
          ${categoriesHtml}

          <!-- NeilAi Tip -->
          <div style="background-color: #fff7ed; border-left: 4px solid ${ctx.color}; padding: 15px; border-radius: 4px;">
            <h4 style="color: #c2410c; margin: 0 0 5px 0; font-size: 14px; display: flex; items-center: center;">
              💡 Dica da NeilAi
            </h4>
            <p style="color: #9a3412; font-size: 13px; margin: 0; line-height: 1.5;">
              "Não se esqueça de verificar se todos os lançamentos de ${ctx.name.toLowerCase()} do mês de ${monthName} foram cadastrados no sistema antes de fechar as contas!"
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Enviado automaticamente por JanFlow<br>
            Para parar de receber, altere suas preferências no painel.
          </p>
        </div>
      </div>
      `;

      for (const email of emails) {
        await transporter.sendMail({
          from: '"JanFlow IA" <financeiro@janagencia.com.br>',
          to: email.trim(),
          subject: `📊 Relatório ${ctx.name}: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`,
          html: htmlContent,
        });
      }
    }

    return NextResponse.json({ message: 'Relatórios duplos enviados com sucesso!', dados: summaryData });

  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
