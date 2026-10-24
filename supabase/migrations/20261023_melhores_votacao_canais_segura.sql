-- Preparacao local. Aplicar antes do codigo do site; nao altera dados da edicao.
begin;

alter table public.melhores_edicoes
  add column if not exists votacao_inicio_site timestamptz;
alter table public.melhores_edicoes
  add column if not exists mostrar_indicados_antes_votacao boolean not null default false;
alter table public.melhores_edicoes
  add column if not exists votos_individuais_limpos_em timestamptz;
alter table public.melhores_edicoes
  alter column votos_individuais_remover_apos set default interval '30 days';

alter table public.melhores_edicoes
  drop constraint if exists melhores_edicoes_inicio_site_periodo_check;
alter table public.melhores_edicoes
  add constraint melhores_edicoes_inicio_site_periodo_check
  check ((votacao_inicio_site is null or votacao_fim is null or votacao_inicio_site < votacao_fim)
    and (votacao_inicio_site is null or votacao_inicio is null or votacao_inicio_site >= votacao_inicio));

comment on column public.melhores_edicoes.votacao_inicio is
  'Inicio da votacao no aplicativo. Mantido para compatibilidade com a RPC publicada.';
comment on column public.melhores_edicoes.votacao_inicio_site is
  'Inicio independente da votacao no site; NULL bloqueia votos no site.';

drop policy if exists "melhores_categorias_select" on public.melhores_categorias;
create policy "melhores_categorias_select" on public.melhores_categorias
for select to anon, authenticated using (
  public.tem_permissao_admin('melhores','ler')
  or (
    status = 'ativo' and visibilidade_publica = true
    and exists (
      select 1 from public.melhores_edicoes e
      where e.id = edicao_id and (
        e.status in ('indicacoes_abertas','votacao_aberta','votacao_encerrada','apuracao','resultado_publicado')
        or (e.status = 'indicacoes_encerradas' and e.mostrar_indicados_antes_votacao = true)
        or (e.status = 'arquivada' and e.resultado_publicado_em is not null)
      )
    )
  )
  or public.melhores_consta_em_resultado_publicado(id, null)
);

drop policy if exists "melhores_indicados_select" on public.melhores_indicados;
create policy "melhores_indicados_select" on public.melhores_indicados
for select to anon, authenticated using (
  public.tem_permissao_admin('melhores','ler')
  or (
    status = 'ativo' and aprovado = true
    and exists (
      select 1 from public.melhores_edicoes e
      where e.id = edicao_id and (
        e.status in ('votacao_aberta','votacao_encerrada','apuracao','resultado_publicado')
        or (e.status = 'indicacoes_encerradas' and e.mostrar_indicados_antes_votacao = true)
        or (e.status = 'arquivada' and e.resultado_publicado_em is not null)
      )
    )
  )
  or public.melhores_consta_em_resultado_publicado(null, id)
);

-- Serializa inclusoes administrativas simultaneas na mesma categoria.
create or replace function public.melhores_validar_limite_indicados()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limite integer; v_total integer;
begin
  if new.status = 'ativo' and coalesce(new.aprovado,false) = true then
    select coalesce(limite_indicados,4) into v_limite
    from public.melhores_categorias
    where id = new.categoria_id and edicao_id = new.edicao_id for update;
    if not found then raise exception 'Categoria inexistente.' using errcode = '23503'; end if;
    select count(*) into v_total from public.melhores_indicados
    where edicao_id = new.edicao_id and categoria_id = new.categoria_id
      and status = 'ativo' and aprovado = true and id is distinct from new.id;
    if v_total >= v_limite then
      raise exception 'Limite de % indicados ativos/aprovados atingido para esta categoria.', v_limite
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- Somente novos votos do fluxo v2 entram neste indice. Votos historicos nao
-- sao removidos nem impedem a instalacao da migracao.
create unique index if not exists melhores_votos_site_v2_categoria_uidx
  on public.melhores_votos(edicao_id, categoria_id, identificador_hash)
  where origem = 'site' and (metadados->>'controle_versao') = '2';

create table if not exists public.melhores_voto_rate (
  chave text not null,
  janela_inicio timestamptz not null,
  janela_segundos integer not null,
  tentativas integer not null default 0,
  primary key (chave, janela_inicio, janela_segundos)
);
create index if not exists melhores_voto_rate_expiracao_idx
  on public.melhores_voto_rate(janela_inicio);
alter table public.melhores_voto_rate enable row level security;
revoke all on public.melhores_voto_rate from public, anon, authenticated;

create or replace function public.melhores_voto_rate_check(
  p_chave text, p_limite integer, p_janela_segundos integer
) returns boolean language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  v_inicio timestamptz;
  v_tentativas integer;
