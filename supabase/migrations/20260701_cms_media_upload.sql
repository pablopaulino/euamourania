-- Eu Amo Urânia — biblioteca de imagens do CMS.
-- Execute uma vez no SQL Editor do Supabase antes de publicar o frontend.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'cms-media','cms-media',true,8388608,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.pode_gerenciar_midia_cms(
  p_nome text,
  p_acao text default 'editar'
) returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select case split_part(coalesce(p_nome,''),'/',1)
    when 'noticias' then
      public.tem_permissao_admin('noticias',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('noticias','editar'))
    when 'guia' then
      public.tem_permissao_admin('guia_comercial',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('guia_comercial','editar'))
    when 'turismo' then
      public.tem_permissao_admin('turismo',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('turismo','editar'))
    when 'eventos' then
      public.tem_permissao_admin('eventos',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('eventos','editar'))
    when 'comunicacao' then
      public.tem_permissao_admin('comunicacao',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('comunicacao','editar'))
    else false
  end;
$$;

revoke all on function public.pode_gerenciar_midia_cms(text,text) from public;
grant execute on function public.pode_gerenciar_midia_cms(text,text) to authenticated;

drop policy if exists "cms_media_publica" on storage.objects;
create policy "cms_media_publica" on storage.objects
for select to public using(bucket_id='cms-media');

drop policy if exists "cms_media_insere" on storage.objects;
create policy "cms_media_insere" on storage.objects
for insert to authenticated
with check(bucket_id='cms-media' and public.pode_gerenciar_midia_cms(name,'criar'));

drop policy if exists "cms_media_atualiza" on storage.objects;
create policy "cms_media_atualiza" on storage.objects
for update to authenticated
using(bucket_id='cms-media' and public.pode_gerenciar_midia_cms(name,'editar'))
with check(bucket_id='cms-media' and public.pode_gerenciar_midia_cms(name,'editar'));

drop policy if exists "cms_media_exclui" on storage.objects;
create policy "cms_media_exclui" on storage.objects
for delete to authenticated
using(bucket_id='cms-media' and public.pode_gerenciar_midia_cms(name,'excluir'));

commit;
