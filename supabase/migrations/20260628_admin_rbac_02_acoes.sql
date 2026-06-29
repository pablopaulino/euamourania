-- Complemento obrigatório de 20260628_admin_rbac.sql.
-- Separa CRUD para impedir que permissão de leitura/edição conceda exclusão.
begin;

drop policy if exists "rbac_campanhas_manage" on public.campanhas_publicitarias;
create policy "rbac_campanhas_select" on public.campanhas_publicitarias for select to authenticated using(public.tem_permissao_admin('publicidade','ler'));
create policy "rbac_campanhas_insert" on public.campanhas_publicitarias for insert to authenticated with check(public.tem_permissao_admin('publicidade','criar'));
create policy "rbac_campanhas_update" on public.campanhas_publicitarias for update to authenticated using(public.tem_permissao_admin('publicidade','editar'))with check(public.tem_permissao_admin('publicidade','editar'));
create policy "rbac_campanhas_delete" on public.campanhas_publicitarias for delete to authenticated using(public.tem_permissao_admin('publicidade','excluir'));

drop policy if exists "rbac_posicoes_manage" on public.campanha_posicoes;
create policy "rbac_posicoes_select" on public.campanha_posicoes for select to authenticated using(public.tem_permissao_admin('publicidade','ler'));
create policy "rbac_posicoes_insert" on public.campanha_posicoes for insert to authenticated with check(public.tem_permissao_admin('publicidade','criar')or public.tem_permissao_admin('publicidade','editar'));
create policy "rbac_posicoes_update" on public.campanha_posicoes for update to authenticated using(public.tem_permissao_admin('publicidade','editar'))with check(public.tem_permissao_admin('publicidade','editar'));
-- O editor de campanha substitui posições; excluir posição é parte da edição, não exclusão da campanha.
create policy "rbac_posicoes_delete" on public.campanha_posicoes for delete to authenticated using(public.tem_permissao_admin('publicidade','editar'));

drop policy if exists "rbac_anunciantes_manage" on public.anunciantes;
create policy "rbac_anunciantes_select" on public.anunciantes for select to authenticated using(public.tem_permissao_admin('publicidade','ler'));
create policy "rbac_anunciantes_insert" on public.anunciantes for insert to authenticated with check(public.tem_permissao_admin('publicidade','criar'));
create policy "rbac_anunciantes_update" on public.anunciantes for update to authenticated using(public.tem_permissao_admin('publicidade','editar'))with check(public.tem_permissao_admin('publicidade','editar'));
create policy "rbac_anunciantes_delete" on public.anunciantes for delete to authenticated using(public.tem_permissao_admin('publicidade','excluir'));

drop policy if exists "rbac_banners_manage" on public.banners;
create policy "rbac_banners_select" on public.banners for select to authenticated using(public.tem_permissao_admin('publicidade','ler'));
create policy "rbac_banners_insert" on public.banners for insert to authenticated with check(public.tem_permissao_admin('publicidade','criar'));
create policy "rbac_banners_update" on public.banners for update to authenticated using(public.tem_permissao_admin('publicidade','editar'))with check(public.tem_permissao_admin('publicidade','editar'));
create policy "rbac_banners_delete" on public.banners for delete to authenticated using(public.tem_permissao_admin('publicidade','excluir'));

drop policy if exists "rbac_envios_write" on public.newsletter_envios;
create policy "rbac_envios_insert" on public.newsletter_envios for insert to authenticated with check(public.tem_permissao_admin('comunicacao','enviar'));
create policy "rbac_envios_update" on public.newsletter_envios for update to authenticated using(public.tem_permissao_admin('comunicacao','enviar'))with check(public.tem_permissao_admin('comunicacao','enviar'));
create policy "rbac_envios_delete" on public.newsletter_envios for delete to authenticated using(public.funcao_admin_atual() in('super_admin','administrador'));

commit;
