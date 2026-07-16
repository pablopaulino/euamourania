-- Corrige alerta do Supabase Advisor:
-- a view de apuração prévia deve respeitar as permissões/RLS do usuário que consulta,
-- e não as permissões do criador da view.
alter view if exists public.melhores_apuracao_previa set (security_invoker = true);
