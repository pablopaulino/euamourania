import { getSupabase } from './supabaseClient.js';
import { excluirRegistro, salvarRegistro } from './baseService.js';

export async function listarVantagensAdmin(){
  const {data,error}=await getSupabase().from('vantagens').select('*,estabelecimento:guia_comercial(id,nome,slug,status)').order('updated_at',{ascending:false});
  if(error) throw error; return data||[];
}
export async function listarEmpresasParaVantagens(){
  const {data,error}=await getSupabase().from('guia_comercial').select('id,nome,status,recomendado').order('nome');
  if(error) throw error; return data||[];
}
export const salvarVantagem=dados=>salvarRegistro('vantagens',dados);
export const excluirVantagem=id=>excluirRegistro('vantagens',id);
