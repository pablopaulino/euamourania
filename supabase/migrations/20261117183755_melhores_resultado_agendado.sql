-- Preparação sigilosa e divulgação agendada; não prepara votos reais automaticamente.
begin;
-- TRUNCATE não respeita RLS nem os gatilhos por linha que protegem a apuração.
revoke truncate on public.melhores_edicoes, public.melhores_categorias, public.melhores_indicados, public.melhores_desempates, public.melhores_votos, public.melhores_instagram_votos, public.melhores_resultados, public.melhores_auditoria from public, anon, authenticated;
create schema if not exists premios_privado;
revoke all on schema premios_privado from public, anon, authenticated;
create table premios_privado.agendamentos (
  edicao_id uuid primary key references public.melhores_edicoes(id),
  divulgar_em timestamptz not null,
  preparado_por uuid,
  total integer not null check(total > 0),
  preparado_em timestamptz not null default now(),
  publicado_em timestamptz
);
revoke all on premios_privado.agendamentos from public, anon, authenticated;

create or replace function public.melhores_preparar_resultado_agendado(
  p_edicao uuid,
  p_metodologia text default null
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
  v_status text;
  v_divulgacao timestamptz;
  v_categoria record;
begin
  if (select auth.uid()) is null or not coalesce(public.tem_permissao_admin('melhores','editar'), false) then
    raise exception 'Sem permissao para publicar resultado.' using errcode = '42501';
  end if;

  select e.status, e.divulgacao_em into v_status, v_divulgacao
  from public.melhores_edicoes e where e.id = p_edicao for update;
  if not found then
    raise exception 'Edicao nao encontrada.' using errcode = 'P0002';
  end if;
  if v_status in ('resultado_publicado','arquivada')
     or exists (
       select 1 from public.melhores_resultados r
       where r.edicao_id = p_edicao and r.publicado = true
     ) then
    raise exception 'Resultado ja publicado: o historico nao pode ser republicado.'
      using errcode = '23514';
  end if;
  if not exists(select 1 from public.melhores_edicoes where id=p_edicao and ano=2026) then raise exception 'Agendamento disponível apenas para a edição 2026.'; end if;
  if exists(select 1 from premios_privado.agendamentos where edicao_id=p_edicao) then raise exception 'Já existe resultado preparado para esta edição.'; end if;
  if not exists(select 1 from public.melhores_edicoes where id=p_edicao and votacao_fim is not null and votacao_fim<clock_timestamp()) then raise exception 'A votação ainda não terminou.'; end if;
  if v_divulgacao is null or v_divulgacao <= clock_timestamp() then raise exception 'Informe uma data de divulgação futura.'; end if;
  if v_status not in ('votacao_encerrada','apuracao') then
    raise exception 'A edicao precisa estar encerrada ou em apuracao para publicar resultado.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.melhores_categorias c
    where c.edicao_id = p_edicao and c.status = 'ativo'
      and c.visibilidade_publica = true
  ) then
    raise exception 'Nenhuma categoria publica ativa para publicar.'
      using errcode = '22023';
  end if;

  for v_categoria in
    select c.id, c.nome, d.indicado_id as desempate_vencedor_id,
      coalesce(nullif(pg_catalog.btrim(c.regra_desempate), ''),
        nullif(pg_catalog.btrim(e.criterio_desempate), '')) as regra,
      coalesce(pg_catalog.sum(a.votos_site + a.votos_instagram), 0) as votos
    from public.melhores_categorias c
    join public.melhores_edicoes e on e.id = c.edicao_id
    left join public.melhores_desempates d
      on d.categoria_id = c.id and d.edicao_id = c.edicao_id
    left join public.melhores_apuracao_previa a
      on a.categoria_id = c.id and a.edicao_id = c.edicao_id
    where c.edicao_id = p_edicao and c.status = 'ativo'
      and c.visibilidade_publica = true
    group by c.id, c.nome, d.indicado_id,
      c.regra_desempate, e.criterio_desempate
  loop
    if v_categoria.votos <= 0 then
      raise exception 'A categoria "%" nao possui votos validos para publicar.',
        v_categoria.nome using errcode = '22023';
    end if;

    if (
      select pg_catalog.count(*)
      from public.melhores_apuracao_previa a
      where a.edicao_id = p_edicao and a.categoria_id = v_categoria.id
        and a.pontuacao_final = (
          select pg_catalog.max(b.pontuacao_final)
          from public.melhores_apuracao_previa b
          where b.edicao_id = p_edicao and b.categoria_id = v_categoria.id
        )
    ) > 1 then
      if v_categoria.desempate_vencedor_id is null
         or v_categoria.regra is null
         or not exists (
           select 1 from public.melhores_apuracao_previa a
           where a.edicao_id = p_edicao and a.categoria_id = v_categoria.id
             and a.indicado_id = v_categoria.desempate_vencedor_id
             and a.pontuacao_final = (
               select pg_catalog.max(b.pontuacao_final)
               from public.melhores_apuracao_previa b
               where b.edicao_id = p_edicao and b.categoria_id = v_categoria.id
             )
         ) then
        raise exception 'Empate na categoria "%": escolha um indicado empatado e registre a regra de desempate.',
          v_categoria.nome using errcode = '22023';
      end if;
    end if;
  end loop;

  -- Resultados antigos ainda nao publicados podem ser recalculados. Uma vez
  -- publicados, os triggers acima impedem qualquer substituicao do snapshot.
  delete from public.melhores_resultados where edicao_id = p_edicao;

  insert into public.melhores_resultados (
    edicao_id, categoria_id, indicado_id, votos_site, percentual_site,
    votos_instagram, percentual_instagram, peso_site, peso_instagram,
    pontuacao_final, colocacao, vencedor, selo, empate, criterio_aplicado,
    metodologia_resumida, publicado, publicado_por, publicado_em
  )
  with classificados as (
    select a.*, d.indicado_id as desempate_vencedor_id,
      coalesce(nullif(pg_catalog.btrim(c.regra_desempate), ''),
        nullif(pg_catalog.btrim(e.criterio_desempate), '')) as regra,
      pg_catalog.max(a.pontuacao_final) over (
        partition by a.categoria_id
      ) as maior_pontuacao,
      pg_catalog.row_number() over (
        partition by a.categoria_id
        order by a.pontuacao_final desc,
          case when a.indicado_id = d.indicado_id then 0 else 1 end,
          a.votos_site desc, a.votos_instagram desc, a.indicado_nome asc
      )::integer as posicao_final
    from public.melhores_apuracao_previa a
    join public.melhores_categorias c on c.id = a.categoria_id
    join public.melhores_edicoes e on e.id = a.edicao_id
    left join public.melhores_desempates d
      on d.categoria_id = c.id and d.edicao_id = c.edicao_id
    where a.edicao_id = p_edicao and c.status = 'ativo'
      and c.visibilidade_publica = true
  )
  select
    a.edicao_id, a.categoria_id, a.indicado_id,
    a.votos_site, a.percentual_site, a.votos_instagram,
    a.percentual_instagram, a.peso_site, a.peso_instagram,
    a.pontuacao_final, a.posicao_final, a.posicao_final = 1,
    case when a.posicao_final = 1 then 'vencedor' else 'indicado' end,
    a.empate,
    case when a.empate and a.pontuacao_final = a.maior_pontuacao then
      'Desempate registrado: ' || a.regra
    else 'Pontuacao ponderada por percentuais de site e Instagram.' end,
    p_metodologia, false, (select auth.uid()), null
  from classificados a;

  get diagnostics v_count = row_count;

  insert into premios_privado.agendamentos(edicao_id, divulgar_em, preparado_por, total) values (p_edicao, v_divulgacao, (select auth.uid()), v_count);

  return v_count;
