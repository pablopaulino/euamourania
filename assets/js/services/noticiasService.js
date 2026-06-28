import { getSupabase } from "./supabaseClient.js";
import { listarTabela, salvarRegistro, excluirRegistro } from "./baseService.js";

const agora=()=>new Date().toISOString();

export async function listarNoticias({ categoria, destaque, limite } = {}) {
  let query = getSupabase().from("noticias").select("*").eq("status", "publicado").lte("publicado_em", agora()).order("publicado_em", { ascending: false });
  if (categoria) query = query.eq("categoria_nome", categoria);
  if (destaque !== undefined) query = query.eq("destaque", destaque);
  if (limite) query = query.limit(limite);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
export const listarNoticiasDestaque = (limite = 4) => listarNoticias({ destaque: true, limite });
export async function buscarNoticiaPorSlug(slug) {
  const { data, error } = await getSupabase().from("noticias").select("*").eq("slug", slug).eq("status", "publicado").lte("publicado_em", agora()).maybeSingle();
  if (error) throw error;
  return data;
}
export async function listarNoticiasRelacionadas(categoria, slugAtual, limite = 3) {
  const { data, error } = await getSupabase().from("noticias").select("*").eq("status", "publicado").lte("publicado_em", agora()).eq("categoria_nome", categoria).neq("slug", slugAtual).order("publicado_em", { ascending: false }).limit(limite);
  if (error) throw error;
  return data || [];
}
export const listarNoticiasAdmin = () => listarTabela("noticias", { ordem: "atualizado_em" });
export const salvarNoticia = dados => salvarRegistro("noticias", dados);
export const criarNoticia = dados => salvarNoticia(dados);
export const editarNoticia = dados => salvarNoticia(dados);
export const excluirNoticia = id => excluirRegistro("noticias", id);
