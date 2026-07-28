alter table public.turismo
  add column if not exists destaque_home boolean not null default false,
  add column if not exists destaque_home_inicio timestamptz,
  add column if not exists destaque_home_fim timestamptz;

alter table public.eventos
  add column if not exists destaque_home boolean not null default false,
  add column if not exists destaque_home_inicio timestamptz,
  add column if not exists destaque_home_fim timestamptz;

alter table public.guia_comercial
  add column if not exists destaque_home boolean not null default false,
  add column if not exists destaque_home_inicio timestamptz,
  add column if not exists destaque_home_fim timestamptz;

alter table public.noticias
  add column if not exists destaque_home boolean not null default false,
  add column if not exists destaque_home_inicio timestamptz,
  add column if not exists destaque_home_fim timestamptz;

comment on column public.turismo.destaque_home is
  'Quando ativo, este ponto turistico pode ocupar a Sugestao do Momento do app Viva Urania.';
comment on column public.eventos.destaque_home is
  'Quando ativo, este evento pode ocupar a Sugestao do Momento do app Viva Urania.';
comment on column public.guia_comercial.destaque_home is
  'Quando ativo, esta empresa pode ocupar a Sugestao do Momento do app Viva Urania.';
comment on column public.noticias.destaque_home is
  'Quando ativo, esta noticia pode ocupar a Sugestao do Momento do app Viva Urania.';

create index if not exists idx_turismo_app_home_destaque
  on public.turismo (destaque_home, destaque_home_inicio, destaque_home_fim, atualizado_em)
  where destaque_home = true;

create index if not exists idx_eventos_app_home_destaque
  on public.eventos (destaque_home, destaque_home_inicio, destaque_home_fim, data_inicio)
  where destaque_home = true;

create index if not exists idx_guia_app_home_destaque
  on public.guia_comercial (destaque_home, destaque_home_inicio, destaque_home_fim, atualizado_em)
  where destaque_home = true;

create index if not exists idx_noticias_app_home_destaque
  on public.noticias (destaque_home, destaque_home_inicio, destaque_home_fim, publicado_em)
  where destaque_home = true;

