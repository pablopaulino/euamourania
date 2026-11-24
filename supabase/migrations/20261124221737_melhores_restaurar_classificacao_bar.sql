-- Correção editorial anterior ao anúncio. A auditoria da separação é a fonte da classificação.
begin;
set local lock_timeout = '5s';

-- Os bloqueios destas quatro tabelas duram até o commit. Auditoria e integridade referencial continuam ativas.
alter table public.melhores_resultados disable trigger zz_agendamento_proteger;
alter table public.melhores_indicados disable trigger zz_agendamento_proteger;
alter table public.melhores_categorias disable trigger zz_agendamento_proteger;
alter table public.app_melhores_vencedores disable trigger zz_revelacao_proteger;

do $correcao$
declare
  edicao constant uuid := '1fabb9db-4995-4089-9df6-b8f3d437839c';
  bar constant uuid := 'bc813112-96bd-4640-bff7-e2907f652021';
  mencao constant text := '“Destaque em Petiscaria”';
  extra uuid;
  campanha uuid;
  alteracao timestamptz;
  original uuid;
  copia uuid;
  primeiro uuid;
  horario timestamptz;
  n integer;
begin
  select id into strict extra from public.melhores_categorias
    where edicao_id=edicao and slug='melhor-petiscaria';
  select campanha_id into strict campanha from premios_privado.revelacao_campanhas where edicao_id=edicao;
  select publicar_em into strict horario from premios_privado.revelacoes
    where edicao_id=edicao and categoria_id=bar for update;
  select criado_em, entidade_id, (valores_anteriores->>'indicado_id')::uuid, (valores_posteriores->>'indicado_id')::uuid
    into strict alteracao, primeiro, original, copia from public.melhores_auditoria
    where edicao_id=edicao and entidade='melhores_resultados' and acao='update'
      and valores_anteriores->>'categoria_id'=bar::text and valores_posteriores->>'categoria_id'=extra::text
      and valores_anteriores->>'colocacao'='1' and valores_anteriores->>'vencedor'='true';

  -- Permite a reaplicação da migração depois de uma implantação já concluída.
  if exists(select 1 from public.melhores_resultados where id=primeiro and categoria_id=bar
      and indicado_id=original and vencedor and selo=mencao)
    and not exists(select 1 from premios_privado.revelacoes where edicao_id=edicao and categoria_id=extra)
    then return; end if;
  if clock_timestamp()>=horario or not exists(select 1 from premios_privado.revelacoes
      where edicao_id=edicao and categoria_id=extra and publicar_em=horario)
    or not exists(select 1 from public.melhores_edicoes where id=edicao and status='apuracao')
    then raise exception 'Correção permitida apenas antes do anúncio agendado das duas categorias.'; end if;

  -- Remove somente o cartão inserido pela separação. Seu lugar é ocupado pelo cartão original.
  delete from public.app_melhores_vencedores w using public.melhores_auditoria a
    where a.criado_em=alteracao and a.entidade='app_melhores_vencedores' and a.acao='insert'
      and w.id=a.entidade_id and w.campanha_id=campanha and w.categoria_id=bar;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Cartão adicional inesperado.'; end if;

  update public.melhores_resultados r set
    categoria_id=bar, indicado_id=(a.valores_anteriores->>'indicado_id')::uuid,
    colocacao=(a.valores_anteriores->>'colocacao')::integer, vencedor=(a.valores_anteriores->>'vencedor')::boolean,
    selo=case when r.id=primeiro then mencao else a.valores_anteriores->>'selo' end,
    criterio_aplicado=a.valores_anteriores->>'criterio_aplicado'
  from public.melhores_auditoria a where a.entidade='melhores_resultados' and a.acao='update'
    and a.criado_em=alteracao and a.valores_anteriores->>'categoria_id'=bar::text
    and a.entidade_id=r.id and r.edicao_id=edicao and not r.publicado
    and r.categoria_id::text=a.valores_posteriores->>'categoria_id'
    and r.indicado_id::text=a.valores_posteriores->>'indicado_id'
    and r.colocacao::text=a.valores_posteriores->>'colocacao'
    and r.vencedor=(a.valores_posteriores->>'vencedor')::boolean;
  get diagnostics n=row_count;
  if n<>4 then raise exception 'A classificação diverge dos quatro registros auditados.'; end if;

  update public.melhores_indicados set status='ativo' where id=original and edicao_id=edicao and categoria_id=bar;
  update public.melhores_indicados set status='inativo', aprovado=false where id=copia and edicao_id=edicao and categoria_id=extra;
  update public.melhores_categorias set status='arquivado',visibilidade_publica=false where id=extra and edicao_id=edicao;
  delete from premios_privado.revelacoes where edicao_id=edicao and categoria_id=extra;
  update public.app_melhores_vencedores w set categoria_id=bar, indicado_id=original,
    categoria_nome=a.valores_anteriores->>'categoria_nome', selo=mencao, descricao_curta=mencao
    from public.melhores_auditoria a where a.criado_em=alteracao and a.entidade='app_melhores_vencedores'
      and a.acao='update' and a.entidade_id=w.id and w.campanha_id=campanha and w.resultado_id=primeiro and w.categoria_id=extra;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'O cartão original da campanha não foi restaurado.'; end if;
  if (select count(*) from public.melhores_resultados where edicao_id=edicao and categoria_id in (bar,extra) and vencedor)<>1
    or exists(select 1 from public.melhores_resultados where edicao_id=edicao and categoria_id=extra)
    or not exists(select 1 from public.melhores_resultados r join public.melhores_indicados i on i.id=r.indicado_id
      where r.id=primeiro and r.categoria_id=bar and r.colocacao=1 and r.vencedor and i.status='ativo' and i.aprovado)
    then raise exception 'Falha ao conferir a classificação restaurada.'; end if;
end
$correcao$;

alter table public.app_melhores_vencedores enable trigger zz_revelacao_proteger;
alter table public.melhores_categorias enable trigger zz_agendamento_proteger;
alter table public.melhores_indicados enable trigger zz_agendamento_proteger;
alter table public.melhores_resultados enable trigger zz_agendamento_proteger;
commit;
