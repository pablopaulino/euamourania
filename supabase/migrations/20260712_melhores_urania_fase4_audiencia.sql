-- Fase 4 - Melhores de Urânia
-- Libera eventos de audiência específicos da premiação sem expor dados pessoais.

alter table public.analytics_eventos drop constraint if exists analytics_eventos_tipo_check;
alter table public.analytics_eventos add constraint analytics_eventos_tipo_check
check(tipo ~ '^[a-z][a-z0-9_]{1,60}$');

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
  if coalesce(p_tipo,'') !~ '^[a-z][a-z0-9_]{1,60}$' then return; end if;

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
