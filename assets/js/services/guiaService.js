import { getSupabase } from "./supabaseClient.js";
import { listarTabela, buscarPorCampo, salvarRegistro, excluirRegistro } from "./baseService.js";

export async function listarGuia({ categoria, recomendado } = {}) {
  let query = getSupabase().from("guia_comercial").select("*").eq("status", "publicado").order("recomendado", { ascending: false }).order("nome");
  if (categoria) query = query.eq("categoria_nome", categoria);
  if (recomendado !== undefined) query = query.eq("recomendado", recomendado);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
export const buscarItemGuiaPorSlug = slug => buscarPorCampo("guia_comercial", "slug", slug);
export const listarGuiaAdmin = () => listarTabela("guia_comercial", { ordem: "atualizado_em" });
export const salvarItemGuia = dados => salvarRegistro("guia_comercial", dados);
export const criarItemGuia = dados => salvarItemGuia(dados);
export const editarItemGuia = dados => salvarItemGuia(dados);
export const excluirItemGuia = id => excluirRegistro("guia_comercial", id);
