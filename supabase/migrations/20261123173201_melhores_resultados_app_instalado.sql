-- Compatibilidade com o app que abre a lista de vencedores apenas quando
-- o status da edição embutida na campanha é resultado_publicado.
-- O cabeçalho seleciona a apresentação. A leitura continua sujeita à RLS.
create function public.melhores_edicoes(public.app_melhores_campanhas)
returns setof public.melhores_edicoes
language plpgsql stable security invoker rows 1
set search_path = ''
as $$
declare
  edicao public.melhores_edicoes%rowtype;
  ultima_divulgacao timestamptz;
begin
  select e.* into edicao
  from public.app_melhores_campanhas c
  join public.melhores_edicoes e on e.id = c.edicao_id
  where c.id = $1.id;
  if not found then return; end if;

  if edicao.ano = 2026 and
     (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-client-info') like 'euamourania-app/%' then
    if edicao.status = 'apuracao' and premios_api.melhores_revelacao_campanha_visivel($1.id) then
      select max(r.publicado_em) into ultima_divulgacao
      from public.melhores_listar_resultados_publicos(edicao.id, true) r;
      if ultima_divulgacao is not null then
        edicao.status := 'resultado_publicado';
        edicao.divulgacao_em := ultima_divulgacao;
        edicao.resultado_publicado_em := ultima_divulgacao;
      end if;
    elsif edicao.status = 'resultado_publicado' and edicao.resultado_publicado_em is not null then
      -- A Home do app usa divulgacao_em para escolher o dia do destaque.
      edicao.divulgacao_em := edicao.resultado_publicado_em;
    end if;
  end if;
  return next edicao;
end;
$$;

-- Mesmo uma conta administrativa usando a vitrine móvel recebe apenas as
-- categorias já anunciadas. O painel continua usando a própria permissão.
create function public.app_melhores_vencedores(public.app_melhores_campanhas)
returns setof public.app_melhores_vencedores
language sql stable security invoker
set search_path = ''
as $$
  select w.*
  from public.app_melhores_vencedores w
  where w.campanha_id = $1.id
    and case when
      (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-client-info') like 'euamourania-app/%'
      and exists (
        select 1 from public.app_melhores_campanhas c
        join public.melhores_edicoes e on e.id = c.edicao_id
        where c.id = $1.id and e.ano = 2026 and e.status = 'apuracao'
      )
      then premios_api.melhores_revelacao_app_visivel(w.id)
      else true
    end;
$$;

revoke all on function public.melhores_edicoes(public.app_melhores_campanhas),
  public.app_melhores_vencedores(public.app_melhores_campanhas) from public;
grant execute on function public.melhores_edicoes(public.app_melhores_campanhas),
  public.app_melhores_vencedores(public.app_melhores_campanhas) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
