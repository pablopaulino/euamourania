import { fetchPublicRows } from "./publicDataService.js";

const statusPublicos = [
  "indicacoes_abertas",
  "votacao_aberta",
  "votacao_encerrada",
  "resultado_publicado",
  "arquivada"
];

export async function listarEdicoesPublicas() {
  const status = statusPublicos.join(",");
  return fetchPublicRows("melhores_edicoes", {
    select: "id,nome,ano,slug,descricao,imagem_capa_url,status,indicacoes_inicio,indicacoes_fim,votacao_inicio,votacao_fim,divulgacao_em,peso_site,peso_instagram,mostrar_votos_publicamente",
    status: `in.(${status})`,
    order: "ano.desc"
  }, { ttl: 120000 });
}

export async function obterEdicaoPorAno(ano) {
  const rows = await fetchPublicRows("melhores_edicoes", {
    select: "*",
    ano: `eq.${ano}`,
    limit: "1"
  }, { ttl: 60000 });
  return rows?.[0] || null;
}

export async function listarCategoriasPublicas(edicaoId) {
  return fetchPublicRows("melhores_categorias", {
    select: "id,edicao_id,nome,slug,descricao,imagem_url,icone,ordem,status,permite_multiplos_votos,max_escolhas,permite_indicacao_publica,visibilidade_publica",
    edicao_id: `eq.${edicaoId}`,
    status: "eq.ativo",
    visibilidade_publica: "eq.true",
    order: "ordem.asc,nome.asc"
  }, { ttl: 60000 });
}

export async function listarIndicadosPublicos(edicaoId) {
  return fetchPublicRows("melhores_indicados", {
    select: "id,edicao_id,categoria_id,nome,slug,imagem_url,descricao_curta,instagram,whatsapp,site,endereco,status,ordem,aprovado",
    edicao_id: `eq.${edicaoId}`,
    status: "eq.ativo",
    aprovado: "eq.true",
    order: "ordem.asc,nome.asc"
  }, { ttl: 60000 });
}

export async function listarResultadosPublicos(edicaoId) {
  return fetchPublicRows("melhores_resultados", {
    select: "id,edicao_id,categoria_id,indicado_id,votos_site,percentual_site,votos_instagram,percentual_instagram,pontuacao_final,colocacao,vencedor,selo,empate,criterio_aplicado,metodologia_resumida,publicado_em,melhores_categorias(nome),melhores_indicados(nome,imagem_url,descricao_curta)",
    edicao_id: `eq.${edicaoId}`,
    publicado: "eq.true",
    order: "categoria_id.asc,colocacao.asc"
  }, { ttl: 120000 });
}

export async function enviarVotoMelhores(payload) {
  const response = await fetch("/api/melhores-votar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "omit",
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || "Não foi possível registrar seu voto agora.");
  }
  return data;
}

export async function enviarIndicacaoMelhores(payload) {
  const response = await fetch("/api/melhores-indicar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "omit",
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || "Não foi possível enviar sua indicação agora.");
  }
  return data;
}