end;
$$;

-- Bloqueia alterações na apuração fechada até a divulgação oficial.
create or replace function premios_privado.proteger_agendamento() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, premios_privado as $$
declare v_edicao uuid; v_agendado timestamptz;
begin
  if tg_table_name='melhores_edicoes' then
    v_edicao := case when tg_op='DELETE' then old.id else new.id end;
  else
    v_edicao := case when tg_op='DELETE' then old.edicao_id else new.edicao_id end;
  end if;
  select divulgar_em into v_agendado from premios_privado.agendamentos where edicao_id=v_edicao and publicado_em is null;
  if tg_op='UPDATE' and tg_table_name<>'melhores_edicoes' then
    if old.edicao_id is distinct from new.edicao_id and exists(select 1 from premios_privado.agendamentos where edicao_id=old.edicao_id and publicado_em is null) then raise exception 'Não é possível mover dados de uma apuração preparada.' using errcode='23514'; end if;
  end if;
  if v_agendado is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_op='UPDATE' and tg_table_name='melhores_resultados' then
    if now()>=v_agendado and old.publicado is false and new.publicado is true
       and (to_jsonb(new)-'publicado'-'publicado_em'-'atualizado_em')=(to_jsonb(old)-'publicado'-'publicado_em'-'atualizado_em') then return new; end if;
  elsif tg_op='UPDATE' and tg_table_name='melhores_edicoes' then
    if now()>=v_agendado and new.status='resultado_publicado' and old.status in ('apuracao','votacao_encerrada')
       and (to_jsonb(new)-'status'-'resultado_publicado_em'-'encerramento_em'-'atualizado_em'-'atualizado_por')=(to_jsonb(old)-'status'-'resultado_publicado_em'-'encerramento_em'-'atualizado_em'-'atualizado_por') then return new; end if;
  end if;
  raise exception 'A apuração está preparada e bloqueada. Cancele o agendamento antes de alterar os dados.' using errcode='23514';
