# Guia de Implementação: Assistente Financeiro com Inteligência Artificial

Este documento serve como um manual completo para recriar o assistente financeiro de IA (com interface flutuante, comando de voz, leitura de notas fiscais e execução de ações no banco de dados) em qualquer outro sistema. 

Se você estiver em uma nova conversa com o Antigravity, basta pedir: **"Leia este arquivo de instruções e replique a implementação do Assistente de IA no meu projeto."**

---

## 1. Escolha do Motor de Inteligência Artificial

Para o motor de IA, utilizamos o **Vercel AI SDK**, que permite trocar de provedor facilmente. Abaixo estão as melhores alternativas atuais para este caso de uso:

*   **Google Gemini (Recomendado):** Excelente! Possui uma cota gratuita extremamente generosa, é muito rápido e é **o melhor modelo gratuito para leitura de imagens e PDFs** (vital para ler comprovantes e faturas).
*   **Groq:** É a API mais rápida do mundo atualmente. Totalmente gratuita, porém é focada **apenas em texto**. Se o assistente não precisar ler imagens de faturas, é a melhor opção para respostas instantâneas.
*   **OpenAI (ChatGPT):** Excelente em tudo e muito inteligente no uso de ferramentas, porém é um serviço **pago**.

### Como gerar a chave do Google Gemini (Recomendado)
1. Acesse o site do [Google AI Studio](https://aistudio.google.com/).
2. Faça login com sua conta do Google.
3. No painel à esquerda, clique em **"Get API key"**.
4. Clique em **"Create API key"**.
5. Copie a chave gerada.
6. No projeto, crie ou abra o arquivo `.env.local` e cole a chave:
   ```env
   GEMINI_API_KEY="sua_chave_gerada_aqui"
   ```

---

## 2. Dependências Necessárias

Para replicar o sistema, o assistente (ou desenvolvedor) deverá instalar os seguintes pacotes no terminal:

```bash
npm install ai @ai-sdk/google react-markdown react-speech-recognition regenerator-runtime lucide-react
npm install -D @types/react-speech-recognition
```
*(Nota: Se escolher usar o Groq ou a OpenAI no futuro, basta instalar `@ai-sdk/groq` ou `@ai-sdk/openai` respectivamente).*

---

## 3. O Backend: Rota da API (`app/api/assistant/route.ts`)

A lógica de servidor funciona recebendo o histórico do chat, os arquivos anexados (em Base64) e as informações do usuário atual (contexto). Ela define um "System Prompt" com regras estritas e disponibiliza ferramentas para o modelo executar ações reais (ex: lançar no banco).

**Estrutura base da Rota:**
```typescript
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { z } from 'zod';
import PocketBase from 'pocketbase'; // Ou seu banco de dados atual

export const maxDuration = 30; 

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages, data } = await req.json();
    const { context, transacoesAtuais } = data; // Informações que a IA precisa saber

    const result = await generateText({
      model: google('gemini-1.5-flash'), // Ou 2.0-flash / 3.7-flash
      system: `Você é um assistente financeiro avançado.
Regras:
1. O contexto do usuário é: "${context}".
2. Se o usuário enviar imagens de comprovantes, leia e pergunte se ele quer lançar os itens no sistema.
3. Use os dados de transações mais recentes fornecidos abaixo para responder a dúvidas.
DADOS FINANCEIROS REAIS:
${transacoesAtuais || 'Nenhuma transação encontrada.'}`,
      messages: messages,
      tools: {
        create_transaction: {
          description: 'Lança uma nova despesa ou receita no sistema.',
          parameters: z.object({
            tipo: z.string().describe("Deve ser 'receita' ou 'despesa'"),
            valor: z.number().describe('O valor em reais.'),
            categoria: z.string().describe('Categoria. Ex: Transporte, Alimentação.'),
            descricao: z.string().describe('Descrição do lançamento.'),
            data: z.string().optional()
          })
        }
      }
    });

    let finalResponseText = result.text;
    
    // Execução da Ferramenta de Banco de Dados
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls.find(tc => tc.toolName === 'create_transaction');
      if (toolCall) {
        const args = (toolCall as any).args;
        try {
          // LÓGICA DO BANCO DE DADOS AQUI (PocketBase, Supabase, Prisma, etc)
          // Exemplo: await database.create({...args});
          
          finalResponseText = "Prontinho! Acabei de registrar esse lançamento no seu fluxo de caixa.";
        } catch (err: any) {
          finalResponseText = "Ops, tentei salvar no sistema mas deu um erro.";
        }
      }
    }

    return new Response(JSON.stringify({ text: finalResponseText }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
```

---

## 4. O Frontend: Componente Flutuante de Chat

O Chat (`AssistantChat.tsx`) deve ser um modal expansível.
As principais features e lógicas que devem ser implementadas nele são:

### A. Reconhecimento de Voz (Microfone)
Deve usar o `react-speech-recognition` para transcrever a voz em texto.
**Ponto crítico:** Ao clicar em Enviar, deve-se abortar e desligar o microfone para evitar que ele fique escutando o ambiente no fundo.
```typescript
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const { transcript, listening, resetTranscript } = useSpeechRecognition();

// Abortar ao enviar
const handleSend = () => {
  if (listening) {
    SpeechRecognition.stopListening();
    SpeechRecognition.abortListening();
  }
  // ... resto do envio
}
```

### B. Upload de Arquivos (Faturas / PDFs)
A IA (principalmente o Gemini) aceita Base64 muito bem. Você deve transformar a imagem em Base64 através de um `FileReader` e armazenar no array de mensagens antes de enviar.
```typescript
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    setAttachment({ url: event.target?.result as string, name: file.name });
  };
  reader.readAsDataURL(file);
};
```

### C. Integração no Layout
A mensagem enviada à API deve ser formatada conforme a documentação do **Vercel AI SDK**. 
A requisição deverá passar as `messages` atuais + a mensagem do usuário (com o conteúdo extraído do arquivo no campo de attachment/imagem), além dos dados de contexto (`data: { context: ... }`).

Por fim, o componente deve usar `react-markdown` para renderizar negritos, listas e quebras de linha com perfeição, além de manter um visual moderno em Glassmorphism, similar ao UI/UX do iOS ou painéis contemporâneos.
