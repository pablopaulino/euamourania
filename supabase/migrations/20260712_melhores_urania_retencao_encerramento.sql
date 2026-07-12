-- Eu Amo Urania - Melhores de Urania
-- Ajuste seguro: prioriza encerramento_em/votacao_fim para contar os 7 dias
-- de retencao dos votos individuais.

begin;

create or replace function public.melhores_limpar_votos_expirados()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_edicao record;
  v_total integer := 0;
  v_removidos integer := 0;
begin
  for v_edicao in
    select *
    from public.melhores_edicoes
    where status in('resultado_publicado','arquivada')
      and votos_individuais_removidos_em is null
      and coalesce(encerramento_em, votacao_fim, resultado_publicado_em, divulgacao_em) is not null
      and now() >= coalesce(encerramento_em, votacao_fim, resultado_publicado_em, divulgacao_em) + votos_individuais_remover_apos
  loop
    perform public.melhores_consolidar_edicao(v_edicao.id);

    delete from public.melhores_votos where edicao_id=v_edicao.id;
    get diagnostics v_removidos = row_count;
    v_total := v_total + v_removidos;

    update public.melhores_edicoes
    set votos_individuais_removidos_em=now()
    where id=v_edicao.id;

    insert into public.melhores_auditoria(edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores)
    values(v_edicao.id, null, 'limpeza_votos', 'melhores_votos', v_edicao.id,
      jsonb_build_object('votos_removidos', v_removidos, 'limpo_em', now()));
  end loop;
  return v_total;
end;
$$;

revoke all on function public.melhores_limpar_votos_expirados() from public;

commit;
