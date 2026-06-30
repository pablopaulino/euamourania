-- Eu Amo Urânia — fluxo editorial e central avançada de audiência
-- Execute no SQL Editor do Supabase antes de publicar o frontend desta branch.
begin;

-- ---------------------------------------------------------------------------
-- Fluxo editorial: o status público continua independente da aprovação.
-- ---------------------------------------------------------------------------
alter table public.noticias
  add column if not exists status_editorial text not null default 'rascunho',
  add column if not exists enviado_revisao_em timestamptz,
  add column if not exists revisado_em timestamptz,
  add column if not exists revisado_por uuid references auth.users(id) on delete set null;

alter table public.noticias drop constraint if exists noticias_status_editorial_check;
alter table public.noticias add constraint noticias_status_editorial_check
  check(status_editorial in('rascunho','em_revisao','ajustes_solicitados','aprovado'));

update public.noticias
set status_editorial=case when status='publicado' then 'aprovado' else 'rascunho' end
where status_editorial is null
   or(status='publicado' and status_editorial='rascunho');

alter table public.noticias drop constraint if exists noticias_publicacao_aprovada_check;
alter table public.noticias add constraint noticias_publicacao_aprovada_check
  check(status<>'publicado' or status_editorial='aprovado');

create index if not exists noticias_status_editorial_idx
  on public.noticias(status_editorial,enviado_revisao_em desc);

