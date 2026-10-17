-- Totais por origem. Cliques genéricos do Guia que acompanham um clique
-- específico na mesma sessão e instante não são somados novamente.
begin;
create or replace function public.parceiro_totais(p_guia_id uuid,p_dias integer default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_resultado jsonb; v_inicio timestamptz;
begin
  if not exists(select 1 from public.parceiros where user_id=auth.uid() and guia_id=p_guia_id and ativo) then
    raise exception 'Acesso de parceiro negado' using errcode='42501';
  end if;
  if p_dias is not null and p_dias<>30 then raise exception 'Período inválido' using errcode='22023'; end if;
  v_inicio=case when p_dias=30 then now()-interval '30 days' else null end;
  with eventos as (
    select * from public.analytics_eventos where recurso_id=p_guia_id and criado_em<=now()
      and (v_inicio is null or criado_em>=v_inicio-interval '5 seconds')
  ), classificados as (
    select e.*,
      tipo in ('guia_view','home_empresa_impression') as impressao,
      (tipo in ('empresa_whatsapp_click','empresa_phone_click','empresa_map_click','whatsapp_click','instagram_click','external_click')
        or (tipo='share_click' and recurso_tipo='empresa')
        or (tipo='guia_click' and not exists(
          select 1 from eventos c where c.tipo in ('whatsapp_click','instagram_click','external_click')
            and c.sessao_hash is not null and c.sessao_hash=e.sessao_hash
            and abs(extract(epoch from c.criado_em-e.criado_em))<=5
        ))) as clique,
      (tipo like 'empresa_%' or tipo='home_empresa_impression' or (tipo='share_click' and recurso_tipo='empresa')) as app
    from eventos e where v_inicio is null or criado_em>=v_inicio
  )
  select jsonb_build_object(
    'impressoes_total',count(*) filter(where impressao),
    'impressoes_site',count(*) filter(where impressao and not app),
    'impressoes_app',count(*) filter(where impressao and app),
    'cliques_total',count(*) filter(where clique),
    'cliques_site',count(*) filter(where clique and not app),
    'cliques_app',count(*) filter(where clique and app),
    'aberturas_app',count(*) filter(where tipo='empresa_view'),
    'consultado_em',now()
  ) into v_resultado from classificados;
  return v_resultado;
end $$;
revoke all on function public.parceiro_totais(uuid,integer) from public,anon;
grant execute on function public.parceiro_totais(uuid,integer) to authenticated;
commit;