create or replace function public.app_garantir_destaque_home_unico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.destaque_home, false) is true then
    update public.turismo
      set destaque_home = false
      where destaque_home = true
        and (tg_table_name <> 'turismo' or id <> new.id);

    update public.eventos
      set destaque_home = false
      where destaque_home = true
        and (tg_table_name <> 'eventos' or id <> new.id);

    update public.guia_comercial
      set destaque_home = false
      where destaque_home = true
        and (tg_table_name <> 'guia_comercial' or id <> new.id);

    update public.noticias
      set destaque_home = false
      where destaque_home = true
        and (tg_table_name <> 'noticias' or id <> new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists turismo_destaque_home_unico on public.turismo;
create trigger turismo_destaque_home_unico
before insert or update of destaque_home on public.turismo
for each row execute function public.app_garantir_destaque_home_unico();

drop trigger if exists eventos_destaque_home_unico on public.eventos;
create trigger eventos_destaque_home_unico
before insert or update of destaque_home on public.eventos
for each row execute function public.app_garantir_destaque_home_unico();

drop trigger if exists guia_destaque_home_unico on public.guia_comercial;
create trigger guia_destaque_home_unico
before insert or update of destaque_home on public.guia_comercial
for each row execute function public.app_garantir_destaque_home_unico();

drop trigger if exists noticias_destaque_home_unico on public.noticias;
create trigger noticias_destaque_home_unico
before insert or update of destaque_home on public.noticias
for each row execute function public.app_garantir_destaque_home_unico();

create or replace function public.app_home_sugestao_momento()
returns table (
  tipo text,
  id uuid,
  slug text,
  titulo text,
  categoria_nome text,
  descricao text,
  imagem_url text,
  destaque boolean,
  curadoria_euamourania boolean,
  data_inicio timestamptz,
  data_fim timestamptz,
  endereco text,
  whatsapp text,
  prioridade integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidatos as (
    -- Prioridade 1: escolha editorial manual no painel.
    select
      'turismo'::text as tipo,
      t.id,
      t.slug,
      t.nome as titulo,
      coalesce(t.categoria_nome, 'Turismo') as categoria_nome,
      t.descricao,
      t.imagem_url,
      coalesce(t.destaque, false) as destaque,
      coalesce(t.curadoria_euamourania, false) as curadoria_euamourania,
      null::timestamptz as data_inicio,
      null::timestamptz as data_fim,
      t.endereco,
      t.whatsapp,
      1000 as prioridade,
      coalesce(t.destaque_home_inicio, t.atualizado_em, now()) as ordenacao
    from public.turismo t
    where t.status = 'publicado'
      and t.destaque_home = true
      and (t.destaque_home_inicio is null or t.destaque_home_inicio <= now())
      and (t.destaque_home_fim is null or t.destaque_home_fim >= now())

    union all

    select
      'evento'::text as tipo,
      e.id,
      e.slug,
      e.titulo,
      coalesce(e.categoria_nome, 'Evento') as categoria_nome,
      e.descricao,
      e.imagem_url,
      coalesce(e.destaque, false) as destaque,
      false as curadoria_euamourania,
      e.data_inicio,
      e.data_fim,
      coalesce(e.local, e.endereco) as endereco,
      e.whatsapp,
      1000 as prioridade,
      coalesce(e.destaque_home_inicio, e.data_inicio, e.atualizado_em, now()) as ordenacao
    from public.eventos e
    where e.status = 'publicado'
      and e.destaque_home = true
      and (e.destaque_home_inicio is null or e.destaque_home_inicio <= now())
      and (e.destaque_home_fim is null or e.destaque_home_fim >= now())

    union all

    select
      'empresa'::text as tipo,
      g.id,
      g.slug,
      g.nome as titulo,
      coalesce(g.categoria_nome, 'Guia Comercial') as categoria_nome,
      g.descricao,
      g.imagem_url,
      coalesce(g.recomendado, false) as destaque,
      false as curadoria_euamourania,
      null::timestamptz as data_inicio,
      null::timestamptz as data_fim,
      g.endereco,
      g.whatsapp,
      1000 as prioridade,
      coalesce(g.destaque_home_inicio, g.atualizado_em, now()) as ordenacao
    from public.guia_comercial g
    where g.status = 'publicado'
      and g.destaque_home = true
      and (g.destaque_home_inicio is null or g.destaque_home_inicio <= now())
      and (g.destaque_home_fim is null or g.destaque_home_fim >= now())

    union all

    select
      'noticia'::text as tipo,
      n.id,
      n.slug,
      n.titulo,
      coalesce(n.categoria_nome, 'Notícias') as categoria_nome,
      coalesce(n.resumo, n.subtitulo) as descricao,
      coalesce(n.seo_imagem, n.imagem_url) as imagem_url,
      coalesce(n.destaque, false) as destaque,
      false as curadoria_euamourania,
      n.publicado_em as data_inicio,
      null::timestamptz as data_fim,
      null::text as endereco,
      null::text as whatsapp,
      1000 as prioridade,
      coalesce(n.destaque_home_inicio, n.publicado_em, n.atualizado_em, now()) as ordenacao
    from public.noticias n
    where n.status = 'publicado'
      and (n.publicado_em is null or n.publicado_em <= now())
      and n.destaque_home = true
      and (n.destaque_home_inicio is null or n.destaque_home_inicio <= now())
      and (n.destaque_home_fim is null or n.destaque_home_fim >= now())

    union all

    -- Prioridade 2: evento próximo.
    select
      'evento'::text,
      e.id,
      e.slug,
      e.titulo,
      coalesce(e.categoria_nome, 'Evento'),
      e.descricao,
      e.imagem_url,
      coalesce(e.destaque, false),
      false,
      e.data_inicio,
      e.data_fim,
      coalesce(e.local, e.endereco),
      e.whatsapp,
      700,
      coalesce(e.data_inicio, e.atualizado_em, now())
    from public.eventos e
    where e.status = 'publicado'
      and coalesce(e.data_fim, e.data_inicio) >= now()
      and e.data_inicio <= now() + interval '14 days'

    union all

    -- Prioridade 3: ponto turistico em destaque.
    select
      'turismo'::text,
      t.id,
      t.slug,
      t.nome,
      coalesce(t.categoria_nome, 'Turismo'),
      t.descricao,
      t.imagem_url,
      coalesce(t.destaque, false),
      coalesce(t.curadoria_euamourania, false),
      null::timestamptz,
      null::timestamptz,
      t.endereco,
      t.whatsapp,
      500,
      coalesce(t.atualizado_em, now())
    from public.turismo t
    where t.status = 'publicado'
      and t.destaque = true

    union all

    -- Prioridade 2: fallback editorial fixo. Se nada for escolhido no painel,
    -- o Borboletario Municipal continua sendo a capa padrao do app.
    select
      'turismo'::text,
      t.id,
      t.slug,
      t.nome,
      coalesce(t.categoria_nome, 'Turismo'),
      t.descricao,
      t.imagem_url,
      coalesce(t.destaque, false),
      coalesce(t.curadoria_euamourania, false),
      null::timestamptz,
      null::timestamptz,
      t.endereco,
      t.whatsapp,
      800,
      coalesce(t.atualizado_em, now())
    from public.turismo t
    where t.status = 'publicado'
      and (
        lower(t.slug) in ('borboletario-municipal', 'borboletario-municipal-de-urania')
        or lower(t.nome) like '%borboletario%'
      )

    union all

    -- Prioridade 5: fallback geral, ainda privilegiando turismo com imagem.
    select
      'turismo'::text,
      t.id,
      t.slug,
      t.nome,
      coalesce(t.categoria_nome, 'Turismo'),
      t.descricao,
      t.imagem_url,
      coalesce(t.destaque, false),
      coalesce(t.curadoria_euamourania, false),
      null::timestamptz,
      null::timestamptz,
      t.endereco,
      t.whatsapp,
      100 + case when t.imagem_url is not null then 20 else 0 end,
      coalesce(t.atualizado_em, now())
    from public.turismo t
    where t.status = 'publicado'

    union all

    select
      'empresa'::text,
      g.id,
      g.slug,
      g.nome,
      coalesce(g.categoria_nome, 'Guia Comercial'),
      g.descricao,
      g.imagem_url,
      coalesce(g.recomendado, false),
      false,
      null::timestamptz,
      null::timestamptz,
      g.endereco,
      g.whatsapp,
      80 + case when g.imagem_url is not null then 10 else 0 end,
      coalesce(g.atualizado_em, now())
    from public.guia_comercial g
    where g.status = 'publicado'
  )
  select
    c.tipo,
    c.id,
    c.slug,
    c.titulo,
    c.categoria_nome,
    c.descricao,
    c.imagem_url,
    c.destaque,
    c.curadoria_euamourania,
    c.data_inicio,
    c.data_fim,
    c.endereco,
    c.whatsapp,
    c.prioridade
  from candidatos c
  order by c.prioridade desc, c.ordenacao asc nulls last, c.titulo asc
  limit 1;
$$;

grant execute on function public.app_home_sugestao_momento() to anon, authenticated;
