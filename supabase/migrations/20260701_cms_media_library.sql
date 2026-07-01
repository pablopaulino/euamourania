-- Eu Amo Urânia — biblioteca, originais temporários e limpeza segura de mídias.
-- Execute após 20260701_cms_media_upload.sql.
begin;

create table if not exists public.cms_midias(
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'cms-media',
  caminho text not null unique,
  url text not null unique,
  pasta text not null,
  nome_original text,
  mime_type text,
  tamanho bigint,
  largura integer,
  altura integer,
  variante text not null default 'otimizada'
    check(variante in('otimizada','original')),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

create index if not exists cms_midias_criado_em_idx
  on public.cms_midias(criado_em desc);
create index if not exists cms_midias_criado_por_idx
  on public.cms_midias(criado_por,criado_em desc);

-- Registra uploads feitos entre a primeira versão do recurso e esta biblioteca.
with urls(url) as(
  select imagem_url from public.noticias union
  select seo_imagem from public.noticias union
  select imagem_url from public.guia_comercial union
  select imagem_url from public.turismo union
  select imagem_url from public.eventos union
  select imagem_url from public.newsletters union
  select (m.resultado)[1]
    from public.noticias n
    cross join lateral regexp_matches(coalesce(n.conteudo_html,''),'(https://[^"'' <]+/storage/v1/object/public/cms-media/[^"'' <]+)','g') m(resultado) union
  select (m.resultado)[1]
    from public.turismo t
    cross join lateral regexp_matches(coalesce(t.conteudo_html,''),'(https://[^"'' <]+/storage/v1/object/public/cms-media/[^"'' <]+)','g') m(resultado) union
  select (m.resultado)[1]
    from public.newsletters n
    cross join lateral regexp_matches(coalesce(n.conteudo_html,''),'(https://[^"'' <]+/storage/v1/object/public/cms-media/[^"'' <]+)','g') m(resultado)
)
insert into public.cms_midias(bucket,caminho,url,pasta,nome_original,variante,criado_por)
select
  'cms-media',
  split_part(url,'/cms-media/',2),
  url,
  regexp_replace(split_part(url,'/cms-media/',2),'/[^/]+$',''),
  regexp_replace(split_part(url,'/cms-media/',2),'^.*/',''),
  'otimizada',
  null
from urls
where url like '%/storage/v1/object/public/cms-media/%'
  and nullif(split_part(url,'/cms-media/',2),'') is not null
on conflict(url) do nothing;

alter table public.cms_midias enable row level security;

drop policy if exists "cms_midias_select" on public.cms_midias;
create policy "cms_midias_select" on public.cms_midias
for select to authenticated
using(
  criado_por=(select auth.uid())
  or public.is_super_admin()
);

drop policy if exists "cms_midias_insert" on public.cms_midias;
create policy "cms_midias_insert" on public.cms_midias
for insert to authenticated
with check(
  criado_por=(select auth.uid())
  and bucket='cms-media'
  and public.pode_gerenciar_midia_cms(caminho,'criar')
);

drop policy if exists "cms_midias_delete" on public.cms_midias;
create policy "cms_midias_delete" on public.cms_midias
for delete to authenticated
using(public.is_super_admin());

create or replace function public.midia_cms_em_uso(p_url text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    exists(select 1 from public.noticias where imagem_url=p_url or seo_imagem=p_url or position(p_url in coalesce(conteudo_html,''))>0)
    or exists(select 1 from public.guia_comercial where imagem_url=p_url)
    or exists(select 1 from public.turismo where imagem_url=p_url or position(p_url in coalesce(conteudo_html,''))>0)
    or exists(select 1 from public.eventos where imagem_url=p_url)
    or exists(select 1 from public.newsletters where imagem_url=p_url or position(p_url in coalesce(conteudo_html,''))>0)
    or exists(select 1 from public.campanhas_publicitarias where imagem_url=p_url or logo_empresa_url=p_url)
    or exists(select 1 from public.configuracoes_site where valor=p_url or position(p_url in coalesce(valor,''))>0);
$$;

create or replace function public.listar_midias_cms()
returns table(
  id uuid,
  caminho text,
  url text,
  pasta text,
  nome_original text,
  mime_type text,
  tamanho bigint,
  largura integer,
  altura integer,
  variante text,
  criado_em timestamptz,
  em_uso boolean,
  elegivel_limpeza boolean
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Sem permissão para gerenciar a biblioteca de mídia.' using errcode='42501';
  end if;
  return query
  select m.id,m.caminho,m.url,m.pasta,m.nome_original,m.mime_type,m.tamanho,
    m.largura,m.altura,m.variante,m.criado_em,
    public.midia_cms_em_uso(m.url) as em_uso,
    (m.criado_em<now()-interval '7 days' and not public.midia_cms_em_uso(m.url)) as elegivel_limpeza
  from public.cms_midias m
  order by m.criado_em desc;
end;
$$;

revoke all on function public.midia_cms_em_uso(text) from public;
revoke all on function public.listar_midias_cms() from public;
grant execute on function public.listar_midias_cms() to authenticated;

commit;
