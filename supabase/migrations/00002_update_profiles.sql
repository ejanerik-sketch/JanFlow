-- Execute este script no SQL Editor do Supabase para atualizar a tabela profiles

-- 1. Adicionar a coluna photoURL se ela não existir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "photoURL" TEXT;

-- 2. Remover a restrição (constraint) antiga da coluna role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 3. Adicionar a nova restrição permitindo os novos papéis
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'financeiro', 'analista', 'user'));

-- 4. Atualizar a função de criação de usuário para aceitar o papel do metadata (opcional, mas recomendado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, "photoURL")
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'name',
    COALESCE(new.raw_user_meta_data->>'role', CASE WHEN new.email = 'ejanerik@gmail.com' THEN 'admin' ELSE 'analista' END),
    new.raw_user_meta_data->>'photoURL'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
