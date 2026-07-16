-- Auditoria final do módulo Melhores de Urânia
-- Migração segura/idempotente. Não remove dados existentes.

-- 1) Limite padrão de quatro indicados por categoria.
alter table public.melhores_categorias
  alter column limite_indicados set default 4;

update public.melhores_categorias
set limite_indicados = 4
where limite_indicados is null;

-- 2) Impede mais indicados ativos/aprovados que o limite da categoria.
create or replace function public.melhores_validar_limite_indicados()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_limite integer;
  v_total integer;
begin
  if new.status='ativo' and coalesce(new.aprovado,false)=true then
    select coalesce(limite_indicados,4)
      into v_limite
      from public.melhores_categorias
      where id=new.categoria_id and edicao_id=new.edicao_id;

    if v_limite is null then v_limite := 4; end if;

    select count(*)
      into v_total
      from public.melhores_indicados
      where edicao_id=new.edicao_id
        and categoria_id=new.categoria_id
        and status='ativo'
        and aprovado=true
        and id is distinct from new.id;

    if v_total >= v_limite then
      raise exception 'Limite de % indicados ativos/aprovados atingido para esta categoria.', v_limite
        using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists melhores_indicados_limite_indicados on public.melhores_indicados;
create trigger melhores_indicados_limite_indicados
before insert or update of edicao_id,categoria_id,status,aprovado
on public.melhores_indicados
for each row execute function public.melhores_validar_limite_indicados();

-- 3) Retenção: sete dias após a publicação oficial do resultado.
-- Mantém compatibilidade com edições antigas sem resultado_publicado_em usando fallback conservador.
create or replace function public.melhores_limpar_votos_expirados()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_edicao record;
  v_total integer := 0;
begin
  for v_edicao in
    select id
    from public.melhores_edicoes
    where status in('resultado_publicado','arquivada')
      and votos_individuais_limpos_em is null
      and coalesce(resultado_publicado_em, divulgacao_em, encerramento_em, votacao_fim) is not null
      and now() >= coalesce(resultado_publicado_em, divulgacao_em, encerramento_em, votacao_fim) + votos_individuais_remover_apos
  loop
    perform public.melhores_consolidar_edicao(v_edicao.id);

    delete from public.melhores_votos where edicao_id=v_edicao.id;

    update public.melhores_edicoes
    set votos_individuais_limpos_em = now()
    where id=v_edicao.id;

    insert into public.melhores_auditoria(edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores)
    values(v_edicao.id, null, 'limpeza_votos', 'melhores_votos', v_edicao.id,
      jsonb_build_object('retencao','7 dias apos publicacao oficial','executado_em',now()));

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.melhores_limpar_votos_expirados() from public;

-- 4) Limpeza manual exclusiva para Super Admin.
create or replace function public.melhores_limpar_votos_edicao_manual(p_edicao uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  if not public.is_super_admin() then
    raise exception 'Apenas Super Admin pode executar a limpeza manual dos votos.' using errcode='42501';
  end if;

  perform public.melhores_consolidar_edicao(p_edicao);

  delete from public.melhores_votos where edicao_id=p_edicao;
  get diagnostics v_count = row_count;

  update public.melhores_edicoes
  set votos_individuais_limpos_em = now()
  where id=p_edicao;

  insert into public.melhores_auditoria(edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores)
  values(p_edicao, (select auth.uid()), 'limpeza_votos_manual', 'melhores_votos', p_edicao,
    jsonb_build_object('votos_removidos',v_count,'executado_em',now()));

  return v_count;
end;
$$;

revoke all on function public.melhores_limpar_votos_edicao_manual(uuid) from public;
grant execute on function public.melhores_limpar_votos_edicao_manual(uuid) to authenticated;

-- 5) Suporte real a voto único ou múltiplo por categoria.
-- Remove a regra antiga de apenas um voto por categoria e cria proteção contra voto duplicado no mesmo indicado.
drop index if exists public.melhores_votos_um_valido_por_categoria_uidx;

create unique index if not exists melhores_votos_um_valido_por_indicado_uidx
  on public.melhores_votos(edicao_id, categoria_id, indicado_id, identificador_hash)
  where status in('valido','suspeito');
