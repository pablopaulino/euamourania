import { getSupabase } from "./supabaseClient.js";

const db = () => getSupabase();

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

  const { data: edicaoAtiva, error: activeError } = await supabase
    .from("melhores_edicoes")
    .select("*")
    .in("status", ["indicacoes_abertas", "votacao_aberta", "apuracao", "resultado_publicado"])
    .order("ano", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) throw activeError;

  const [edicoes, categorias, indicados, ativos, indicacoesPendentes] = await Promise.all([
    count("melhores_edicoes"),
    count("melhores_categorias", edicaoAtiva?.id ? { edicao_id: edicaoAtiva.id } : {}),
    count("melhores_indicados", edicaoAtiva?.id ? { edicao_id: edicaoAtiva.id } : {}),
    count("melhores_indicados", edicaoAtiva?.id ? { edicao_id: edicaoAtiva.id, status: "ativo" } : { status: "ativo" }),
    count("melhores_indicacoes", edicaoAtiva?.id ? { edicao_id: edicaoAtiva.id, status: "pendente" } : { status: "pendente" })
  ]);

  return { edicaoAtiva, edicoes, categorias, indicados, indicadosAtivos: ativos, indicacoesPendentes };
}

export async function listarEdicoes() {
  const { data, error } = await db()
    .from("melhores_edicoes")
    .select("*")
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
  const { error } = await db().from("melhores_edicoes").delete().eq("id", id);
  if (error) throw error;
}

export async function listarCategorias(edicaoId) {
  let query = db()
    .from("melhores_categorias")
    .select("*, melhores_edicoes(ano,nome)")
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
  const { error } = await db().from("melhores_categorias").delete().eq("id", id);
  if (error) throw error;
}

export async function listarIndicados({ edicaoId, categoriaId } = {}) {
  let query = db()
    .from("melhores_indicados")
    .select("*, melhores_edicoes(ano,nome), melhores_categorias(nome), guia_comercial(nome,imagem_url,whatsapp,instagram,endereco)")
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
  const { error } = await db().from("melhores_indicados").delete().eq("id", id);
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
