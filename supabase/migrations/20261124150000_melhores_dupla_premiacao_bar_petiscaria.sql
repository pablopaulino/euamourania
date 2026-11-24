-- Migration: 20261124150000_melhores_dupla_premiacao_bar_petiscaria.sql
-- Oficializa a dupla premiação de Melhor Petiscaria e Melhor Bar ou Boteco na Edição 2026.
-- Ambos agendados para revelação simultânea hoje às 20:00:00 (horário de Brasília).

begin;

-- Desativa apenas as travas de segurança da apuração e vitrine (sem tocar em triggers de sistema)
alter table public.melhores_resultados disable trigger zz_agendamento_proteger;
alter table public.melhores_indicados disable trigger zz_agendamento_proteger;
alter table public.melhores_categorias disable trigger zz_agendamento_proteger;
alter table public.app_melhores_vencedores disable trigger zz_revelacao_proteger;

do $$
declare
  v_edicao uuid := '1fabb9db-4995-4089-9df6-b8f3d437839c';
  v_campanha uuid := '53a1de19-7973-4c10-aa2f-c49b810cec2f';
  v_categoria_bar uuid := 'bc813112-96bd-4640-bff7-e2907f652021';
  v_categoria_petiscaria uuid;
  v_resultado_petiscaria uuid;
  v_indicado_petiscaria_antigo uuid;
  v_novo_indicado_petiscaria uuid;
  v_resultado_bar uuid;
  v_indicado_bar uuid;
