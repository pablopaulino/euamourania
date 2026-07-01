-- Eu Amo Urânia — seleção compartilhada de imagens já enviadas.
-- Execute após 20260701_cms_media_library.sql.
begin;

drop policy if exists "cms_midias_select" on public.cms_midias;
create policy "cms_midias_select" on public.cms_midias
for select to authenticated
using(public.is_admin());

commit;
