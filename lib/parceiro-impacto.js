const SUPABASE_URL=process.env.SUPABASE_URL||'https://omhcpbphvtihqwdkbsbf.supabase.co';

async function countRows(path,key){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    method:'HEAD',
    headers:{apikey:key,Authorization:`Bearer ${key}`,Prefer:'count=exact'}
  });
  if(!response.ok)throw Error(`Consulta de métricas: ${response.status}`);
  const match=/\/(\d+)$/.exec(response.headers.get('content-range')||'');
  if(!match)throw Error('Total ausente na resposta de métricas');
  return Number(match[1]);
}

module.exports=async(req,res)=>{
  if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return res.status(503).json({error:'Dados indisponíveis.'});
  try{
    const [empresas,visualizacoes,cliquesWhatsapp]=await Promise.all([
      countRows('guia_comercial?status=eq.publicado&select=id',key),
      countRows('analytics_eventos?tipo=eq.guia_view&recurso_tipo=eq.guia&select=id',key),
      countRows('analytics_eventos?tipo=eq.whatsapp_click&recurso_tipo=eq.guia&select=id',key)
    ]);
    res.setHeader('Cache-Control','public, s-maxage=900');
    return res.status(200).json({empresas,visualizacoes,cliquesWhatsapp});
  }catch(error){
    console.error('parceiro-impacto:',error.message);
    return res.status(502).json({error:'Dados indisponíveis.'});
  }
};