begin
  -- Localiza Petiscaria Majé na apuração
  select r.id, r.indicado_id into v_resultado_petiscaria, v_indicado_petiscaria_antigo
  from public.melhores_resultados r
  join public.melhores_indicados i on i.id = r.indicado_id
  where r.edicao_id = v_edicao and r.categoria_id = v_categoria_bar 
    and (i.slug = 'petiscaria-maje' or i.nome ilike '%Petiscaria Majé%');

  -- Localiza o bar que ficou em primeiro lugar entre os bares
  select r.id, r.indicado_id into v_resultado_bar, v_indicado_bar
  from public.melhores_resultados r
  where r.edicao_id = v_edicao and r.categoria_id = v_categoria_bar 
    and r.id <> v_resultado_petiscaria
  order by r.colocacao asc
  limit 1;

  if v_resultado_petiscaria is null or v_resultado_bar is null then
    raise exception 'Resultados de Petiscaria ou Bar não encontrados para readequação.';
  end if;

  -- 1. Cria a categoria "Melhor Petiscaria" na edição 2026 caso ainda não exista
  select id into v_categoria_petiscaria 
  from public.melhores_categorias 
  where edicao_id = v_edicao and (nome = 'Melhor Petiscaria' or slug = 'melhor-petiscaria');

  if v_categoria_petiscaria is null then
    insert into public.melhores_categorias (id, edicao_id, nome, slug, status, visibilidade_publica, ordem)
    values (gen_random_uuid(), v_edicao, 'Melhor Petiscaria', 'melhor-petiscaria', 'ativo', true, 22)
    returning id into v_categoria_petiscaria;
  end if;

  -- 2. Cria o registro do indicado Petiscaria Majé na nova categoria
  select id into v_novo_indicado_petiscaria
  from public.melhores_indicados
  where edicao_id = v_edicao and categoria_id = v_categoria_petiscaria and slug = 'petiscaria-maje';

  if v_novo_indicado_petiscaria is null then
    insert into public.melhores_indicados (
      edicao_id, categoria_id, guia_comercial_id, nome, slug, imagem_url,
      descricao_curta, descricao_completa, instagram, whatsapp, site, endereco, status, aprovado
    )
    select
      v_edicao, v_categoria_petiscaria, guia_comercial_id, nome, slug, imagem_url,
      'Reconhecimento oficial como Melhor Petiscaria de Urânia 2026.',
      descricao_completa, instagram, whatsapp, site, endereco, 'ativo', true
    from public.melhores_indicados
    where id = v_indicado_petiscaria_antigo
    returning id into v_novo_indicado_petiscaria;
  end if;

  -- Inativa o indicado antigo na categoria mista
  update public.melhores_indicados
  set status = 'inativo'
  where id = v_indicado_petiscaria_antigo;

  -- 3. Atualiza o resultado da Petiscaria Majé para a nova categoria (1º Lugar e Vencedor)
  update public.melhores_resultados
  set categoria_id = v_categoria_petiscaria,
      indicado_id = v_novo_indicado_petiscaria,
      colocacao = 1,
      vencedor = true,
      selo = 'Vencedor 2026',
      criterio_aplicado = 'Reconhecimento oficial como Melhor Petiscaria 2026 (readequação técnica da comissão organizadora).'
  where id = v_resultado_petiscaria;

  -- 4. Promove o Bar a 1º Lugar e Vencedor de "Melhor Bar ou Boteco"
  update public.melhores_resultados
  set colocacao = 1,
      vencedor = true,
      selo = 'Vencedor 2026',
      criterio_aplicado = 'Vencedor oficial na categoria Melhor Bar ou Boteco 2026.'
  where id = v_resultado_bar;

  -- Reordena os demais indicados de Bar ou Boteco (3º vira 2º, etc.)
  update public.melhores_resultados
  set colocacao = colocacao - 1
  where edicao_id = v_edicao and categoria_id = v_categoria_bar 
    and id not in (v_resultado_petiscaria, v_resultado_bar)
    and colocacao > 1;

  -- 5. Agenda a revelação de "Melhor Petiscaria" para HOJE às 20h (junto com Bar ou Boteco)
  insert into premios_privado.revelacoes (edicao_id, categoria_id, publicar_em)
  values (v_edicao, v_categoria_petiscaria, timestamptz '2026-11-24 20:00:00-03')
  on conflict (edicao_id, categoria_id) do update set publicar_em = excluded.publicar_em;

  -- 6. Atualiza a vitrine do aplicativo para a Petiscaria Majé
  update public.app_melhores_vencedores
  set categoria_id = v_categoria_petiscaria,
      indicado_id = v_novo_indicado_petiscaria,
      categoria_nome = 'Melhor Petiscaria',
      descricao_curta = coalesce(descricao_curta, 'Reconhecimento oficial como Melhor Petiscaria de Urânia 2026.')
  where resultado_id = v_resultado_petiscaria;

  -- 7. Adiciona o Bar vencedor na vitrine do aplicativo
  if not exists (select 1 from public.app_melhores_vencedores where resultado_id = v_resultado_bar) then
    insert into public.app_melhores_vencedores (
      campanha_id, resultado_id, categoria_id, indicado_id, guia_comercial_id,
      categoria_nome, nome_exibido, imagem_url, descricao_curta, selo, ordem,
      instagram, whatsapp, site, endereco, status, origem
    )
    select
      v_campanha,
      r.id,
      c.id,
      i.id,
      i.guia_comercial_id,
      c.nome,
      i.nome,
      coalesce(i.imagem_url, g.imagem_url),
      coalesce(i.descricao_curta, g.descricao, 'Vencedor oficial na categoria Melhor Bar ou Boteco 2026.'),
      'Vencedor 2026',
      6,
      coalesce(i.instagram, g.instagram),
      coalesce(i.whatsapp, g.whatsapp),
      coalesce(i.site, g.site),
      coalesce(i.endereco, g.endereco),
      'ativo',
      'resultado_oficial'
    from public.melhores_resultados r
    join public.melhores_categorias c on c.id = r.categoria_id
    join public.melhores_indicados i on i.id = r.indicado_id
    left join public.guia_comercial g on g.id = i.guia_comercial_id and g.status = 'publicado'
    where r.id = v_resultado_bar;
  end if;

end $$;

-- Reativa as travas de segurança da apuração e vitrine
alter table public.melhores_resultados enable trigger zz_agendamento_proteger;
alter table public.melhores_indicados enable trigger zz_agendamento_proteger;
alter table public.melhores_categorias enable trigger zz_agendamento_proteger;
alter table public.app_melhores_vencedores enable trigger zz_revelacao_proteger;

commit;
