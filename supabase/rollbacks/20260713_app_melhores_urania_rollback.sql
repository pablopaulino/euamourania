-- Rollback da camada de exibicao do Melhores no app Viva Urania.
-- Use somente se a migracao 20260713_app_melhores_urania.sql precisar ser revertida.

begin;

drop policy if exists "app_melhores_vencedores_admin_delete" on public.app_melhores_vencedores;
drop policy if exists "app_melhores_vencedores_admin_update" on public.app_melhores_vencedores;
drop policy if exists "app_melhores_vencedores_admin_insert" on public.app_melhores_vencedores;
drop policy if exists "app_melhores_vencedores_admin_select" on public.app_melhores_vencedores;
drop policy if exists "app_melhores_vencedores_publicos" on public.app_melhores_vencedores;
drop policy if exists "app_melhores_campanhas_admin_delete" on public.app_melhores_campanhas;
drop policy if exists "app_melhores_campanhas_admin_update" on public.app_melhores_campanhas;
drop policy if exists "app_melhores_campanhas_admin_insert" on public.app_melhores_campanhas;
drop policy if exists "app_melhores_campanhas_admin_select" on public.app_melhores_campanhas;
drop policy if exists "app_melhores_campanhas_publicas" on public.app_melhores_campanhas;

drop trigger if exists app_melhores_vencedores_auditoria on public.app_melhores_vencedores;
drop trigger if exists app_melhores_campanhas_auditoria on public.app_melhores_campanhas;
drop trigger if exists app_melhores_campanhas_validar on public.app_melhores_campanhas;
drop trigger if exists app_melhores_campanhas_autoria on public.app_melhores_campanhas;
drop trigger if exists app_melhores_vencedores_atualizado on public.app_melhores_vencedores;
drop trigger if exists app_melhores_campanhas_atualizado on public.app_melhores_campanhas;

revoke all on function public.app_melhores_importar_vencedores(uuid) from public;
drop function if exists public.app_melhores_importar_vencedores(uuid);
drop function if exists public.app_melhores_validar_campanha();
drop function if exists public.app_melhores_marcar_autoria();

drop table if exists public.app_melhores_vencedores;
drop table if exists public.app_melhores_campanhas;

commit;
