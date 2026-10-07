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
    const userName = data?.userName || 'Usuário'; // Nome do usuário logado

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

    // Busca o bloco de notas (memória da NeilAi) para este usuário e contexto
    const notesResult = await pba.collection('neilai_notes').getList(1, 10, {
      filter: `context = '${context}' && user_name = '${userName}'`,
      sort: '-created'
    });
    const activeNotes = notesResult.items.map(n => `- ${n.note}`).join('\n');

    // Não buscamos todas as transações por padrão mais para evitar payload gigante e lentidão.
    // Agora a IA buscará dinamicamente usando a ferramenta 'search_transactions' se precisar.

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

    // Usamos o Google Gemini 3.7 Flash
    const result = await generateText({
      model: google('gemini-3.7-flash'),
      system: `Você é a NeilAi, uma assistente financeira avançada e extremamente educada da plataforma JanFlow (Jan Agência).
Você foi projetada para ajudar o usuário com análises financeiras, gestão de gastos e conselhos inteligentes.

Regras de Ouro:
1. Responda em português do Brasil de forma clara e profissional, mas de forma muito humanizada.
2. O nome do usuário com quem você está falando é: "${userName}". Chame-o pelo nome.
3. O contexto financeiro atual que você está analisando é: "${context}". Mantenha os conselhos restritos a isso.
4. Se o usuário perguntar sobre gastos ou receitas, USE a ferramenta 'search_transactions' para buscar os dados ANTES de responder.
5. Se você tiver uma boa ideia, conselho ou plano financeiro para o usuário, você PODE usar a ferramenta 'save_note' para guardar essa memória para o futuro.
6. O usuário pode enviar FOTOS ou PDFs de faturas. LEIA os valores e LISTE os itens. PERGUNTE quais ele deseja lançar.
7. APENAS DEPOIS que o usuário confirmar, use a ferramenta 'create_transaction'.
8. Nunca responda com código ou JSON na mensagem final.
9. Hoje é dia ${new Date().toISOString().split('T')[0]}.

ANOTAÇÕES E MEMÓRIAS ANTERIORES QUE VOCÊ SALVOU PARA ${userName} (${context}):
${activeNotes || 'Nenhuma anotação salva ainda.'}`,
      messages: geminiMessages,
      tools: {
        save_note: tool({
          description: 'Salva uma anotação, ideia ou conselho no Bloco de Notas para você se lembrar no futuro.',
          parameters: z.object({
            anotacao: z.string().describe('O texto da anotação ou conselho que você quer salvar para este usuário.')
          })
        } as any),
        search_transactions: tool({
          description: 'Busca transações financeiras do banco de dados em um período específico.',
          parameters: z.object({
            startDate: z.string().describe('Data inicial YYYY-MM-DD'),
            endDate: z.string().describe('Data final YYYY-MM-DD')
          })
        } as any),
        create_transaction: tool({
          description: 'Lança uma nova despesa ou receita no sistema JanFlow.',
          parameters: z.object({
            tipo: z.string().describe("Deve ser 'receita' ou 'despesa'"),
            valor: z.number().describe('O valor em reais (numérico e positivo).'),
            categoria: z.string().describe('Categoria. Ex: Comidinhas, Serviço Avulso, Assinatura, Transporte, etc.'),
            descricao: z.string().describe('Descrição breve do lançamento.'),
            data: z.string().optional().describe('Data no formato YYYY-MM-DD.')
          })
        } as any)
      }
    });

    let finalResponseText = result.text;
    
    // Manual Tool Execution
    if (result.toolCalls && result.toolCalls.length > 0) {
      const createCall = result.toolCalls.find(tc => tc.toolName === 'create_transaction');
      const searchCall = result.toolCalls.find(tc => tc.toolName === 'search_transactions');
      const saveNoteCall = result.toolCalls.find(tc => tc.toolName === 'save_note');

      const adminPb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pb.janagencia.com.br');
      adminPb.autoCancellation(false);
      try { await adminPb.collection('_superusers').authWithPassword(email, password); } 
      catch(e) { await adminPb.admins.authWithPassword(email, password); }

      if (saveNoteCall) {
        const { anotacao } = (saveNoteCall as any).args || (saveNoteCall as any).input || {};
        try {
          await adminPb.collection('neilai_notes').create({
            note: anotacao,
            context: context,
            user_name: userName
          });
          finalResponseText = `Prontinho, ${userName}! Já anotei no meu caderno para não esquecer. Mais alguma coisa?`;
        } catch(e) {
          finalResponseText = "Tentei salvar a anotação, mas ocorreu um erro no meu caderno!";
        }
      } else if (createCall) {
        const { tipo, valor, categoria, descricao, data } = (createCall as any).args || (createCall as any).input || {};
        try {
          let dateStr = data;
          if (!dateStr || dateStr.trim() === '') dateStr = new Date().toISOString().split('T')[0];

          await adminPb.collection('transactions').create({
            type: tipo === 'receita' ? 'receita' : 'despesa',
            value: valor,
            category: categoria,
            description: descricao,
            date: dateStr + ' 12:00:00.000Z',
            context: context,
            is_recurring: false,
            status: 'concluído'
          });
          finalResponseText = `Prontinho, ${userName}! Acabei de registrar esse lançamento no seu fluxo de caixa.`;
        } catch (err: any) {
          finalResponseText = "Ops, tentei salvar no sistema mas deu um erro.";
        }
      } else if (searchCall) {
        const { startDate, endDate } = (searchCall as any).args || (searchCall as any).input || {};
        try {
          const recordsResult = await adminPb.collection('transactions').getList(1, 150, {
            filter: `date >= '${startDate} 00:00:00' && date <= '${endDate} 23:59:59' && context = '${context}'`,
            sort: '-date',
          });
          const formated = recordsResult.items.map(r => `[${r.date.split(' ')[0].substring(5)}] ${r.type==='receita'?'REC':'DESP'} R$${r.value} Cat:${r.category||'-'} Desc:${r.description||'-'}`).join('\n');
          
          const followUp = await generateText({
            model: google('gemini-3.7-flash'),
            system: `Você é a NeilAi. Responda ao usuário ${userName} baseado nestes dados encontrados (${startDate} a ${endDate}):\n${formated || 'Nenhum dado.'}\nLembre-se de ser simpática.`,
            messages: geminiMessages
          });
          finalResponseText = followUp.text;
        } catch (err: any) {
          finalResponseText = "Ops, tive um erro ao buscar no banco de dados.";
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
