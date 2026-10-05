const fs = require('fs');

const path = 'app/api/send-report/route.ts';
let code = fs.readFileSync(path, 'utf8');

const importPB = `import PocketBase from 'pocketbase';
import { POCKETBASE_URL } from '@/lib/pocketbase';`;

if (!code.includes('import PocketBase')) {
  code = code.replace("import { getAuthedUser", importPB + "\nimport { getAuthedUser");
}

const logic = `
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.janagencia.com.br');
    if (token) pb.authStore.save(token, null);

    let transactions = [];
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

    let totalReceitas = 0;
    let totalDespesas = 0;
    let balancoPessoal = 0;
    let balancoEmpresarial = 0;
    const categories: Record<string, number> = {};

    filtered.forEach(t => {
      const val = Number(t.value) || 0;
      if (t.type === 'receita') {
        totalReceitas += val;
        if (t.context === 'pessoal') balancoPessoal += val;
        if (t.context === 'empresa') balancoEmpresarial += val;
      } else {
        totalDespesas += val;
        if (t.context === 'pessoal') balancoPessoal -= val;
        if (t.context === 'empresa') balancoEmpresarial -= val;
        
        const cat = t.category || 'Outros';
        categories[cat] = (categories[cat] || 0) + val;
      }
    });

    const formatCurrency = (val: number) => 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    let htmlContent = '';
    
    if (options.resume) {
      htmlContent += \`
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #111827;">Resumo Geral</h3>
          <p style="margin: 5px 0;"><strong>Receitas:</strong> <span style="color: #10b981;">\${formatCurrency(totalReceitas)}</span></p>
          <p style="margin: 5px 0;"><strong>Despesas:</strong> <span style="color: #ef4444;">\${formatCurrency(totalDespesas)}</span></p>
          <p style="margin: 5px 0; font-size: 1.1em;"><strong>Saldo Líquido:</strong> 
            <span style="color: \${(totalReceitas - totalDespesas) >= 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">
              \${formatCurrency(totalReceitas - totalDespesas)}
            </span>
          </p>
        </div>
      \`;
    }

    if (options.category && Object.keys(categories).length > 0) {
      const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
      htmlContent += \`
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #111827;">Despesas por Categoria</h3>
          <ul style="padding-left: 20px; margin: 0;">
            \${sortedCats.map(([cat, val]) => \`<li style="margin-bottom: 5px;"><strong>\${cat}:</strong> \${formatCurrency(val)}</li>\`).join('')}
          </ul>
        </div>
      \`;
    }

    if (options.business) {
      htmlContent += \`
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #111827;">Balanço Empresarial</h3>
          <p style="margin: 0;">Saldo no período: 
            <span style="color: \${balancoEmpresarial >= 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">
              \${formatCurrency(balancoEmpresarial)}
            </span>
          </p>
        </div>
      \`;
    }

    if (options.personal) {
      htmlContent += \`
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #111827;">Balanço Pessoal</h3>
          <p style="margin: 0;">Saldo no período: 
            <span style="color: \${balancoPessoal >= 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">
              \${formatCurrency(balancoPessoal)}
            </span>
          </p>
        </div>
      \`;
    }

    if (options.alerts) {
      const insight = (totalReceitas - totalDespesas) > 0 
        ? "Você teve um mês positivo! Considere investir o saldo excedente."
        : "As despesas superaram as receitas. Revise seus maiores gastos nas categorias.";
      htmlContent += \`
        <div style="margin-bottom: 20px; padding: 15px; background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #92400e;">💡 Alertas da NeilAi</h3>
          <p style="margin: 0; color: #b45309;">\${insight}</p>
        </div>
      \`;
    }

    const html = \`
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #f97316;">Relatório Financeiro</h2>
        <p>Olá,</p>
        <p>Aqui está o resumo financeiro detalhado do JanFlow referente ao período: <strong>\${periodLabel}</strong>.</p>
        
        \${htmlContent || '<p>Nenhum dado selecionado para este relatório.</p>'}
        
        <p style="margin-top: 30px;">Para ver os detalhes completos, acesse o painel do JanFlow.</p>
        <p>Abraços,<br>Equipe JanFlow</p>
      </div>
    \`;
`;

code = code.replace(/const subject = `\[JanFlow\] Relatório Financeiro - \$\{period\}`;[\s\S]*?const info = await transporter\.sendMail/m, logic + "\n\n    const subject = `[JanFlow] Relatório Financeiro - ${periodLabel}`;\n    const info = await transporter.sendMail");

fs.writeFileSync(path, code);
