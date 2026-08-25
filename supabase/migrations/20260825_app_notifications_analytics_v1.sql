-- Viva Urânia — Notificações com destino + Analytics próprio do app
-- Migration incremental: reaproveita app_notificacoes, app_push_tokens e analytics_eventos.

create extension if not exists pgcrypto;

alter table public.app_notificacoes
  add column if not exists destino_id uuid,
  add column if not exists destino_label text,
  add column if not exists caminho text,
  add column if not exists cliques integer not null default 0,
  add column if not exists ultimo_clique_em timestamptz,
  add column if not exists erro_resumo text;

alter table public.app_notificacoes drop constraint if exists app_notificacoes_destino_tipo_check;
alter table public.app_notificacoes
  add constraint app_notificacoes_destino_tipo_check
  check (destino_tipo in ('home', 'empresa', 'turismo', 'evento', 'noticia', 'telefones_uteis'));

alter table public.analytics_eventos
  add column if not exists anonymous_id text,
  add column if not exists usuario_id uuid references auth.users(id) on delete set null,
  add column if not exists app_version text,
  add column if not exists notification_id uuid references public.app_notificacoes(id) on delete set null;

alter table public.analytics_eventos drop constraint if exists analytics_eventos_tipo_check;
alter table public.analytics_eventos
  add constraint analytics_eventos_tipo_check
  check (tipo in (
    'page_view',
    'noticia_view',
    'guia_view',
    'evento_view',
    'turismo_view',
    'whatsapp_click',
    'instagram_click',
    'external_click',
    'busca',
    'app_open',
    'empresa_view',
    'empresa_whatsapp_click',
    'empresa_phone_click',
    'empresa_map_click',
    'turismo_map_click',
    'evento_view',
    'noticia_view',
    'favorite_add',
    'favorite_remove',
    'search',
    'notification_open'
  ));

create index if not exists analytics_eventos_app_periodo_idx
  on public.analytics_eventos (criado_em desc, tipo)
  where dispositivo in ('ios', 'android');

create index if not exists analytics_eventos_app_recurso_idx
  on public.analytics_eventos (recurso_tipo, recurso_id, criado_em desc)
  where dispositivo in ('ios', 'android');

create index if not exists analytics_eventos_app_anonymous_idx
  on public.analytics_eventos (anonymous_id, criado_em desc)
  where anonymous_id is not null;

create index if not exists analytics_eventos_notification_idx
  on public.analytics_eventos (notification_id, criado_em desc)
  where notification_id is not null;

create index if not exists app_notificacoes_destino_idx
  on public.app_notificacoes (destino_tipo, destino_id);

create or replace function public.registrar_evento_app(
  p_tipo text,
  p_anonymous_id text default null,
  p_sessao_hash text default null,
  p_recurso_tipo text default null,
  p_recurso_id uuid default null,
  p_notification_id uuid default null,
  p_plataforma text default null,
  p_app_version text default null,
  p_metadados jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metadata jsonb;
  v_user_id uuid;
begin
  if p_tipo not in (
    'app_open',
    'empresa_view',
    'empresa_whatsapp_click',
    'empresa_phone_click',
    'empresa_map_click',
    'turismo_view',
    'turismo_map_click',
    'evento_view',
    'noticia_view',
    'favorite_add',
    'favorite_remove',
    'search',
    'notification_open'
  ) then
    return;
  end if;

  if p_plataforma not in ('ios', 'android') then
    return;
  end if;

  v_user_id := auth.uid();
  v_metadata := coalesce(p_metadados, '{}'::jsonb)
    - 'email'
    - 'telefone'
    - 'phone'
    - 'token'
    - 'access_token'
    - 'refresh_token'
    - 'jwt'
    - 'headers'
    - 'senha'
    - 'password';

  if length(coalesce(v_metadata::text, '{}')) > 4000 then
    v_metadata := jsonb_build_object('truncated', true);
  end if;

  insert into public.analytics_eventos (
    tipo,
    pagina,
    recurso_tipo,
    recurso_id,
    destino,
    sessao_hash,
    origem,
    dispositivo,
    metadados,
    anonymous_id,
    usuario_id,
    app_version,
    notification_id
  ) values (
    p_tipo,
    '/app',
    left(p_recurso_tipo, 40),
    p_recurso_id,
    null,
    left(p_sessao_hash, 80),
    'app',
    p_plataforma,
    v_metadata,
    left(p_anonymous_id, 80),
    v_user_id,
    left(p_app_version, 30),
    p_notification_id
  );

  if p_tipo = 'notification_open' and p_notification_id is not null then
    update public.app_notificacoes
       set cliques = coalesce(cliques, 0) + 1,
           ultimo_clique_em = now()
     where id = p_notification_id;
  end if;
end;
$$;

revoke all on function public.registrar_evento_app(text,text,text,text,uuid,uuid,text,text,jsonb) from public;
grant execute on function public.registrar_evento_app(text,text,text,text,uuid,uuid,text,text,jsonb) to anon, authenticated;

comment on function public.registrar_evento_app(text,text,text,text,uuid,uuid,text,text,jsonb)
  is 'Registra eventos first-party do aplicativo Viva Urânia com minimização de dados pessoais.';
comment on column public.app_notificacoes.destino_id is 'ID real do conteúdo escolhido no painel para abertura por push.';
comment on column public.app_notificacoes.caminho is 'Rota interna do app usada ao tocar na notificação.';
comment on column public.app_notificacoes.cliques is 'Cliques registrados ao abrir a notificação no app.';
