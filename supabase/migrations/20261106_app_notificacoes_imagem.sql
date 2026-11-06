-- Imagem opcional de notificações. Não modifica envios existentes.
alter table public.app_notificacoes
  add column if not exists imagem_url text;

comment on column public.app_notificacoes.imagem_url is
  'URL pública da imagem opcional enviada com a notificação push.';

-- Evita remover uma imagem de uma notificação ainda registrada.
create or replace function public.push_imagem_em_uso(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.app_notificacoes n
    where n.imagem_url is not null
      and split_part(n.imagem_url, '/storage/v1/object/public/cms-media/', 2) = p_caminho
  );
$$;
revoke all on function public.push_imagem_em_uso(text) from public, anon;
grant execute on function public.push_imagem_em_uso(text) to authenticated;

drop policy if exists "push_imagens_em_uso_protegidas" on storage.objects;
create policy "push_imagens_em_uso_protegidas" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'cms-media' or not public.push_imagem_em_uso(name));
