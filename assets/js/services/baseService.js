import { getSupabase } from "./supabaseClient.js";

export async function listarTabela(tabela, { ordem = "criado_em", crescente = false, filtros = {} } = {}) {
  let query = getSupabase().from(tabela).select("*");
  Object.entries(filtros).forEach(([campo, valor]) => { if (valor !== undefined && valor !== null && valor !== "") query = query.eq(campo, valor); });
  const { data, error } = await query.order(ordem, { ascending: crescente });
  if (error) throw error;
  return data || [];
}

export async function buscarPorCampo(tabela, campo, valor) {
  const { data, error } = await getSupabase().from(tabela).select("*").eq(campo, valor).maybeSingle();
  if (error) throw error;
  return data;
}

export async function salvarRegistro(tabela, registro) {
  const { id, ...dados } = registro;
  const query = id ? getSupabase().from(tabela).update(dados).eq("id", id) : getSupabase().from(tabela).insert(dados);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function excluirRegistro(tabela, id) {
  const { error } = await getSupabase().from(tabela).delete().eq("id", id);
  if (error) throw error;
}