end $$;
revoke all on function premios_privado.proteger_agendamento() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['melhores_edicoes','melhores_categorias','melhores_indicados','melhores_desempates','melhores_votos','melhores_instagram_votos','melhores_resultados'] loop
    execute format('create trigger zz_agendamento_proteger before insert or update or delete on public.%I for each row execute function premios_privado.proteger_agendamento()',t);
  end loop;
end $$;

create or replace function public.melhores_cancelar_agendamento(p_edicao uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,premios_privado as $$
begin
  if (select auth.uid()) is null or not coalesce(public.tem_permissao_admin('melhores','editar'),false) then raise exception 'Sem permissão.' using errcode='42501'; end if;
  perform 1 from public.melhores_edicoes where id=p_edicao for update;
  if not exists(select 1 from premios_privado.agendamentos where edicao_id=p_edicao and publicado_em is null and now()<divulgar_em) then raise exception 'Agendamento não encontrado ou já vencido.'; end if;
  delete from premios_privado.agendamentos where edicao_id=p_edicao;
  delete from public.melhores_resultados where edicao_id=p_edicao and not publicado;
end $$;
revoke all on function public.melhores_cancelar_agendamento(uuid) from public,anon,authenticated;
grant execute on function public.melhores_cancelar_agendamento(uuid) to authenticated;
revoke all on function public.melhores_preparar_resultado_agendado(uuid,text) from public,anon,authenticated;
grant execute on function public.melhores_preparar_resultado_agendado(uuid,text) to authenticated;

create or replace function premios_privado.publicar_agendamentos() returns integer
language plpgsql security definer set search_path=pg_catalog,public,premios_privado as $$
declare a record; v_count integer; v_total integer:=0;
begin
  for a in select * from premios_privado.agendamentos where publicado_em is null and divulgar_em<=now() order by divulgar_em for update skip locked loop
    perform 1 from public.melhores_edicoes where id=a.edicao_id and status in ('apuracao','votacao_encerrada') for update;
    if not found then raise exception 'Edição preparada está em estado incompatível.'; end if;
    update public.melhores_resultados set publicado=true,publicado_em=now() where edicao_id=a.edicao_id and publicado=false;
    get diagnostics v_count=row_count;
    if v_count<>a.total then raise exception 'Quantidade de resultados preparada é divergente.'; end if;
    update public.melhores_edicoes set status='resultado_publicado',resultado_publicado_em=now(),encerramento_em=coalesce(encerramento_em,votacao_fim,now()) where id=a.edicao_id;
    perform public.melhores_consolidar_edicao(a.edicao_id);
    insert into public.melhores_auditoria(edicao_id,usuario_id,acao,entidade,entidade_id,valores_posteriores) values(a.edicao_id,a.preparado_por,'resultado_publicado','melhores_resultados',a.edicao_id,jsonb_build_object('resultados_publicados',v_count,'origem','agendamento'));
    update premios_privado.agendamentos set publicado_em=now() where edicao_id=a.edicao_id;
    v_total:=v_total+1;
  end loop;
  return v_total;
end $$;
revoke all on function premios_privado.publicar_agendamentos() from public,anon,authenticated;

create or replace function public.melhores_consultar_agendamento(p_edicao uuid)
returns table(divulgar_em timestamptz, preparado_em timestamptz, total integer)
language plpgsql security definer set search_path=pg_catalog,public,premios_privado as $$
begin
  if (select auth.uid()) is null or not coalesce(public.tem_permissao_admin('melhores','ler'),false) then raise exception 'Sem permissão.' using errcode='42501'; end if;
  return query select a.divulgar_em,a.preparado_em,a.total from premios_privado.agendamentos a where a.edicao_id=p_edicao and a.publicado_em is null;
end $$;
revoke all on function public.melhores_consultar_agendamento(uuid) from public,anon,authenticated;
grant execute on function public.melhores_consultar_agendamento(uuid) to authenticated;


-- A edição 2026 respeita a data configurada mesmo por chamadas antigas.
create or replace function public.melhores_2026_impedir_resultado_antecipado()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.publicado is true and exists(select 1 from public.melhores_edicoes e where e.id=new.edicao_id and e.ano=2026 and (e.divulgacao_em is null or clock_timestamp()<e.divulgacao_em)) then
    raise exception 'O resultado de 2026 só pode ser divulgado na data configurada.' using errcode='22023';
  end if;
  return new;
end $$;
revoke all on function public.melhores_2026_impedir_resultado_antecipado() from public,anon,authenticated;

do $$ begin
  if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'pg_cron precisa estar habilitado'; end if;
  if exists(select 1 from cron.job where jobname='melhores-publicacao-agendada') then raise exception 'Já existe uma tarefa com este nome; revisar antes de prosseguir.'; end if;
  perform cron.schedule('melhores-publicacao-agendada','* * * * *','select premios_privado.publicar_agendamentos()');
end $$;

commit;