create table if not exists public.solicitacoes_aprovacao(
  id uuid primary key default gen_random_uuid(),
  noticia_id uuid not null references public.noticias(id) on delete cascade,
  status text not null default 'pendente'
    check(status in('pendente','ajustes_solicitados','aprovado','cancelado')),
  comentario text,
  enviado_por uuid not null references auth.users(id) on delete restrict,
  revisado_por uuid references auth.users(id) on delete set null,
  enviado_em timestamptz not null default now(),
  revisado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists solicitacao_aprovacao_pendente_unica
  on public.solicitacoes_aprovacao(noticia_id) where status='pendente';
create index if not exists solicitacoes_aprovacao_fila_idx
  on public.solicitacoes_aprovacao(status,enviado_em desc);

drop trigger if exists solicitacoes_aprovacao_atualizado on public.solicitacoes_aprovacao;
create trigger solicitacoes_aprovacao_atualizado before update on public.solicitacoes_aprovacao
for each row execute function public.set_atualizado_em();

alter table public.solicitacoes_aprovacao enable row level security;
drop policy if exists "editorial_aprovacoes_select" on public.solicitacoes_aprovacao;
create policy "editorial_aprovacoes_select" on public.solicitacoes_aprovacao
for select to authenticated using(
  public.tem_permissao_admin('noticias','publicar')
  or enviado_por=(select auth.uid())
);

-- O fluxo de escrita passa exclusivamente pelas RPCs abaixo.
drop policy if exists "editorial_aprovacoes_insert" on public.solicitacoes_aprovacao;
drop policy if exists "editorial_aprovacoes_update" on public.solicitacoes_aprovacao;
drop policy if exists "editorial_aprovacoes_delete" on public.solicitacoes_aprovacao;

-- Permite registrar ações editoriais na trilha existente sem guardar cópias do texto.
alter table public.cms_atividades drop constraint if exists cms_atividades_acao_check;
alter table public.cms_atividades add constraint cms_atividades_acao_check
check(acao in(
  'criado','atualizado','excluido','enviado_revisao',
  'ajustes_solicitados','aprovado','publicado'
));

create or replace function public.enviar_noticia_revisao(p_noticia uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_noticia public.noticias%rowtype;
  v_solicitacao uuid;
begin
  select * into v_noticia from public.noticias where id=p_noticia for update;
  if not found then raise exception 'Notícia não encontrada.' using errcode='P0002'; end if;
  if not public.tem_permissao_admin('noticias','editar') then
    raise exception 'Sem permissão para enviar esta notícia.' using errcode='42501';
  end if;
  if public.funcao_admin_atual()='redator' and v_noticia.criado_por is distinct from (select auth.uid()) then
    raise exception 'O redator só pode enviar notícias próprias.' using errcode='42501';
  end if;
  if v_noticia.status<>'rascunho' then
    raise exception 'Somente rascunhos podem ser enviados para aprovação.' using errcode='22023';
  end if;
  if v_noticia.status_editorial not in('rascunho','ajustes_solicitados') then
    raise exception 'Esta notícia já está em revisão ou aprovada.' using errcode='22023';
  end if;
  if nullif(trim(v_noticia.titulo),'') is null
     or nullif(trim(v_noticia.slug),'') is null
     or nullif(trim(coalesce(v_noticia.conteudo_html,'')),'') is null then
    raise exception 'Preencha título, slug e conteúdo antes de enviar.' using errcode='22023';
  end if;

  update public.solicitacoes_aprovacao
  set status='cancelado',atualizado_em=now()
  where noticia_id=p_noticia and status='pendente';

  insert into public.solicitacoes_aprovacao(noticia_id,enviado_por)
  values(p_noticia,(select auth.uid())) returning id into v_solicitacao;

  update public.noticias
  set status_editorial='em_revisao',enviado_revisao_em=now(),
      revisado_em=null,revisado_por=null
  where id=p_noticia;

  insert into public.cms_atividades(tabela,registro_id,acao,titulo,usuario_id,dados)
  values('noticias',p_noticia::text,'enviado_revisao',v_noticia.titulo,(select auth.uid()),
    jsonb_build_object('solicitacao_id',v_solicitacao));
  return v_solicitacao;
end;
$$;

create or replace function public.revisar_noticia(
  p_noticia uuid,
  p_decisao text,
  p_comentario text default null,
  p_publicar boolean default false,
  p_publicado_em timestamptz default null
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_noticia public.noticias%rowtype;
  v_solicitacao public.solicitacoes_aprovacao%rowtype;
  v_acao text;
begin
  if not public.tem_permissao_admin('noticias','publicar') then
    raise exception 'Sem permissão para revisar notícias.' using errcode='42501';
  end if;
  if p_decisao not in('aprovar','solicitar_ajustes') then
    raise exception 'Decisão editorial inválida.' using errcode='22023';
  end if;
  if p_decisao='solicitar_ajustes' and nullif(trim(coalesce(p_comentario,'')),'') is null then
    raise exception 'Informe o ajuste necessário.' using errcode='22023';
  end if;

  select * into v_noticia from public.noticias where id=p_noticia for update;
  if not found then raise exception 'Notícia não encontrada.' using errcode='P0002'; end if;
  select * into v_solicitacao from public.solicitacoes_aprovacao
  where noticia_id=p_noticia and status='pendente'
  order by enviado_em desc limit 1 for update;
  if not found or v_noticia.status_editorial<>'em_revisao' then
    raise exception 'A notícia não está aguardando revisão.' using errcode='22023';
  end if;

  if p_decisao='solicitar_ajustes' then
    update public.solicitacoes_aprovacao
    set status='ajustes_solicitados',comentario=trim(p_comentario),
        revisado_por=(select auth.uid()),revisado_em=now(),atualizado_em=now()
    where id=v_solicitacao.id;
    update public.noticias
    set status='rascunho',status_editorial='ajustes_solicitados',
        revisado_por=(select auth.uid()),revisado_em=now()
    where id=p_noticia;
    v_acao:='ajustes_solicitados';
  else
    update public.solicitacoes_aprovacao
    set status='aprovado',comentario=nullif(trim(coalesce(p_comentario,'')),''),
        revisado_por=(select auth.uid()),revisado_em=now(),atualizado_em=now()
    where id=v_solicitacao.id;
    update public.noticias
    set status=case when p_publicar then 'publicado' else 'rascunho' end,
        status_editorial='aprovado',
        publicado_em=case
          when p_publicar then coalesce(p_publicado_em,publicado_em,now())
          else publicado_em
        end,
        revisado_por=(select auth.uid()),revisado_em=now()
    where id=p_noticia;
    v_acao:=case when p_publicar then 'publicado' else 'aprovado' end;
  end if;

  insert into public.cms_atividades(tabela,registro_id,acao,titulo,usuario_id,dados)
  values('noticias',p_noticia::text,v_acao,v_noticia.titulo,(select auth.uid()),
    jsonb_build_object('solicitacao_id',v_solicitacao.id,'comentario',p_comentario));
end;
$$;

revoke all on function public.enviar_noticia_revisao(uuid) from public;
revoke all on function public.revisar_noticia(uuid,text,text,boolean,timestamptz) from public;
grant execute on function public.enviar_noticia_revisao(uuid) to authenticated;
grant execute on function public.revisar_noticia(uuid,text,text,boolean,timestamptz) to authenticated;

create or replace function public.proteger_estado_editorial()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.status_editorial is distinct from new.status_editorial
     and current_user in('anon','authenticated') then
    raise exception 'Use o fluxo de aprovação para alterar o estado editorial.' using errcode='42501';
  end if;
  if new.status='publicado' and new.status_editorial<>'aprovado' then
    raise exception 'A notícia precisa ser aprovada antes da publicação.' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists noticias_proteger_estado_editorial on public.noticias;
create trigger noticias_proteger_estado_editorial before update on public.noticias
for each row execute function public.proteger_estado_editorial();

-- Redator só altera matéria própria quando ela está liberada para edição.
drop policy if exists "rbac_noticias_update" on public.noticias;
create policy "rbac_noticias_update" on public.noticias
for update to authenticated
using(
  public.tem_permissao_admin('noticias','editar')
  and(
    public.funcao_admin_atual()<>'redator'
    or(
      criado_por=(select auth.uid())
      and status='rascunho'
      and status_editorial in('rascunho','ajustes_solicitados')
    )
  )
)
with check(
  public.tem_permissao_admin('noticias','editar')
  and(
    public.funcao_admin_atual()<>'redator'
    or(
      criado_por=(select auth.uid())
      and status='rascunho'
      and status_editorial in('rascunho','ajustes_solicitados')
    )
  )
  and(status<>'publicado' or public.tem_permissao_admin('noticias','publicar'))
);

-- ---------------------------------------------------------------------------
-- Audiência: dados próprios, agregados e sem IP.
-- ---------------------------------------------------------------------------
alter table public.analytics_eventos
  add column if not exists sessao_hash text,
  add column if not exists origem text,
  add column if not exists dispositivo text,
  add column if not exists metadados jsonb not null default '{}'::jsonb;

alter table public.analytics_eventos drop constraint if exists analytics_eventos_tipo_check;
alter table public.analytics_eventos add constraint analytics_eventos_tipo_check
check(tipo in(
  'page_view','noticia_view','guia_view','evento_view','turismo_view',
  'whatsapp_click','instagram_click','external_click','busca'
));

create index if not exists analytics_eventos_periodo_idx
  on public.analytics_eventos(criado_em desc,tipo);
create index if not exists analytics_eventos_sessao_idx
  on public.analytics_eventos(sessao_hash,criado_em desc);
create index if not exists analytics_eventos_origem_idx
  on public.analytics_eventos(origem,dia desc);

drop function if exists public.registrar_evento_site(text,text,text,uuid,text);
create function public.registrar_evento_site(
  p_tipo text,
  p_pagina text,
  p_recurso_tipo text default null,
  p_recurso_id uuid default null,
  p_destino text default null,
  p_sessao_hash text default null,
  p_origem text default null,
  p_dispositivo text default null,
  p_metadados jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_tipo not in(
    'page_view','noticia_view','guia_view','evento_view','turismo_view',
    'whatsapp_click','instagram_click','external_click','busca'
  ) then return; end if;

  insert into public.analytics_eventos(
    tipo,pagina,recurso_tipo,recurso_id,destino,sessao_hash,origem,dispositivo,metadados
  ) values(
    p_tipo,
    left(coalesce(p_pagina,'/'),300),
    left(p_recurso_tipo,40),
    p_recurso_id,
    left(p_destino,500),
    left(p_sessao_hash,80),
    left(p_origem,160),
    case when p_dispositivo in('desktop','tablet','mobile') then p_dispositivo end,
    coalesce(p_metadados,'{}'::jsonb)-'ip'-'email'-'telefone'
  );

  if p_tipo='noticia_view' and p_recurso_id is not null then
    update public.noticias set visualizacoes=visualizacoes+1
    where id=p_recurso_id and status='publicado';
  elsif p_tipo='guia_view' and p_recurso_id is not null then
    update public.guia_comercial set visualizacoes=visualizacoes+1
    where id=p_recurso_id and status='publicado';
  end if;
end;
$$;
revoke all on function public.registrar_evento_site(text,text,text,uuid,text,text,text,text,jsonb) from public;
grant execute on function public.registrar_evento_site(text,text,text,uuid,text,text,text,text,jsonb)
to anon,authenticated;

create or replace function public.obter_audiencia_avancada(p_inicio date,p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_dias integer;
  v_anterior_inicio date;
  v_anterior_fim date;
  v_resultado jsonb;
begin
  if not public.tem_permissao_admin('insights','ler') then
    raise exception 'Sem permissão para consultar audiência.' using errcode='42501';
  end if;
  if p_inicio is null or p_fim is null or p_inicio>p_fim or p_fim-p_inicio>366 then
    raise exception 'Período inválido.' using errcode='22023';
  end if;
  v_dias:=p_fim-p_inicio+1;
  v_anterior_fim:=p_inicio-1;
  v_anterior_inicio:=v_anterior_fim-v_dias+1;

  select jsonb_build_object(
    'periodo',jsonb_build_object('inicio',p_inicio,'fim',p_fim),
    'resumo',jsonb_build_object(
      'eventos',count(*),
      'visualizacoes',count(*) filter(where tipo='page_view'),
      'visitantes',count(distinct sessao_hash) filter(where sessao_hash is not null),
      'noticias',count(*) filter(where tipo='noticia_view'),
      'whatsapp',count(*) filter(where tipo='whatsapp_click'),
      'externos',count(*) filter(where tipo in('external_click','instagram_click'))
    ),
    'anterior',(
      select jsonb_build_object(
        'visualizacoes',count(*) filter(where tipo='page_view'),
        'visitantes',count(distinct sessao_hash) filter(where sessao_hash is not null),
        'noticias',count(*) filter(where tipo='noticia_view'),
        'whatsapp',count(*) filter(where tipo='whatsapp_click'),
        'externos',count(*) filter(where tipo in('external_click','instagram_click'))
      ) from public.analytics_eventos
      where dia between v_anterior_inicio and v_anterior_fim
    ),
    'serie',coalesce((
      select jsonb_agg(jsonb_build_object('dia',d.dia,'visualizacoes',d.total) order by d.dia)
      from(
        select dia,count(*) filter(where tipo='page_view') total
        from public.analytics_eventos
        where dia between p_inicio and p_fim group by dia
      )d
    ),'[]'::jsonb),
    'paginas',coalesce((
      select jsonb_agg(jsonb_build_object('pagina',p.pagina,'total',p.total) order by p.total desc)
      from(
        select pagina,count(*) total from public.analytics_eventos
        where dia between p_inicio and p_fim and tipo='page_view'
        group by pagina order by total desc limit 10
      )p
    ),'[]'::jsonb),
    'origens',coalesce((
      select jsonb_agg(jsonb_build_object('origem',o.origem,'total',o.total) order by o.total desc)
      from(
        select coalesce(nullif(origem,''),'Direto') origem,count(*) total
        from public.analytics_eventos
        where dia between p_inicio and p_fim and tipo='page_view'
        group by 1 order by total desc limit 10
      )o
    ),'[]'::jsonb),
    'dispositivos',coalesce((
      select jsonb_agg(jsonb_build_object('dispositivo',d.dispositivo,'total',d.total) order by d.total desc)
      from(
        select coalesce(dispositivo,'não identificado') dispositivo,count(*) total
        from public.analytics_eventos
        where dia between p_inicio and p_fim and tipo='page_view'
        group by 1 order by total desc
      )d
    ),'[]'::jsonb),
    'buscas',coalesce((
      select jsonb_agg(jsonb_build_object('termo',b.termo,'total',b.total) order by b.total desc)
      from(
        select left(metadados->>'termo',100) termo,count(*) total
        from public.analytics_eventos
        where dia between p_inicio and p_fim and tipo='busca'
          and nullif(metadados->>'termo','') is not null
        group by 1 order by total desc limit 10
      )b
    ),'[]'::jsonb),
    'recursos',coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo',r.recurso_tipo,'id',r.recurso_id,'evento',r.tipo,'total',r.total
      ) order by r.total desc)
      from(
        select recurso_tipo,recurso_id,tipo,count(*) total
        from public.analytics_eventos
        where dia between p_inicio and p_fim
          and recurso_id is not null
          and tipo in('noticia_view','guia_view','evento_view','turismo_view')
        group by recurso_tipo,recurso_id,tipo order by total desc limit 30
      )r
    ),'[]'::jsonb)
  ) into v_resultado
  from public.analytics_eventos
  where dia between p_inicio and p_fim;

  return v_resultado;
end;
$$;
revoke all on function public.obter_audiencia_avancada(date,date) from public;
grant execute on function public.obter_audiencia_avancada(date,date) to authenticated;

commit;
