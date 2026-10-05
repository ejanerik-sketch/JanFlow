export async function register() {
  // Garantimos que o cron rode apenas no ambiente Node.js (não no Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron');
    
    // Agenda para rodar todo dia às 08:00 da manhã
    cron.default.schedule('0 8 * * *', async () => {
      try {
        console.log('[CRON] Iniciando verificação de envio de relatórios...');
        // Chama a API interna do próprio Next.js
        // (O arquivo /api/cron/send-reports checará se hoje é o dia correto)
        const res = await fetch('http://localhost:3000/api/cron/send-reports');
        const data = await res.json();
        console.log('[CRON] Resultado:', data);
      } catch (error) {
        console.error('[CRON] Erro ao disparar relatórios:', error);
      }
    });

    console.log('[CRON] Serviço de Relatórios Automatizados iniciado com sucesso.');
  }
}

