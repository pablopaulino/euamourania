import { getSupabase } from './supabaseClient.js';
import { buscarPorCampo, excluirRegistro, listarTabela, salvarRegistro } from './baseService.js';
export const listarIniciativas = () => listarTabela('iniciativas_comunitarias', { ordem: 'atualizado_em', filtros: { status: 'publicado', exibir_na_listagem: true } });
export const buscarIniciativaPorSlug = (slug) => buscarPorCampo('iniciativas_comunitarias', 'slug', slug);
export const listarIniciativasAdmin = () => listarTabela('iniciativas_comunitarias', { ordem: 'atualizado_em' });
export const salvarIniciativa = (dados) => salvarRegistro('iniciativas_comunitarias', dados);
export const excluirIniciativa = (id) => excluirRegistro('iniciativas_comunitarias', id);
export async function listarFormasAjuda(iniciativaId, onlyActive = false) { let query = getSupabase().from('iniciativas_formas_ajuda').select('*').eq('iniciativa_id', iniciativaId).order('ordem'); if (onlyActive) query = query.eq('ativo', true); const { data, error } = await query; if (error) throw error; return data || []; }
export const salvarFormaAjuda = (dados) => salvarRegistro('iniciativas_formas_ajuda', dados);
export const excluirFormaAjuda = (id) => excluirRegistro('iniciativas_formas_ajuda', id);
