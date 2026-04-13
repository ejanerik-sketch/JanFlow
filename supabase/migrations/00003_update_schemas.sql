-- Update cards table
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS bank TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.cards ALTER COLUMN limit_amount DROP NOT NULL;
ALTER TABLE public.cards ALTER COLUMN due_day DROP NOT NULL;

-- Update budgets table
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS recurrence TEXT;

-- Update clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_email TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS responsible_cpf TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS responsible_email TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contract_date TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS renewal_period TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS renewal_history JSONB DEFAULT '[]'::jsonb;
