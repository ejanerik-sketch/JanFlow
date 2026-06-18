-- =====================================================================
-- 00005_add_first_installment_date.sql
-- Reconciliação de schema (2026-06-18).
-- O app (app/transactions/page.tsx -> firstInstallmentDate) grava a data da
-- 1ª parcela em compras parceladas/cartão de crédito/financiamento. A coluna
-- existia no Supabase Cloud antigo (adicionada manualmente), mas nunca entrou
-- nas migrations 00001-00004. Sem ela, criar lançamento falha com
-- "PGRST204: Could not find the 'first_installment_date' column".
-- Auditoria das demais tabelas (clients, cards, budgets, categories, profiles)
-- confirmou que esta era a ÚNICA coluna divergente.
-- =====================================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS first_installment_date DATE;
