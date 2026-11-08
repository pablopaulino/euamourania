-- Cada lançamento pode manter até dois comprovantes da coleta da categoria.
alter table public.melhores_instagram_votos
  add column if not exists comprovante_url_2 text;

-- A biblioteca de mídia não deve excluir comprovantes ainda vinculados a votos.
create or replace function public.melhores_comprovante_em_uso(p_caminho text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1 from public.melhores_instagram_votos v
    where (v.comprovante_url like '%/storage/v1/object/public/cms-media/%'
           and split_part(v.comprovante_url, '/storage/v1/object/public/cms-media/', 2) = p_caminho)
       or (v.comprovante_url_2 like '%/storage/v1/object/public/cms-media/%'
           and split_part(v.comprovante_url_2, '/storage/v1/object/public/cms-media/', 2) = p_caminho)
  );
$$;
revoke all on function public.melhores_comprovante_em_uso(text) from public, anon;
grant execute on function public.melhores_comprovante_em_uso(text) to authenticated;

drop policy if exists "melhores_comprovantes_em_uso_protegidos" on storage.objects;
create policy "melhores_comprovantes_em_uso_protegidos" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'cms-media' or not public.melhores_comprovante_em_uso(name));
