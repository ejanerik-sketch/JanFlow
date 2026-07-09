-- =====================================================================
-- 00006_performance_indexes.sql
-- Índices para acelerar as consultas do app (item "sistema lento").
-- As telas filtram sempre por user_id + context e, nas transações, por
-- intervalo de datas do mês selecionado. Sem índice, cada consulta faz
-- full scan da tabela conforme os dados crescem.
-- =====================================================================

-- Transações: filtro por usuário + contexto + data (consulta do mês).
CREATE INDEX IF NOT EXISTS idx_transactions_user_context_date
  ON public.transactions (user_id, context, date);

-- Agrupamento de parcelas por groupId.
CREATE INDEX IF NOT EXISTS idx_transactions_group_id
  ON public.transactions (group_id);

-- Categorias, cartões, orçamentos: filtro por usuário + contexto.
CREATE INDEX IF NOT EXISTS idx_categories_user_context
  ON public.categories (user_id, context);

CREATE INDEX IF NOT EXISTS idx_cards_user_context
  ON public.cards (user_id, context);

CREATE INDEX IF NOT EXISTS idx_budgets_user_context
  ON public.budgets (user_id, context);

-- Clientes: filtro por usuário.
CREATE INDEX IF NOT EXISTS idx_clients_user
  ON public.clients (user_id);
