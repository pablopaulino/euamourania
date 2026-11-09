-- Exibe somente os links dos comprovantes de categorias com resultado oficial
-- e números públicos. Não expõe votos individuais, autores ou observações.
create or replace function public.melhores_comprovantes_publicos(p_edicao uuid)
returns table(categoria_id uuid, url text)
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select distinct v.categoria_id, provas.url
  from public.melhores_instagram_votos v
  join public.melhores_edicoes e on e.id = v.edicao_id
  cross join lateral (values (v.comprovante_url), (v.comprovante_url_2)) provas(url)
  where v.edicao_id = p_edicao
    and e.ano = 2026
    and e.mostrar_votos_publicamente is true
    and (e.status = 'resultado_publicado' or (e.status = 'arquivada' and e.resultado_publicado_em is not null))
    and exists (select 1 from public.melhores_resultados r
      where r.edicao_id = v.edicao_id and r.categoria_id = v.categoria_id and r.publicado is true)
    and provas.url ~* '^https?://[^/[:space:]]+'
  order by v.categoria_id, provas.url;
$$;
revoke all on function public.melhores_comprovantes_publicos(uuid) from public;
grant execute on function public.melhores_comprovantes_publicos(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
