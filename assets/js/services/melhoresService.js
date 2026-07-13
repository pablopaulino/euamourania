import { getSupabase } from "./supabaseClient.js";

const db = () => getSupabase();

async function countRelated(supabase, table, field, id) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(field, id);
  if (error && error.code !== "42P01") throw error;
  return count || 0;
}

export async function obterResumoMelhores() {
  const supabase = db();
  const count = async (table, filters = {}) => {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    Object.entries(filters).forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== "") query = query.eq(field, value);
    });
    const { count: total, error } = await query;
    if (error) throw error;
    return total || 0;
  };
  const countVisibleEditions = async () => {
    const { count: total, error } = await supabase
      .from("melhores_edicoes")
      .select("*", { count: "exact", head: true })
      .neq("status", "arquivada");
    if (error) throw error;
    return total || 0;
  };

  const { data: edicaoAtiva, error: activeError } = await supabase
    .from("melhores_edicoes")
    .select("*")
    .in("status", ["indicacoes_abertas", "votacao_aberta", "apuracao", "resultado_publicado"])
    .order("ano", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) throw activeError;

  const [edicoes, categorias, indicados, ativos, indicacoesPendentes] = await Promise.all([
    countVisibleEditions(),
    count("melhores_categorias", edicaoAtiva?.id ? { edicao_id: edicaoAtiva.id } : {}),
    count("melhores_indicados", edicaoAtiva?.id ? { edicao_id: edicaoAtiva.id } : {}),
    count("melhores_indicados", edicaoAtiva?.id ? { edicao_id: edicaoAtiva.id, status: "ativo" } : { status: "ativo" }),
    count("melhores_indicacoes", edicaoAtiva?.id ? { edicao_id: edicaoAtiva.id, status: "pendente" } : { status: "pendente" })
  ]);

  return { edicaoAtiva, edicoes, categorias, indicados, indicadosAtivos: ativos, indicacoesPendentes };
}

