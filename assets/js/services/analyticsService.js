import { getSupabase } from "./supabaseClient.js";

export async function registrarEventoSite(tipo,{pagina=location.pathname,recursoTipo=null,recursoId=null,destino=null}={}){
  const {error}=await getSupabase().rpc("registrar_evento_site",{
    p_tipo:tipo,p_pagina:pagina,p_recurso_tipo:recursoTipo,p_recurso_id:recursoId,p_destino:destino
  });
  if(error) console.warn("Insight não registrado:",error.message);
}

export async function obterInsights(dias=30){
  const desde=new Date();desde.setDate(desde.getDate()-dias+1);
  const {data,error}=await getSupabase().from("analytics_eventos")
    .select("tipo,pagina,recurso_tipo,recurso_id,destino,criado_em,dia")
    .gte("criado_em",desde.toISOString()).order("criado_em",{ascending:false}).limit(5000);
  if(error) throw error;
  return data||[];
}

export async function obterMaisAcessados(tabela,limite=8){
  const titulo=tabela==="noticias"?"titulo":"nome";
  const {data,error}=await getSupabase().from(tabela)
    .select(`id,${titulo},slug,visualizacoes`).order("visualizacoes",{ascending:false}).limit(limite);
  if(error) throw error;
  return data||[];
}
