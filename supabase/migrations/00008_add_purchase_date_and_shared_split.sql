-- =====================================================================
-- 00008_add_purchase_date_and_shared_split.sql
-- =====================================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS shared_split TEXT;
