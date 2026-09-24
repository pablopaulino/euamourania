-- Inclui imagens de catálogos na proteção da biblioteca existente.
-- Aplicar somente após 20260924_viva_catalogos.sql, com autorização.
begin;
create index catalogo_imagens_url_idx on public.catalogo_produto_imagens(url);

create or replace function public.midia_cms_em_uso(p_url text)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,pg_temp
as $$
  select
    p_url is not null
    and btrim(p_url) <> ''
    and (
      exists(select 1 from public.catalogo_produto_imagens where url=p_url)
      or
      exists(
        select 1
        from public.noticias
        where imagem_url = p_url
          or seo_imagem = p_url
          or position(p_url in coalesce(conteudo_html, '')) > 0
      )
      or exists(
        select 1
        from public.guia_comercial
        where imagem_url = p_url
          or position(p_url in coalesce(galeria_urls::text, '')) > 0
      )
      or exists(
        select 1
        from public.turismo
        where imagem_url = p_url
          or position(p_url in coalesce(galeria_urls::text, '')) > 0
          or position(p_url in coalesce(conteudo_html, '')) > 0
      )
      or exists(
        select 1
        from public.eventos
        where imagem_url = p_url
      )
      or exists(
        select 1
        from public.eventos_principais
        where imagem_capa_url = p_url
          or position(p_url in coalesce(galeria_historica::text, '')) > 0
          or position(p_url in coalesce(historia_html, '')) > 0
      )
      or exists(
        select 1
        from public.eventos_edicoes
        where cartaz_url = p_url
          or banner_url = p_url
          or position(p_url in coalesce(galeria::text, '')) > 0
          or position(p_url in coalesce(patrocinadores::text, '')) > 0
          or position(p_url in coalesce(programacao_html, '')) > 0
          or position(p_url in coalesce(atracoes_html, '')) > 0
          or position(p_url in coalesce(resumo_pos_evento_html, '')) > 0
      )
      or exists(
        select 1
        from public.newsletters
        where imagem_url = p_url
          or position(p_url in coalesce(conteudo_html, '')) > 0
          or position(p_url in coalesce(configuracao_futura::text, '')) > 0
      )
      or exists(
        select 1
        from public.campanhas_publicitarias
        where imagem_url = p_url
          or logo_empresa_url = p_url
          or position(p_url in coalesce(configuracao_futura::text, '')) > 0
      )
      or exists(
        select 1
        from public.melhores_edicoes
        where imagem_capa_url = p_url
          or position(p_url in coalesce(regulamento, '')) > 0
          or position(p_url in coalesce(metodologia, '')) > 0
      )
      or exists(
        select 1
        from public.melhores_categorias
        where imagem_url = p_url
      )
      or exists(
        select 1
        from public.melhores_indicados
        where imagem_url = p_url
          or position(p_url in coalesce(descricao_completa, '')) > 0
      )
      or exists(
        select 1
        from public.app_melhores_vencedores
        where imagem_url = p_url
      )
      or exists(
        select 1
        from public.configuracoes_site
        where valor = p_url
          or position(p_url in coalesce(valor, '')) > 0
      )
    );
$$;

-- A interface chama listar_midias_cms(), que invoca este helper como dono.
-- O helper não é uma RPC pública nem precisa de EXECUTE direto pelos clientes.
revoke all on function public.midia_cms_em_uso(text) from public,anon,authenticated;
alter function public.listar_midias_cms() set search_path=pg_catalog,pg_temp;
revoke all on function public.listar_midias_cms() from public,anon,authenticated;
grant execute on function public.listar_midias_cms() to authenticated;


commit;
