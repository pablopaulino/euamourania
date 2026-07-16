-- Rollback manual da auditoria final do módulo Melhores de Urânia.
-- Execute somente se precisar desfazer as regras novas desta fase.
-- Não restaura votos já limpos manualmente; para isso use backups do Supabase.

drop trigger if exists melhores_indicados_limite_indicados on public.melhores_indicados;
drop function if exists public.melhores_validar_limite_indicados();
drop function if exists public.melhores_limpar_votos_edicao_manual(uuid);

alter table public.melhores_categorias
  alter column limite_indicados drop default;

-- Restaura a retenção anterior baseada em encerramento/votação/publicação.
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
      and coalesce(encerramento_em, votacao_fim, resultado_publicado_em, divulgacao_em) is not null
      and now() >= coalesce(encerramento_em, votacao_fim, resultado_publicado_em, divulgacao_em) + votos_individuais_remover_apos
  loop
    perform public.melhores_consolidar_edicao(v_edicao.id);
    delete from public.melhores_votos where edicao_id=v_edicao.id;
    update public.melhores_edicoes set votos_individuais_limpos_em = now() where id=v_edicao.id;
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.melhores_limpar_votos_expirados() from public;

drop index if exists public.melhores_votos_um_valido_por_indicado_uidx;
create unique index if not exists melhores_votos_um_valido_por_categoria_uidx
  on public.melhores_votos(edicao_id, categoria_id, identificador_hash)
  where status in('valido','suspeito');