begin
  if p_chave is null or length(p_chave) < 20 or p_limite < 1
     or p_janela_segundos < 60 or p_janela_segundos > 86400 then
    raise exception 'Parametros de limite invalidos.' using errcode = '22023';
  end if;
  v_inicio := to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos);
  insert into public.melhores_voto_rate(chave, janela_inicio, janela_segundos, tentativas)
  values (p_chave, v_inicio, p_janela_segundos, 1)
  on conflict (chave, janela_inicio, janela_segundos)
  do update set tentativas = public.melhores_voto_rate.tentativas + 1
  returning tentativas into v_tentativas;
  return v_tentativas <= p_limite;
end;
$$;
revoke all on function public.melhores_voto_rate_check(text,integer,integer) from public, anon, authenticated;
grant execute on function public.melhores_voto_rate_check(text,integer,integer) to service_role;

create or replace function public.melhores_voto_rate_limpar()
returns integer language plpgsql security definer
set search_path = pg_catalog, public as $$
declare v_total integer;
begin
  delete from public.melhores_voto_rate
  where janela_inicio < now() - interval '2 days';
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;
revoke all on function public.melhores_voto_rate_limpar() from public, anon, authenticated;
grant execute on function public.melhores_voto_rate_limpar() to service_role;

-- O arquivo exportado permanece com o administrador. O banco guarda apenas
-- o hash e a contagem declarados, para auditoria e para liberar a retencao.
create table if not exists public.melhores_exportacoes_votos (
  edicao_id uuid primary key references public.melhores_edicoes(id) on delete cascade,
  sha256_csv text not null check (sha256_csv ~ '^[0-9a-f]{64}$'),
  total_linhas integer not null check (total_linhas >= 0),
  confirmado_em timestamptz not null default now(),
  confirmado_por uuid references auth.users(id) on delete set null
);
alter table public.melhores_exportacoes_votos enable row level security;
revoke all on public.melhores_exportacoes_votos from public, anon, authenticated;

create or replace function public.melhores_confirmar_exportacao_votos(
  p_edicao uuid, p_sha256_csv text, p_total_linhas integer
) returns void language plpgsql security definer set search_path = public as $$
declare v_edicao record; v_total integer;
begin
  if not public.is_super_admin() then
    raise exception 'Apenas Super Admin pode confirmar a exportacao.' using errcode = '42501';
  end if;
  if p_sha256_csv is null or p_sha256_csv !~ '^[0-9a-f]{64}$' or p_total_linhas is null or p_total_linhas < 0 then
    raise exception 'Manifesto de exportacao invalido.' using errcode = '22023';
  end if;
  select status, resultado_publicado_em, votacao_fim into v_edicao
  from public.melhores_edicoes where id = p_edicao for update;
  if not found or v_edicao.status not in ('resultado_publicado','arquivada')
     or v_edicao.resultado_publicado_em is null or v_edicao.votacao_fim is null
     or now() <= v_edicao.votacao_fim then
    raise exception 'A exportacao exige votacao encerrada e resultado publicado.' using errcode = '22023';
  end if;
  select count(*)::integer into v_total from public.melhores_votos where edicao_id = p_edicao;
  if v_total <> p_total_linhas then
    raise exception 'Total de votos mudou desde a exportacao.' using errcode = '22023';
  end if;
  insert into public.melhores_exportacoes_votos(edicao_id, sha256_csv, total_linhas, confirmado_em, confirmado_por)
  values (p_edicao, p_sha256_csv, p_total_linhas, now(), auth.uid())
  on conflict (edicao_id) do update set sha256_csv = excluded.sha256_csv,
    total_linhas = excluded.total_linhas, confirmado_em = excluded.confirmado_em,
    confirmado_por = excluded.confirmado_por;
  insert into public.melhores_auditoria(edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores)
  values (p_edicao, auth.uid(), 'exportacao_votos_confirmada', 'melhores_votos', p_edicao,
    jsonb_build_object('sha256_csv',p_sha256_csv,'total_linhas',p_total_linhas,'confirmado_em',now()));
