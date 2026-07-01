import { getSupabase } from "./supabaseClient.js";

export async function registrarEventoSite(tipo,{pagina=location.pathname,recursoTipo=null,recursoId=null,destino=null,sessaoHash=null,origem=null,dispositivo=null,metadados={}}={}){
  const {error}=await getSupabase().rpc("registrar_evento_site",{
    p_tipo:tipo,p_pagina:pagina,p_recurso_tipo:recursoTipo,p_recurso_id:recursoId,p_destino:destino,
    p_sessao_hash:sessaoHash,p_origem:origem,p_dispositivo:dispositivo,p_metadados:metadados
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

export async function obterAudienciaAvancada(inicio,fim){
  const {data,error}=await getSupabase().rpc("obter_audiencia_avancada",{
    p_inicio:inicio,p_fim:fim
  });
  if(error) throw error;
  const inicioIso=`${inicio}T00:00:00-03:00`;
  const fimDate=new Date(`${fim}T00:00:00-03:00`);
  fimDate.setDate(fimDate.getDate()+1);
  const {data:clicks,error:clickError}=await getSupabase().from("analytics_eventos")
    .select("tipo,recurso_tipo,recurso_id")
    .in("tipo",["guia_click","turismo_click","evento_click","link_click"])
    .gte("criado_em",inicioIso).lt("criado_em",fimDate.toISOString()).limit(5000);
  if(clickError) throw clickError;
  const result=data||{};
  const grouped=new Map();
  (clicks||[]).forEach(item=>{
    const key=`${item.recurso_tipo}:${item.recurso_id}:${item.tipo}`;
    const current=grouped.get(key)||{tipo:item.recurso_tipo,id:item.recurso_id,evento:item.tipo,total:0};
    current.total++;grouped.set(key,current);
  });
  result.resumo={...(result.resumo||{}),cliques_conteudo:(clicks||[]).length};
  result.recursos=[...(result.recursos||[]),...grouped.values()].sort((a,b)=>b.total-a.total);
  return result;
}
