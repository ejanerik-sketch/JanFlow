import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import PocketBase from 'pocketbase';

// Opcional: Se você quiser forçar a duração máxima de 30s na Vercel
export const maxDuration = 30; 

// Inicializa o PocketBase
const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.janagencia.com.br';
const pb = new PocketBase(POCKETBASE_URL);

// Instancia o provedor Google com a chave salva no env.local
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const context = data?.context || 'pessoal'; // Recebe o contexto (empresa ou pessoal)

    // --- Busta os dados no DB antes de chamar a IA (Context Injection) ---
    const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.janagencia.com.br';
    const pba = new PocketBase(pbUrl);
    pba.autoCancellation(false);
    const email = process.env.POCKETBASE_ADMIN_EMAIL || 'ejanerik@gmail.com';
    const password = process.env.POCKETBASE_ADMIN_PASSWORD || 'JanFlow@2026!';
    
    try {
      await pba.collection('_superusers').authWithPassword(email, password);
    } catch(e) {
      await pba.admins.authWithPassword(email, password);
    }

    // Pega as transações dos últimos 2 meses para dar contexto
    const dateLimit = new Date();
    dateLimit.setMonth(dateLimit.getMonth() - 2);
    const start = `${dateLimit.getFullYear()}-${(dateLimit.getMonth()+1).toString().padStart(2, '0')}-01 00:00:00`;

    const records = await pba.collection('transactions').getFullList({
      filter: `date >= '${start}' && context = '${context}'`,
      sort: '-date',
    });

    // Formata as transações cruas para a IA ter visão total de todos os dias e recebimentos
    // Formato reduzido para economizar banda/tokens
    const transacoesFormatadas = records.map(r => {
      const dataFormatada = r.date.split(' ')[0].substring(5); // MM-DD
      const tipo = r.type === 'receita' ? 'REC' : 'DESP';
      return `[${dataFormatada}] ${tipo} R$${r.value} Categoria:${r.category || '-'} Desc:${(r.description || r.entity_name || '-').substring(0,20)}`;
    }).join('\n');

    // Como o limite do Google Pago é de 2 MILHÕES de tokens por minuto, podemos relaxar o limite de histórico
    const historicoRecente = messages.slice(-10);

    // Mapeia o histórico e injeta o anexo se houver
    const geminiMessages = historicoRecente.map((m: any) => {
      if (m.attachment) {
        // Parse da Data URL (ex: data:image/jpeg;base64,/9j/...)
        const matches = m.attachment.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];

          if (mimeType.startsWith('image/')) {
            return {
              role: m.role,
              content: [
                { type: 'text', text: m.content },
                { type: 'image', image: m.attachment }
              ]
            };
          } else if (mimeType === 'application/pdf') {
            return {
              role: m.role,
              content: [
                { type: 'text', text: m.content },
                { type: 'file', data: base64Data, mimeType: mimeType }
              ]
            };
          }
        }
      }
      return { role: m.role, content: m.content };
    });

    // Aqui usamos o Google Gemini 3.7 Flash na conta paga (Tier 1)
    const result = await generateText({
      model: google('gemini-3.7-flash'),
      system: `Você é a NeilAi, uma assistente financeira avançada e extremamente educada da plataforma JanFlow (Jan Agência).
Você foi projetada para ajudar o usuário com análises financeiras, gestão de gastos e conselhos inteligentes.

Regras de Ouro:
1. Responda em português do Brasil de forma clara e profissional. Use formatação em Markdown (negritos, listas). Você é inteligente e entende erros de digitação.
2. O contexto financeiro atual do usuário é: "${context}".
3. Abaixo estão TODAS as transações reais dos últimos meses do usuário. Use ESTES dados para responder de forma precisa.
4. O usuário pode enviar FOTOS ou PDFs de faturas/recibos em anexo. Quando isso acontecer, LEIA os valores, compare com o banco de dados abaixo e LISTE os itens que parecem novos. PERGUNTE ao usuário quais ele deseja lançar (ex: "[1] Uber - R$20", "[2] Restaurante - R$50"). NÃO USE a ferramenta create_transaction antes de perguntar.
5. APENAS DEPOIS que o usuário confirmar ("lança o 1 e o 2" ou "pode lançar tudo"), você usará a ferramenta 'create_transaction' para registrar os itens escolhidos.
6. Se o usuário falar de um lançamento avulso solto ("gastei 50 com comida hoje"), você também pode pedir confirmação, ou se ele for imperativo ("lança 50 de comida"), lance direto.
7. Se o usuário perguntar de um mês que não está na lista abaixo, diga gentilmente que no momento você só tem os dados dos últimos meses carregados.
8. Nunca responda com código ou JSON na mensagem final.

DADOS FINANCEIROS REAIS (${context}):
${transacoesFormatadas || 'Nenhuma transação encontrada.'}`,
      messages: geminiMessages,
      tools: {
        create_transaction: tool({
          description: 'Lança uma nova despesa ou receita no sistema JanFlow.',
          parameters: z.object({
            tipo: z.string().describe("Deve ser 'receita' ou 'despesa'"),
            valor: z.number().describe('O valor em reais (numérico e positivo).'),
            categoria: z.string().describe('Categoria. Ex: Comidinhas, Serviço Avulso, Assinatura, Transporte, etc.'),
            descricao: z.string().describe('Descrição breve do lançamento.'),
            data: z.string().optional().describe('Data no formato YYYY-MM-DD. Se o usuário não falar a data, deixe vazio que o sistema usará hoje.')
          })
        } as any)
      }
    });

    let finalResponseText = result.text;
    
    // Execute tool manually since execute is not supported in this version of the AI SDK
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls.find(tc => tc.toolName === 'create_transaction');
      if (toolCall) {
        const { tipo, valor, categoria, descricao, data } = (toolCall as any).args;
        try {
          const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.janagencia.com.br';
          const adminPb = new PocketBase(pbUrl);
          adminPb.autoCancellation(false);
          const email = process.env.POCKETBASE_ADMIN_EMAIL || 'ejanerik@gmail.com';
          const password = process.env.POCKETBASE_ADMIN_PASSWORD || 'JanFlow@2026!';
          
          try {
            await adminPb.collection('_superusers').authWithPassword(email, password);
          } catch(e) {
            await adminPb.admins.authWithPassword(email, password);
          }
          
          let dateStr = data;
          if (!dateStr || dateStr.trim() === '') {
            dateStr = new Date().toISOString().split('T')[0];
          }

          const record = await adminPb.collection('transactions').create({
            type: tipo === 'receita' ? 'receita' : 'despesa',
            value: valor,
            category: categoria,
            description: descricao,
            date: dateStr + ' 12:00:00.000Z',
            entity_name: '',
            context: context,
            is_recurring: false,
            status: 'concluído'
          });
          
          finalResponseText = "Prontinho! Acabei de registrar esse lançamento no seu fluxo de caixa. Mais alguma coisa?";
        } catch (err: any) {
          finalResponseText = "Ops, tentei salvar no sistema mas deu um erro. Pode verificar os dados e tentar novamente?";
        }
      }
    }
    return new Response(JSON.stringify({ text: finalResponseText }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("NeilAi Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
