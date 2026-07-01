-- Eu Amo Urânia — correções da auditoria de categorias e audiência.
-- Execute uma vez no SQL Editor do Supabase.
begin;

alter table public.turismo
  add column if not exists visualizacoes bigint not null default 0;

-- Relaciona conteúdo antigo às categorias já existentes.
update public.noticias n
set categoria_id=c.id
from public.categorias c
where n.categoria_id is null
  and c.tipo='noticias'
  and lower(trim(c.nome))=lower(trim(n.categoria_nome));

update public.guia_comercial g
set categoria_id=c.id
from public.categorias c
where g.categoria_id is null
  and c.tipo='guia'
  and lower(trim(c.nome))=lower(trim(g.categoria_nome));

update public.turismo t
set categoria_id=c.id,
    categoria_nome=coalesce(nullif(trim(t.categoria_nome),''),c.nome)
from public.categorias c
where t.categoria_id is null
  and c.tipo='turismo'
  and c.status='ativo'
  and (select count(*) from public.categorias x where x.tipo='turismo' and x.status='ativo')=1;

update public.eventos e
set categoria_id=c.id,
    categoria_nome=coalesce(nullif(trim(e.categoria_nome),''),c.nome)
from public.categorias c
where e.categoria_id is null
  and c.tipo='eventos'
  and c.status='ativo'
  and (select count(*) from public.categorias x where x.tipo='eventos' and x.status='ativo')=1;

alter table public.analytics_eventos drop constraint if exists analytics_eventos_tipo_check;
alter table public.analytics_eventos add constraint analytics_eventos_tipo_check
check(tipo in(
  'page_view','noticia_view','guia_view','evento_view','turismo_view',
  'guia_click','evento_click','turismo_click','link_click',
  'whatsapp_click','instagram_click','external_click','busca'
));

create or replace function public.registrar_evento_site(
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
    'guia_click','evento_click','turismo_click','link_click',
    'whatsapp_click','instagram_click','external_click','busca'
  ) then return; end if;

  insert into public.analytics_eventos(
    tipo,pagina,recurso_tipo,recurso_id,destino,sessao_hash,origem,dispositivo,metadados
  ) values(
    p_tipo,left(coalesce(p_pagina,'/'),300),left(p_recurso_tipo,40),p_recurso_id,
    left(p_destino,500),left(p_sessao_hash,80),left(p_origem,160),
    case when p_dispositivo in('desktop','tablet','mobile') then p_dispositivo end,
    coalesce(p_metadados,'{}'::jsonb)-'ip'-'email'-'telefone'
  );

  if p_tipo='noticia_view' and p_recurso_id is not null then
    update public.noticias set visualizacoes=visualizacoes+1
    where id=p_recurso_id and status='publicado';
  elsif p_tipo='guia_view' and p_recurso_id is not null then
    update public.guia_comercial set visualizacoes=visualizacoes+1
    where id=p_recurso_id and status='publicado';
  elsif p_tipo='turismo_view' and p_recurso_id is not null then
    update public.turismo set visualizacoes=visualizacoes+1
    where id=p_recurso_id and status='publicado';
  end if;
end;
$$;

revoke all on function public.registrar_evento_site(text,text,text,uuid,text,text,text,text,jsonb) from public;
grant execute on function public.registrar_evento_site(text,text,text,uuid,text,text,text,text,jsonb)
to anon,authenticated;

commit;
