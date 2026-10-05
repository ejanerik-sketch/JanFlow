# GUIA ARQUITETURAL DE RESILIÊNCIA E PREVENÇÃO DE INCIDENTES (VPS HOSTINGER / COOLIFY)

Este documento registra as implementações de resiliência aplicadas neste repositório (`JANFLOW`) e fornece as diretrizes operacionais obrigatórias para toda a infraestrutura e demais aplicações (Laravel / Coolify / Supabase) que compartilham o servidor VPS.

---

## 🛡️ 1. IMPLEMENTAÇÕES DE CÓDIGO NO JANFLOW (NEXT.JS)

### ✅ 1. Resiliência de Autenticação e Prevenção de Loops (Supabase Auth)
- **Arquivo:** `lib/supabase.ts`
- **Mecanismo:** Interceptor customizado de `fetch` (`resilientFetch`) acoplado ao `createClient`.
- **Regras Ativas:**
  - Máximo de **3 tentativas** com **backoff exponencial** (1s, 2s, 4s com jitter aleatório).
  - **Circuit Breaker:** Se o gateway Kong ou o serviço de Auth responder com **Erro 502 ou 503**, qualquer nova chamada ou retry em loop é imediatamente interrompido.
  - **Limpeza Segura:** A sessão local é resetada via `clearLocalAuthSession()` sem sobrecarregar o servidor com novas requisições.
  - Redirecionamento limpo para `/login?error=service_unavailable` através de evento de emergência monitorado em `context/AppContext.tsx`.

### ✅ 2. Eliminação de Polling HTTP e Adoção de WebSockets (Realtime)
- **Arquivo:** `components/Reminders.tsx`
- **Mecanismo:** Remoção do `setInterval` de consulta HTTP periódica ao banco de dados.
- **Regras Ativas:**
  - Inscrição em tempo real no canal WebSocket do Supabase (`supabase.channel().on('postgres_changes', ...)`).
  - Atualização instantânea e reativa da UI sem realizar tráfego HTTP desnecessário.
  - Cancelamento e limpeza estrita do canal WebSocket no desmontar do componente.

### ✅ 3. Eliminação de Consultas N+1
- **Arquivos:** `app/transactions/page.tsx`, `app/budgets/page.tsx`
- **Mecanismo:** Substituição de laços assíncronos (`for ... await`, `Promise.all(arr.map(...))`) por métodos em lote:
  - Criação/edição em massa: `localDB.saveMany('transactions', arr)`
  - Exclusão em lote: `localDB.deleteMany('transactions', ids)`
  - Importação CSV em bloco consolidado
  - Inserção de categorias padrão em lote único

### ✅ 4. Cache Inteligente com Validade Mínima de 5 Minutos
- **Arquivo:** `lib/localDB.ts`
- **Mecanismo:** Cache local com timestamp de validação de 5 minutos (`CACHE_TTL_MS = 300000`).
- **Regras Ativas:**
  - Coleções de baixa rotatividade (`categories`, `cards`, `budgets`, `profiles`) utilizam o cache instantaneamente sem disparar novas chamadas ao backend quando os dados têm menos de 5 minutos.
  - **Invalidação Atômica:** Qualquer mutação (`save`, `saveMany`, `delete`, `deleteMany`) invalida automaticamente as chaves do cache local da coleção correspondente.
  - Fallback automático para o cache em caso de indisponibilidade de rede ou resposta 502/503 da API.

### ✅ 5. Endpoint Ultraleve de Healthcheck
- **Arquivo:** `app/api/health/route.ts`
- **Endpoint:** `GET /api/health`
- **Comportamento:** Retorna `{ status: 'ok', uptimeSeconds: ... }` com HTTP 200 de forma instantânea, sem consultar o banco de dados e sem instanciar subprocessos do Node.

---

## ⚙️ 2. CONFIGURAÇÕES OBRIGATÓRIAS NO COOLIFY / DOCKER

Para erradicar a **Causa Raiz #2 (Healthchecks Agressivos consumindo 72% de CPU)**:

1. **NUNCA configurar Healthcheck executando `node -e`:**
   - Evite scripts do tipo: `node -e "fetch('http://localhost:8080/health')"` a cada 1 ou 2 segundos. Instanciar a V8 do Node.js consome de 50MB a 100MB e picos de CPU por execução.
2. **Utilize Healthcheck HTTP nativo do Coolify/Docker com intervalo seguro:**
   - **Path:** `/api/health`
   - **Intervalo (`Interval`):** Mínimo de `30s` (recomendado: `45s` a `60s`).
   - **Timeout:** `5s`.
   - **Retries:** `3`.
   - **Start Period:** `30s`.
   - Comando curl caso use shell check: `curl -f http://127.0.0.1:3000/api/health || exit 1`.

---

## 🐘 3. DIRETRIZES OBRIGATÓRIAS PARA OS SISTEMAS LARAVEL (MC-FINANCE / OUTROS)

Para erradicar a **Causa Raiz #3 (Processos zumbis e sobreposição de filas)** nos projetos Laravel que rodam na mesma VPS:

### 1. Scheduler (`routes/console.php` ou `app/Console/Kernel.php`)
Toda e qualquer tarefa agendada DEVE ter a trava de sobreposição ativada:
```php
// Exemplo obrigatório:
Schedule::command('finance:process-daily')
    ->dailyAt('03:00')
    ->withoutOverlapping(10) // 10 minutos de trava
    ->runInBackground();
```

### 2. Jobs e Filas (`app/Jobs/*.php`)
Todas as classes de Job DEVEM definir limites estritos de tentativas e tempo de execução:
```php
namespace App\Jobs;

class ProcessTransactionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Limite máximo de 3 tentativas para evitar loop infinito
     */
    public $tries = 3;

    /**
     * Timeout máximo de 60 segundos por execução
     */
    public $timeout = 60;
    
    // ...
}
```

### 3. Horizon / Queue Workers (`config/horizon.php` ou Supervisor)
- Limitar o número máximo de processos simultâneos por fila (ex: `maxProcesses => 2` ou `3` para uma VPS de 2 vCPU).
- Ativar `memory => 128` (encerra o worker caso exceda 128MB de RAM para evitar vazamentos de memória e swap thrashing).
