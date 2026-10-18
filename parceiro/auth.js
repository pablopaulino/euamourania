import {getSupabase} from '../assets/js/services/supabaseClient.js';
import {partnerPath} from './paths.js';
export async function verificarParceiro(){
  const db=getSupabase();
  const {data:{session},error:sessionError}=await db.auth.getSession();
  if(sessionError)throw sessionError;
  if(!session)return null;
  const {data:parceiro,error}=await db.from('parceiros').select('id,user_id,guia_id,ativo,criado_em').eq('user_id',session.user.id).eq('ativo',true).maybeSingle();
  if(error)throw error;
  if(!parceiro)return null;
  const {data:guia,error:guiaError}=parceiro.guia_id?await db.from('guia_comercial').select('*').eq('id',parceiro.guia_id).maybeSingle():{data:null,error:null};
  if(guiaError)throw guiaError;
  return {session,user:session.user,parceiro,guia};
}
export async function exigirParceiro(){
  const acesso=await verificarParceiro();
  if(!acesso){location.replace(partnerPath('login'));return null;}
  if(acesso.guia){
    const {data,error}=await getSupabase().rpc('parceiro_plano_viva',{p_guia_id:acesso.guia.id});
    acesso.plano=data;acesso.planoErro=Boolean(error);
    const planPage=/\/plano(?:\.html)?\/?$/.test(location.pathname);
    if(!planPage&&(error||!data?.ativo)){location.replace(partnerPath('plano'));return null;}
  }
  return acesso;
}
