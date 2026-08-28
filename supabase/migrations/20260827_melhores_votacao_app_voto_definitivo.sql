-- Melhores de Urânia — voto nativo definitivo por conta/categoria/edição
--
-- Regra:
-- votou e confirmou pelo app = não pode votar novamente naquela categoria
-- daquela edição, mesmo que o voto seja posteriormente marcado como suspeito,
-- bloqueado ou anulado.
--
-- Esta migration é incremental e não reescreve a migration anterior.
-- Não altera votos do site, apuração, RLS ou a RPC de leitura do app.

do $$
declare
  v_conflicts integer;
begin
  select count(*)
  into v_conflicts
  from (
    select edicao_id, categoria_id, auth_user_id
    from public.melhores_votos
    where origem = 'app'
      and auth_user_id is not null
    group by edicao_id, categoria_id, auth_user_id
    having count(*) > 1
  ) duplicated_app_votes;

  if v_conflicts > 0 then
    raise exception
      'Não foi possível criar o índice definitivo: existem % combinações duplicadas de voto do app por edição/categoria/usuário. Revise os dados antes de executar esta migration.',
      v_conflicts
      using errcode = '23505';
  end if;
end $$;

drop index if exists public.melhores_votos_app_um_valido_por_categoria_uidx;

create unique index if not exists melhores_votos_app_um_confirmado_por_categoria_uidx
  on public.melhores_votos(edicao_id, categoria_id, auth_user_id)
  where origem = 'app'
    and auth_user_id is not null;

create or replace function public.melhores_app_registrar_voto(
  p_edicao_id uuid,
  p_categoria_id uuid,
  p_indicado_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_edicao record;
  v_categoria record;
  v_indicado record;
  v_voto_id uuid;
  v_identifier text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select id, status, votacao_inicio, votacao_fim
  into v_edicao
  from public.melhores_edicoes
  where id = p_edicao_id
  for update;

  if not found then
    raise exception 'Edição não encontrada.' using errcode = 'P0002';
  end if;

  if v_edicao.status <> 'votacao_aberta'
    or (v_edicao.votacao_inicio is not null and now() < v_edicao.votacao_inicio)
    or (v_edicao.votacao_fim is not null and now() > v_edicao.votacao_fim)
  then
    raise exception 'A votação não está aberta neste momento.' using errcode = '22023';
  end if;

  select id, edicao_id, status, visibilidade_publica
  into v_categoria
  from public.melhores_categorias
  where id = p_categoria_id
    and edicao_id = p_edicao_id;

  if not found
    or v_categoria.status <> 'ativo'
    or v_categoria.visibilidade_publica is distinct from true
  then
    raise exception 'Categoria indisponível para votação.' using errcode = '22023';
  end if;

  select id, edicao_id, categoria_id, status, aprovado
  into v_indicado
  from public.melhores_indicados
  where id = p_indicado_id
    and categoria_id = p_categoria_id
    and edicao_id = p_edicao_id;

  if not found
    or v_indicado.status <> 'ativo'
    or v_indicado.aprovado is distinct from true
  then
    raise exception 'Indicado indisponível para votação.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.melhores_votos
    where edicao_id = p_edicao_id
      and categoria_id = p_categoria_id
      and auth_user_id = v_user_id
      and origem = 'app'
  ) then
    raise exception 'Você já votou nesta categoria.' using errcode = '23505';
  end if;

  v_identifier := 'app:' || md5(v_user_id::text);

  insert into public.melhores_votos(
    edicao_id,
    categoria_id,
    indicado_id,
    identificador_hash,
    user_agent_hash,
    origem,
    status,
    auth_user_id,
    metadados
  )
  values(
    p_edicao_id,
    p_categoria_id,
    p_indicado_id,
    v_identifier,
    null,
    'app',
    'valido',
    v_user_id,
    jsonb_build_object('canal', 'viva_urania_app')
  )
  returning id into v_voto_id;

  return jsonb_build_object(
    'ok', true,
    'voto_id', v_voto_id,
    'categoria_id', p_categoria_id,
    'indicado_id', p_indicado_id,
    'origem', 'app',
    'status', 'valido'
  );
exception
  when unique_violation then
    raise exception 'Você já votou nesta categoria.' using errcode = '23505';
end;
$$;

revoke all on function public.melhores_app_registrar_voto(uuid, uuid, uuid) from public;
grant execute on function public.melhores_app_registrar_voto(uuid, uuid, uuid) to authenticated;

comment on index public.melhores_votos_app_um_confirmado_por_categoria_uidx is
  'Garante voto nativo definitivo do app: uma conta por edição/categoria, independentemente do status posterior do voto.';
