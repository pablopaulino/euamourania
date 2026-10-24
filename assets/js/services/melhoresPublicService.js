import { fetchPublicRows } from "./publicDataService.js";

const statusPublicos = [
  "indicacoes_abertas",
  "indicacoes_encerradas",
  "votacao_aberta",
  "votacao_encerrada",
  "apuracao",
  "resultado_publicado",
  "arquivada"
];

export async function listarEdicoesPublicas() {
  const status = statusPublicos.join(",");
  return fetchPublicRows("melhores_edicoes", {
    select: "id,nome,ano,slug,descricao,imagem_capa_url,status,indicacoes_inicio,indicacoes_fim,votacao_inicio,votacao_inicio_site,votacao_fim,divulgacao_em,resultado_publicado_em,peso_site,peso_instagram,mostrar_votos_publicamente",
    status: `in.(${status})`,
    order: "ano.desc"
  }, { ttl: 5000 });
}

export async function obterEdicaoPorAno(ano) {
  const status = statusPublicos.join(",");
  const rows = await fetchPublicRows("melhores_edicoes", {
    select: "*",
    ano: `eq.${ano}`,
    status: `in.(${status})`,
    limit: "1"
  }, { ttl: 5000 });
  return rows?.[0] || null;
}

export async function listarCategoriasPublicas(edicaoId) {
  return fetchPublicRows("melhores_categorias", {
    select: "id,edicao_id,nome,slug,descricao,imagem_url,icone,ordem,status,permite_multiplos_votos,max_escolhas,permite_indicacao_publica,visibilidade_publica",
    edicao_id: `eq.${edicaoId}`,
    order: "ordem.asc,nome.asc"
  }, { ttl: 60000 });
}

export async function listarIndicadosPublicos(edicaoId) {
  return fetchPublicRows("melhores_indicados", {
    select: "id,edicao_id,categoria_id,nome,slug,imagem_url,descricao_curta,instagram,whatsapp,site,endereco,status,ordem,aprovado",
    edicao_id: `eq.${edicaoId}`,
    order: "ordem.asc,nome.asc"
  }, { ttl: 60000 });
}

export async function obterCategoriaPublica(edicaoId, slug) {
  const rows = await fetchPublicRows("melhores_categorias", {
    select: "id,edicao_id,nome,slug,descricao,imagem_url,icone,ordem,status,permite_multiplos_votos,max_escolhas,permite_indicacao_publica,visibilidade_publica",
    edicao_id: `eq.${edicaoId}`,
    slug: `eq.${slug}`,
    limit: "1"
  }, { ttl: 60000 });
  return rows?.[0] || null;
}

export async function listarCategoriasHistoricasPorSlug(slug) {
  return fetchPublicRows("melhores_categorias", {
    select: "id,edicao_id,nome,slug,descricao,imagem_url,icone,ordem,status,visibilidade_publica,atualizado_em,melhores_edicoes!inner(id,nome,ano,slug,descricao,imagem_capa_url,status,atualizado_em)",
    slug: `eq.${slug}`,
    "melhores_edicoes.status": `in.(${statusPublicos.join(",")})`,
    order: "atualizado_em.desc"
  }, { ttl: 60000 });
}

export async function listarIndicadosPorCategoria(edicaoId, categoriaId) {
  return fetchPublicRows("melhores_indicados", {
    select: "id,edicao_id,categoria_id,nome,slug,imagem_url,descricao_curta,instagram,whatsapp,site,endereco,status,ordem,aprovado",
    edicao_id: `eq.${edicaoId}`,
    categoria_id: `eq.${categoriaId}`,
    order: "ordem.asc,nome.asc"
  }, { ttl: 60000 });
}

export async function listarResultadosPublicos(edicaoId) {
  return fetchPublicRows("rpc/melhores_listar_resultados_publicos", {
    p_edicao: edicaoId,
    p_somente_vencedores: "false",
    order: "categoria_id.asc,colocacao.asc"
  }, { ttl: 120000 });
}

export async function listarHistoricoVencedoresPublicos() {
  return fetchPublicRows("rpc/melhores_listar_resultados_publicos", {
    p_somente_vencedores: "true",
    order: "edicao_id.asc,categoria_id.asc"
  }, { ttl: 300000 });
}

export async function enviarVotoMelhores(payload) {
  const response = await fetch("/api/melhores-votar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok !== true || !data?.voto_id) {
    throw new Error(data?.message || (response.ok
      ? "Não foi possível confirmar a resposta. Tente novamente; um voto já salvo não será duplicado."
      : "Não foi possível registrar seu voto agora."));
  }
  return data;
}

export async function consultarPeriodoVotacao(edicaoId) {
  const response = await fetch(`/api/melhores-votar?edicao_id=${encodeURIComponent(edicaoId)}`, {
    credentials: "same-origin", cache: "no-store"
  });
  if (!response.ok) throw new Error("Não foi possível consultar o período de votação.");
  return response.json();
}

export async function enviarIndicacaoMelhores(payload) {
  const response = await fetch("/api/melhores-indicar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || "Não foi possível enviar sua indicação agora.");
  }
  return data;
}
