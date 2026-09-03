-- Viva Urânia — preferências temáticas de notificações por conta.
-- Incremental: preserva tokens e campanhas existentes.

create or replace function public.app_preferencias_push_padrao()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'agenda_eventos', true,
    'noticias', true,
    'descobertas', true,
    'comunidade', true,
    'melhores', true,
    'parceiros_ofertas', true
  );
$$;

alter table public.app_push_tokens
  add column if not exists usuario_id uuid references auth.users(id) on delete set null;

alter table public.app_notificacoes
  add column if not exists tema text not null default 'geral';

alter table public.app_notificacoes
  drop constraint if exists app_notificacoes_tema_check;

alter table public.app_notificacoes
  add constraint app_notificacoes_tema_check
  check (tema in (
    'geral',
    'agenda_eventos',
    'noticias',
    'descobertas',
    'comunidade',
    'melhores',
    'parceiros_ofertas'
  ));

create table if not exists public.app_preferencias_notificacao (
  user_id uuid primary key references auth.users(id) on delete cascade,
  temas jsonb not null default public.app_preferencias_push_padrao(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint app_preferencias_notificacao_temas_objeto_check
    check (jsonb_typeof(temas) = 'object')
);

create index if not exists app_push_tokens_usuario_ativo_idx
  on public.app_push_tokens (usuario_id, visto_em desc)
  where ativo = true and usuario_id is not null;

create index if not exists app_notificacoes_tema_criado_em_idx
  on public.app_notificacoes (tema, criado_em desc);

create or replace function public.app_preferencias_push_normalizar(p_temas jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_padrao jsonb := public.app_preferencias_push_padrao();
  v_chave text;
  v_valor jsonb;
begin
  if p_temas is null then
    return v_padrao;
  end if;

  if jsonb_typeof(p_temas) <> 'object' then
    raise exception 'Preferências inválidas';
  end if;

  for v_chave, v_valor in select key, value from jsonb_each(p_temas)
  loop
    if not (v_padrao ? v_chave) then
      raise exception 'Tema de notificação inválido';
    end if;
    if jsonb_typeof(v_valor) <> 'boolean' then
      raise exception 'Cada preferência deve ser booleana';
    end if;
  end loop;

  return v_padrao || p_temas;
end;
$$;

create or replace function public.app_touch_preferencias_notificacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.temas = public.app_preferencias_push_normalizar(new.temas);
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists app_preferencias_notificacao_touch on public.app_preferencias_notificacao;
create trigger app_preferencias_notificacao_touch
before insert or update of temas on public.app_preferencias_notificacao
for each row execute function public.app_touch_preferencias_notificacao();

create or replace function public.app_registrar_push_token(
  p_installation_id uuid,
  p_expo_push_token text,
  p_plataforma text,
  p_app_version text default null,
  p_locale text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_plataforma not in ('android', 'ios') then
    raise exception 'Plataforma inválida';
  end if;
  if p_expo_push_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Token inválido';
  end if;

  delete from public.app_push_tokens
   where expo_push_token = p_expo_push_token
     and installation_id <> p_installation_id;

  insert into public.app_push_tokens (
    installation_id, expo_push_token, plataforma, app_version, locale, usuario_id, ativo, visto_em
  ) values (
    p_installation_id, p_expo_push_token, p_plataforma,
    left(p_app_version, 30), left(p_locale, 20), auth.uid(), true, now()
  )
  on conflict (installation_id) do update set
    expo_push_token = excluded.expo_push_token,
    plataforma = excluded.plataforma,
    app_version = excluded.app_version,
    locale = excluded.locale,
    -- A sincronização normal pode ocorrer antes da autenticação estar pronta.
    -- Nesse caso, não apaga o vínculo já confirmado da conta no aparelho.
    usuario_id = coalesce(excluded.usuario_id, public.app_push_tokens.usuario_id),
    ativo = true,
    visto_em = now();
end;
$$;

create or replace function public.app_desvincular_push_usuario(p_installation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_push_tokens
     set usuario_id = null,
         atualizado_em = now()
   where installation_id = p_installation_id
     and usuario_id = auth.uid();
end;
$$;

create or replace function public.app_push_tokens_para_notificacao(p_notificacao_id uuid)
returns table (id uuid, expo_push_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plataforma text;
  v_tema text;
begin
  -- O endpoint Vercel usa service_role para entregar a campanha já criada;
  -- operadores humanos continuam obrigatoriamente sujeitos ao RBAC do painel.
  if auth.role() <> 'service_role'
     and not public.tem_permissao_admin('notificacoes', 'enviar') then
    raise exception 'Permissão para enviar notificações necessária';
  end if;

  select plataforma, tema
    into v_plataforma, v_tema
    from public.app_notificacoes
   where id = p_notificacao_id;

  if not found then
    raise exception 'Notificação não encontrada';
  end if;

  return query
    select token.id, token.expo_push_token
      from public.app_push_tokens token
      left join public.app_preferencias_notificacao preferencia
        on preferencia.user_id = token.usuario_id
     where token.ativo = true
       and (v_plataforma = 'todos' or token.plataforma = v_plataforma)
       and (
         v_tema = 'geral'
         or token.usuario_id is null
         or preferencia.user_id is null
         or coalesce((preferencia.temas ->> v_tema)::boolean, true)
       )
     order by token.visto_em desc;
end;
$$;

alter table public.app_preferencias_notificacao enable row level security;
revoke all on public.app_preferencias_notificacao from anon;
grant select, insert, update on public.app_preferencias_notificacao to authenticated;

drop policy if exists "usuario_le_suas_preferencias_push" on public.app_preferencias_notificacao;
create policy "usuario_le_suas_preferencias_push"
on public.app_preferencias_notificacao for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "usuario_cria_suas_preferencias_push" on public.app_preferencias_notificacao;
create policy "usuario_cria_suas_preferencias_push"
on public.app_preferencias_notificacao for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "usuario_atualiza_suas_preferencias_push" on public.app_preferencias_notificacao;
create policy "usuario_atualiza_suas_preferencias_push"
on public.app_preferencias_notificacao for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on function public.app_push_tokens_para_notificacao(uuid) from public;
grant execute on function public.app_push_tokens_para_notificacao(uuid) to authenticated;
grant execute on function public.app_push_tokens_para_notificacao(uuid) to service_role;
revoke all on function public.app_desvincular_push_usuario(uuid) from public;
grant execute on function public.app_desvincular_push_usuario(uuid) to authenticated;

comment on table public.app_preferencias_notificacao is
  'Preferências temáticas de push vinculadas à conta autenticada do Viva Urânia.';
comment on column public.app_notificacoes.tema is
  'Tema de uma campanha push; geral é reservado a informação relevante para todo aparelho ativo.';