export async function obterAudienciaMelhores({ edicaoId = "", dias = 30 } = {}) {
  const supabase = db();
  const since = new Date(Date.now() - Number(dias || 30) * 24 * 60 * 60 * 1000).toISOString();
  const eventTypes = [
    "melhores_index_view",
    "melhores_edition_view",
    "melhores_results_view",
    "melhores_vote_start",
    "melhores_vote_complete",
    "melhores_vote_abandon",
    "melhores_vote_error",
    "melhores_category_view",
    "melhores_nominee_impression",
    "melhores_indication_start",
    "melhores_indication_complete",
    "melhores_indication_error",
    "melhores_share_click",
    "melhores_cta_click"
  ];
  let query = supabase
    .from("analytics_eventos")
    .select("tipo,pagina,destino,dispositivo,origem,criado_em,recurso_id,metadados")
    .in("tipo", eventTypes)
    .gte("criado_em", since)
    .order("criado_em", { ascending: false })
    .limit(2500);
  if (edicaoId) query = query.eq("recurso_id", edicaoId);
  const { data, error } = await query;
  if (error) throw error;
  const eventos = data || [];
  const countType = tipo => eventos.filter(item => item.tipo === tipo).length;
  const views = eventos.filter(item => item.tipo.endsWith("_view")).length;
  const voteStart = countType("melhores_vote_start");
  const voteComplete = countType("melhores_vote_complete");
  const completionRate = voteStart ? Math.round((voteComplete / voteStart) * 1000) / 10 : 0;
  const group = field => Object.entries(eventos.reduce((acc, item) => {
    const key = item[field] || "Não informado";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, total]) => ({ label, total }));
  const pages = Object.entries(eventos.reduce((acc, item) => {
    const key = item.pagina || "/";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([pagina, total]) => ({ pagina, total }));
  const daily = Object.entries(eventos.reduce((acc, item) => {
    const key = new Date(item.criado_em).toLocaleDateString("pt-BR");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).reverse().slice(-14).map(([dia, total]) => ({ dia, total }));
  return {
    periodoDias: Number(dias || 30),
    total: eventos.length,
    views,
    voteStart,
    voteComplete,
    voteAbandon: countType("melhores_vote_abandon"),
    voteError: countType("melhores_vote_error"),
    indications: countType("melhores_indication_complete"),
    shares: countType("melhores_share_click"),
    ctas: countType("melhores_cta_click"),
    completionRate,
    byDevice: group("dispositivo"),
    byOrigin: group("origem"),
    pages,
    daily
  };
}

export async function listarEdicoes() {
  const { data, error } = await db()
    .from("melhores_edicoes")
    .select("*")
    .neq("status", "arquivada")
    .order("ano", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function salvarEdicao(payload) {
  const { id, ...dados } = payload;
  const query = id
    ? db().from("melhores_edicoes").update(dados).eq("id", id)
    : db().from("melhores_edicoes").insert(dados);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function excluirEdicao(id) {
  const supabase = db();
  await supabase.from("melhores_indicacoes").update({ indicado_gerado_id: null }).eq("edicao_id", id);
  const { error } = await supabase.from("melhores_edicoes").delete().eq("id", id);
  if (error) throw error;
}

export async function listarCategorias(edicaoId) {
  let query = db()
    .from("melhores_categorias")
    .select("*, melhores_edicoes(ano,nome)")
    .neq("status", "arquivado")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (edicaoId) query = query.eq("edicao_id", edicaoId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function salvarCategoria(payload) {
  const { id, ...dados } = payload;
  const query = id
    ? db().from("melhores_categorias").update(dados).eq("id", id)
    : db().from("melhores_categorias").insert(dados);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function excluirCategoria(id) {
  const supabase = db();
  await supabase.from("melhores_indicacoes").update({ indicado_gerado_id: null }).eq("categoria_id", id);
  const { error } = await supabase.from("melhores_categorias").delete().eq("id", id);
  if (error) throw error;
}

export async function listarIndicados({ edicaoId, categoriaId } = {}) {
  let query = db()
    .from("melhores_indicados")
    .select("*, melhores_edicoes(ano,nome), melhores_categorias(nome), guia_comercial(nome,imagem_url,whatsapp,instagram,endereco)")
    .neq("status", "arquivado")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (edicaoId) query = query.eq("edicao_id", edicaoId);
  if (categoriaId) query = query.eq("categoria_id", categoriaId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function salvarIndicado(payload) {
  const { id, ...dados } = payload;
  const query = id
    ? db().from("melhores_indicados").update(dados).eq("id", id)
    : db().from("melhores_indicados").insert(dados);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function excluirIndicado(id) {
  const supabase = db();
  await supabase.from("melhores_indicacoes").update({ indicado_gerado_id: null }).eq("indicado_gerado_id", id);
  const { error } = await supabase.from("melhores_indicados").delete().eq("id", id);
  if (error) throw error;
}

export async function listarIndicacoes({ edicaoId, status } = {}) {
  let query = db()
    .from("melhores_indicacoes")
    .select("*, melhores_edicoes(ano,nome), melhores_categorias(nome), melhores_indicados(nome)")
    .order("criado_em", { ascending: false });
  if (edicaoId) query = query.eq("edicao_id", edicaoId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function moderarIndicacao(id, payload) {
  const { data: auth } = await db().auth.getUser();
  const { data, error } = await db()
    .from("melhores_indicacoes")
    .update({
      ...payload,
      moderado_por: auth?.user?.id || null,
      moderado_em: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function excluirIndicacao(id) {
  const { error } = await db().from("melhores_indicacoes").delete().eq("id", id);
  if (error) throw error;
}

export async function listarGuiaComercial() {
  const { data, error } = await db()
    .from("guia_comercial")
    .select("id,nome,imagem_url,whatsapp,instagram,site,endereco,descricao,status")
    .order("nome", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listarInstagramVotos(edicaoId) {
  let query = db()
    .from("melhores_instagram_votos")
    .select("*, melhores_categorias(nome), melhores_indicados(nome)")
    .order("criado_em", { ascending: false });
  if (edicaoId) query = query.eq("edicao_id", edicaoId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function salvarInstagramVoto(payload) {
  const { data, error } = await db()
    .from("melhores_instagram_votos")
    .upsert(payload, { onConflict: "edicao_id,categoria_id,indicado_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function excluirInstagramVoto(id) {
  const { error } = await db().from("melhores_instagram_votos").delete().eq("id", id);
  if (error) throw error;
}

export async function obterApuracao(edicaoId) {
  const { data, error } = await db().rpc("melhores_obter_apuracao", { p_edicao: edicaoId });
  if (error) throw error;
  return data || [];
}

export async function publicarResultado(edicaoId, metodologia) {
  const { data, error } = await db().rpc("melhores_publicar_resultado", {
    p_edicao: edicaoId,
    p_metodologia: metodologia || null
  });
  if (error) throw error;
  return data;
}

export async function listarResultados(edicaoId) {
  let query = db()
    .from("melhores_resultados")
    .select("*, melhores_categorias(nome), melhores_indicados(nome,imagem_url)")
    .order("colocacao", { ascending: true });
  if (edicaoId) query = query.eq("edicao_id", edicaoId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listarVotos({ edicaoId, status } = {}) {
  let query = db()
    .from("melhores_votos")
    .select("id,edicao_id,categoria_id,indicado_id,origem,status,motivo_bloqueio,criado_em,melhores_categorias(nome),melhores_indicados(nome)")
    .order("criado_em", { ascending: false })
    .limit(300);
  if (edicaoId) query = query.eq("edicao_id", edicaoId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listarAuditoria(edicaoId) {
  let query = db()
    .from("melhores_auditoria")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(300);
  if (edicaoId) query = query.eq("edicao_id", edicaoId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function limparVotosManual(edicaoId) {
  const { data, error } = await db().rpc("melhores_limpar_votos_edicao_manual", { p_edicao: edicaoId });
  if (error) throw error;
  return data;
}

function appTablesMissing(error) {
  return error?.code === "42P01" || error?.code === "PGRST106" || error?.code === "PGRST205" || /app_melhores_/i.test(error?.message || "");
}

export async function listarCampanhasApp() {
  const { data, error } = await db()
    .from("app_melhores_campanhas")
    .select("*, melhores_edicoes(id,nome,ano,status,resultado_publicado_em,divulgacao_em)")
    .neq("status", "arquivada")
    .order("ordem_home", { ascending: true })
    .order("criado_em", { ascending: false });
  if (error) {
    if (appTablesMissing(error)) return [];
    throw error;
  }
  return data || [];
}

export async function obterCampanhaApp(id) {
  const { data, error } = await db()
    .from("app_melhores_campanhas")
    .select("*, melhores_edicoes(id,nome,ano,status,resultado_publicado_em,divulgacao_em)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (appTablesMissing(error)) return null;
    throw error;
  }
  return data;
}

export async function salvarCampanhaApp(payload) {
  const { id, ...dados } = payload;
  const query = id
    ? db().from("app_melhores_campanhas").update(dados).eq("id", id)
    : db().from("app_melhores_campanhas").insert(dados);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function listarVencedoresApp(campanhaId) {
  if (!campanhaId) return [];
  const { data, error } = await db()
    .from("app_melhores_vencedores")
    .select("*, melhores_categorias(id,nome), melhores_indicados(id,nome), guia_comercial(id,nome,slug,imagem_url,categoria_nome,status)")
    .eq("campanha_id", campanhaId)
    .neq("status", "arquivado")
    .order("ordem", { ascending: true })
    .order("categoria_nome", { ascending: true });
  if (error) {
    if (appTablesMissing(error)) return [];
    throw error;
  }
  return data || [];
}

export async function salvarVencedorApp(payload) {
  const { id, ...dados } = payload;
  const query = id
    ? db().from("app_melhores_vencedores").update(dados).eq("id", id)
    : db().from("app_melhores_vencedores").insert(dados);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function arquivarVencedorApp(id) {
  const { error } = await db()
    .from("app_melhores_vencedores")
    .update({ status: "arquivado" })
    .eq("id", id);
  if (error) throw error;
}

export async function listarResultadosPublicadosEdicao(edicaoId) {
  if (!edicaoId) return [];
  const { data, error } = await db()
    .from("melhores_resultados")
    .select("*, melhores_categorias(id,nome), melhores_indicados(id,nome,imagem_url,descricao_curta,instagram,whatsapp,site,endereco,guia_comercial_id,guia_comercial(id,nome,imagem_url,status))")
    .eq("edicao_id", edicaoId)
    .eq("publicado", true)
    .eq("vencedor", true)
    .order("colocacao", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function importarVencedoresApp(campanhaId) {
  const { data, error } = await db().rpc("app_melhores_importar_vencedores", { p_campanha: campanhaId });
  if (error) throw error;
  return data || 0;
}
