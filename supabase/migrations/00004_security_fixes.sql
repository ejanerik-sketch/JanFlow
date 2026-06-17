-- =====================================================================
-- 00004_security_fixes.sql
-- Correções de segurança (auditoria 2026-05-28). Rodar por último.
-- Cobre: CRÍTICO #2 (escalonamento a admin) e ALTO #3 (vazamento de perfis).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Função auxiliar is_admin()
-- SECURITY DEFINER + search_path fixo: roda como owner e BYPASSA o RLS de
-- profiles, evitando recursão infinita ao ser usada dentro de policies da
-- própria tabela profiles.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- ALTO #3 — Vazamento de todos os perfis
-- Remove a policy "USING (true)" que expunha nome/e-mail/role de todos
-- (inclusive sem login). Cada usuário vê só o próprio perfil; admin vê todos.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Profiles are viewable by owner or admin."
  ON public.profiles FOR SELECT
  USING ( auth.uid() = id OR public.is_admin() );

-- Recria as policies de admin usando is_admin() (evita recursão de RLS) ----
DROP POLICY IF EXISTS "Admins can update any profile." ON public.profiles;
CREATE POLICY "Admins can update any profile."
  ON public.profiles FOR UPDATE
  USING ( public.is_admin() );

DROP POLICY IF EXISTS "Admins can delete any profile." ON public.profiles;
CREATE POLICY "Admins can delete any profile."
  ON public.profiles FOR DELETE
  USING ( public.is_admin() );

-- ---------------------------------------------------------------------
-- CRÍTICO #2 (b) — Escalonamento via UPDATE da própria coluna `role`
-- A policy "Users can update own profile" (USING auth.uid()=id, sem WITH CHECK
-- por coluna) deixava o usuário comum rodar profiles.update({role:'admin'}).
-- Postgres não permite comparar OLD/NEW dentro de uma policy, então usamos um
-- trigger BEFORE UPDATE que impede não-admin de alterar o próprio role.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    -- Usuário não-admin não pode mudar role: reverte silenciosamente.
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_role_changes ON public.profiles;
CREATE TRIGGER protect_role_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_role_escalation();

-- ---------------------------------------------------------------------
-- CRÍTICO #2 (a) — Trigger handle_new_user confiando no role do metadata
-- Como a anon key é pública e auth.signUp é aberto, qualquer um podia se
-- cadastrar enviando role:'admin' no metadata. O trigger passa a IGNORAR o
-- role do metadata: todo novo usuário entra como 'analista' (mínimo), exceto
-- o admin hardcoded. A definição do role correto é feita depois pela tela de
-- usuários (UPDATE por um admin autenticado, que passa pela policy de admin).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, "photoURL")
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    CASE WHEN new.email = 'ejanerik@gmail.com' THEN 'admin' ELSE 'analista' END,
    new.raw_user_meta_data->>'photoURL'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------
-- GRANTs de tabela para os roles do Supabase
-- As migrations 00001-00003 criaram as tabelas com RLS habilitado, mas sem
-- conceder os privilégios de DML — então usuários logados tomavam
-- "permission denied for table" (42501) ao ler/gravar qualquer dado. O RLS
-- continua sendo a camada que filtra as LINHAS; o GRANT apenas dá acesso à
-- tabela. anon (sem login) fica de fora de propósito.
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