end;
$$;
revoke all on function public.melhores_confirmar_exportacao_votos(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.melhores_confirmar_exportacao_votos(uuid,text,integer) to authenticated;

-- A limpeza manual e a rotina automatica compartilham as mesmas condicoes.
create or replace function public.melhores_limpar_votos_edicao_manual(p_edicao uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_edicao record; v_count integer; v_exportacao record;
begin
  if not public.is_super_admin() then
    raise exception 'Apenas Super Admin pode executar a limpeza manual.' using errcode = '42501';
  end if;
  select status, resultado_publicado_em, votacao_fim, votos_individuais_remover_apos,
    votos_individuais_limpos_em into v_edicao
  from public.melhores_edicoes where id = p_edicao for update;
  if not found or v_edicao.status not in ('resultado_publicado','arquivada')
     or v_edicao.resultado_publicado_em is null
     or v_edicao.votacao_fim is null or now() <= v_edicao.votacao_fim
     or now() < v_edicao.resultado_publicado_em + v_edicao.votos_individuais_remover_apos then
    raise exception 'Publicacao e prazo de auditoria obrigatorios antes da limpeza.' using errcode = '22023';
  end if;
  if v_edicao.votos_individuais_limpos_em is not null then return 0; end if;
  select total_linhas into v_exportacao from public.melhores_exportacoes_votos where edicao_id = p_edicao;
  if not found or v_exportacao.total_linhas <> (select count(*) from public.melhores_votos where edicao_id = p_edicao) then
    raise exception 'Exportacao confirmada e contagem de votos atual obrigatorias antes da limpeza.' using errcode = '22023';
  end if;
  perform public.melhores_consolidar_edicao(p_edicao);
  delete from public.melhores_votos where edicao_id = p_edicao;
  get diagnostics v_count = row_count;
  update public.melhores_edicoes set votos_individuais_limpos_em = now(),
    votos_individuais_removidos_em = now() where id = p_edicao;
  insert into public.melhores_auditoria(edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores)
  values(p_edicao, auth.uid(), 'limpeza_votos_manual', 'melhores_votos', p_edicao,
    jsonb_build_object('votos_removidos',v_count,'executado_em',now()));
  return v_count;
end;
$$;
revoke all on function public.melhores_limpar_votos_edicao_manual(uuid) from public;
grant execute on function public.melhores_limpar_votos_edicao_manual(uuid) to authenticated;

create or replace function public.melhores_limpar_votos_expirados()
returns integer language plpgsql security definer set search_path = public as $$
declare v_edicao record; v_total integer := 0; v_count integer;
begin
  for v_edicao in
    select e.id from public.melhores_edicoes e
    where e.status in ('resultado_publicado','arquivada')
      and e.resultado_publicado_em is not null
      and e.votacao_fim is not null and now() > e.votacao_fim
      and e.votos_individuais_limpos_em is null
      and e.votos_individuais_removidos_em is null
      and now() >= e.resultado_publicado_em + e.votos_individuais_remover_apos
    for update
  loop
    select count(*)::integer into v_count from public.melhores_votos where edicao_id = v_edicao.id;
    if exists (select 1 from public.melhores_exportacoes_votos x
      where x.edicao_id = v_edicao.id and x.total_linhas = v_count) then
      perform public.melhores_consolidar_edicao(v_edicao.id);
      delete from public.melhores_votos where edicao_id = v_edicao.id;
      get diagnostics v_count = row_count;
      update public.melhores_edicoes set votos_individuais_limpos_em = now(),
        votos_individuais_removidos_em = now() where id = v_edicao.id;
      insert into public.melhores_auditoria(edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores)
      values(v_edicao.id, null, 'limpeza_votos', 'melhores_votos', v_edicao.id,
        jsonb_build_object('votos_removidos',v_count,'executado_em',now()));
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.melhores_limpar_votos_expirados() from public, anon, authenticated;
grant execute on function public.melhores_limpar_votos_expirados() to service_role;

-- A trava por identidade/categoria serializa votos concorrentes, inclusive
-- para indicados diferentes. O indice unico reforca a mesma regra no banco.
create or replace function public.melhores_site_registrar_voto(
  p_edicao_id uuid, p_categoria_id uuid, p_indicado_id uuid,
  p_identificador_hash text, p_user_agent_hash text,
  p_ip_hash text, p_pagina text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  v_edicao record;
  v_voto record;
  v_id uuid;
begin
  if p_identificador_hash is null or length(p_identificador_hash) <> 64 then
    raise exception 'Identificador invalido.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_edicao_id::text || ':' || p_categoria_id::text || ':' || p_identificador_hash, 0));
  select status, votacao_inicio_site, votacao_fim into v_edicao
  from public.melhores_edicoes where id = p_edicao_id;
  if not found or v_edicao.status <> 'votacao_aberta'
     or v_edicao.votacao_inicio_site is null
     or now() < v_edicao.votacao_inicio_site
     or v_edicao.votacao_fim is null or now() > v_edicao.votacao_fim then
    raise exception 'A votacao no site nao esta aberta.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.melhores_categorias
      where id = p_categoria_id and edicao_id = p_edicao_id
        and status = 'ativo' and visibilidade_publica = true) then
    raise exception 'Categoria indisponivel.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.melhores_indicados
      where id = p_indicado_id and categoria_id = p_categoria_id
        and edicao_id = p_edicao_id and status = 'ativo' and aprovado = true) then
    raise exception 'Indicado indisponivel.' using errcode = '22023';
  end if;
  select id, indicado_id, status into v_voto from public.melhores_votos
  where edicao_id = p_edicao_id and categoria_id = p_categoria_id
    and identificador_hash = p_identificador_hash and origem = 'site' limit 1;
  if found then
    if v_voto.indicado_id = p_indicado_id and v_voto.status in ('valido','suspeito') then
      return jsonb_build_object('ok', true, 'voto_id', v_voto.id,
        'status', v_voto.status, 'ja_registrado', true);
    end if;
    raise exception 'Voce ja votou nesta categoria.' using errcode = '23505';
  end if;
  insert into public.melhores_votos(
    edicao_id, categoria_id, indicado_id, identificador_hash,
    user_agent_hash, origem, status, metadados
  ) values (
    p_edicao_id, p_categoria_id, p_indicado_id, p_identificador_hash,
    p_user_agent_hash, 'site', 'valido',
    jsonb_build_object('controle_versao','2','ip_hash',p_ip_hash,
      'pagina',left(coalesce(p_pagina,''),300),'turnstile','validado')
  ) returning id into v_id;
  return jsonb_build_object('ok', true, 'voto_id', v_id,
    'status', 'valido', 'ja_registrado', false);
exception when unique_violation then
  raise exception 'Voce ja votou nesta categoria.' using errcode = '23505';
end;
$$;
revoke all on function public.melhores_site_registrar_voto(uuid,uuid,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.melhores_site_registrar_voto(uuid,uuid,uuid,text,text,text,text)
  to service_role;

-- O bloco de 60% soma exclusivamente os dois canais oficiais.
create or replace view public.melhores_apuracao_previa as
with site as (
  select edicao_id, categoria_id, indicado_id,
    count(*) filter (where status = 'valido' and origem in ('site','app'))::integer as votos_site
  from public.melhores_votos group by edicao_id, categoria_id, indicado_id
), instagram as (
  select edicao_id, categoria_id, indicado_id, sum(votos)::integer as votos_instagram
  from public.melhores_instagram_votos group by edicao_id, categoria_id, indicado_id
), base as (
  select i.edicao_id, i.categoria_id, i.id as indicado_id,
    i.nome as indicado_nome, c.nome as categoria_nome,
    coalesce(s.votos_site,0) as votos_site,
    coalesce(inst.votos_instagram,0) as votos_instagram
  from public.melhores_indicados i
  join public.melhores_categorias c on c.id = i.categoria_id
  left join site s on s.indicado_id = i.id
  left join instagram inst on inst.indicado_id = i.id
  where i.status = 'ativo' and i.aprovado = true
), totais as (
  select edicao_id, categoria_id, sum(votos_site)::numeric as total_site,
    sum(votos_instagram)::numeric as total_instagram
  from base group by edicao_id, categoria_id
)
select b.edicao_id, b.categoria_id, b.indicado_id, b.categoria_nome,
  b.indicado_nome, b.votos_site, b.votos_instagram,
  case when t.total_site > 0 then round(b.votos_site::numeric/t.total_site*100,4) else 0 end as percentual_site,
  case when t.total_instagram > 0 then round(b.votos_instagram::numeric/t.total_instagram*100,4) else 0 end as percentual_instagram,
  e.peso_site, e.peso_instagram,
  round((case when t.total_site > 0 then b.votos_site::numeric/t.total_site*e.peso_site else 0 end)
      +(case when t.total_instagram > 0 then b.votos_instagram::numeric/t.total_instagram*e.peso_instagram else 0 end),6) as pontuacao_final,
  dense_rank() over (partition by b.edicao_id,b.categoria_id order by
    round((case when t.total_site > 0 then b.votos_site::numeric/t.total_site*e.peso_site else 0 end)
      +(case when t.total_instagram > 0 then b.votos_instagram::numeric/t.total_instagram*e.peso_instagram else 0 end),6) desc,
    b.votos_site desc,b.votos_instagram desc,b.indicado_nome asc) as colocacao,
  count(*) over (partition by b.edicao_id,b.categoria_id,
    round((case when t.total_site > 0 then b.votos_site::numeric/t.total_site*e.peso_site else 0 end)
      +(case when t.total_instagram > 0 then b.votos_instagram::numeric/t.total_instagram*e.peso_instagram else 0 end),6)) > 1 as empate
from base b join totais t on t.edicao_id=b.edicao_id and t.categoria_id=b.categoria_id
join public.melhores_edicoes e on e.id=b.edicao_id;
alter view public.melhores_apuracao_previa set (security_invoker = true);

notify pgrst, 'reload schema';

commit;
