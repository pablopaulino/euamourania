const {timingSafeEqual}=require('node:crypto');
const {criarDb,executar}=require('../lib/editorial-execucao');
function secretEqual(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return !!x.length&&x.length===y.length&&timingSafeEqual(x,y);}
module.exports=async(req,res)=>{
  const deadline=Date.now()+100000;
  res.setHeader('Cache-Control','no-store');
  const automatic=req.method==='GET';
  if(!automatic&&req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;
  const supabaseUrl=process.env.SUPABASE_URL;
  const publishable=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!serviceKey||!supabaseUrl)return res.status(503).json({error:'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.'});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(automatic){if(!process.env.CRON_SECRET)return res.status(503).json({error:'Configure CRON_SECRET no servidor.'});if(!secretEqual(token,process.env.CRON_SECRET))return res.status(401).json({error:'Acesso não autorizado.'});}
  else {
    if(!publishable)return res.status(503).json({error:'Configure SUPABASE_PUBLISHABLE_KEY no servidor.'});
    if(!token)return res.status(403).json({error:'Sessão ou permissão administrativa necessária.'});
    try {
      const check=await fetch(`${supabaseUrl.replace(/\/$/,'')}/rest/v1/rpc/tem_permissao_admin`,{method:'POST',headers:{apikey:publishable,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({p_modulo:'noticias',p_acao:'editar'}),signal:AbortSignal.timeout(8000)});
      if(!check.ok||await check.json()!==true)return res.status(403).json({error:'Permissão para editar notícias necessária.'});
    }catch{return res.status(503).json({error:'Não foi possível verificar a sessão administrativa.'});}
  }
  try{
    const result=await executar({deadline,db:criarDb({url:supabaseUrl,key:serviceKey}),automatica:automatic,apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL,freeTierConfirmed:process.env.GEMINI_FREE_TIER_CONFIRMED==='true'});
    return res.status(200).json(result);
  }catch(error){return res.status(503).json({error:String(error.message||'Falha na execução editorial.').slice(0,400)});}
};
