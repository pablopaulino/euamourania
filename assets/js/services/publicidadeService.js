import { getSupabase } from "./supabaseClient.js";

const TABELA = "campanhas_publicitarias";

export async function listarCampanhas({ busca = "", status = "", tipo = "", pagina = 1, porPagina = 10 } = {}) {
  const inicio = (pagina - 1) * porPagina;
  let query = getSupabase()
    .from(TABELA)
    .select("*, campanha_posicoes(posicao)", { count: "exact" })
    .order("prioridade", { ascending: false })
    .order("criado_em", { ascending: false })
    .range(inicio, inicio + porPagina - 1);
  if (busca) query = query.or(`nome.ilike.%${busca}%,empresa_anunciante.ilike.%${busca}%`);
  if (status) query = query.eq("status", status);
  if (tipo) query = query.eq("tipo", tipo);
  const { data, error, count } = await query;
  if (error) throw error;
  return { itens: data || [], total: count || 0 };
}

export async function buscarCampanha(id) {
  const { data, error } = await getSupabase().from(TABELA)
    .select("*, campanha_posicoes(posicao)").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function salvarCampanha(campanha, posicoes = []) {
  const cliente = getSupabase();
  const { id, campanha_posicoes, ...dados } = campanha;
  const consulta = id ? cliente.from(TABELA).update(dados).eq("id", id) : cliente.from(TABELA).insert(dados);
  const { data, error } = await consulta.select().single();
  if (error) throw error;

  const { error: erroExcluir } = await cliente.from("campanha_posicoes").delete().eq("campanha_id", data.id);
  if (erroExcluir) throw erroExcluir;
  if (posicoes.length) {
    const { error: erroPosicoes } = await cliente.from("campanha_posicoes")
      .insert([...new Set(posicoes)].map(posicao => ({ campanha_id: data.id, posicao })));
    if (erroPosicoes) throw erroPosicoes;
  }
  return data;
}

export async function excluirCampanha(id) {
  const { error } = await getSupabase().from(TABELA).delete().eq("id", id);
  if (error) throw error;
}

export async function uploadMidia(arquivo, pasta = "campanhas") {
  const extensao = arquivo.name.split(".").pop()?.toLowerCase() || "bin";
  const nome = `${pasta}/${crypto.randomUUID()}.${extensao}`;
  const { error } = await getSupabase().storage.from("publicidade").upload(nome, arquivo, {
    cacheControl: "3600", upsert: false, contentType: arquivo.type
  });
  if (error) throw error;
  return getSupabase().storage.from("publicidade").getPublicUrl(nome).data.publicUrl;
}

export async function obterResumoPublicidade() {
  const { data, error } = await getSupabase().from("publicidade_resumo")
    .select("*").order("criado_em", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function obterMetricasDiarias(dias = 30) {
  const desde = new Date();
  desde.setDate(desde.getDate() - Math.max(1, dias) + 1);
  const { data, error } = await getSupabase().from("publicidade_metricas_diarias")
    .select("dia,impressoes,cliques,campanha_id").gte("dia", desde.toISOString().slice(0, 10)).order("dia");
  if (error) throw error;
  return data || [];
}

export async function listarCampanhasPublicas() {
  const { data, error } = await getSupabase().from(TABELA)
    .select("*, campanha_posicoes(posicao)")
    .eq("status", "ativo")
    .order("prioridade", { ascending: false })
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function registrarEventoPublicidade(campanhaId, tipo) {
  const { error } = await getSupabase().rpc("registrar_evento_publicidade", {
    p_campanha: campanhaId, p_tipo: tipo
  });
  if (error) console.warn("Métrica de publicidade não registrada:", error.message);
}
