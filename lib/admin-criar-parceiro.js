const URL=process.env.SUPABASE_URL||'https://omhcpbphvtihqwdkbsbf.supabase.co';
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=(bearer=KEY)=>({apikey:KEY,Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'});
async function call(path,{method='GET',body,bearer=KEY,auth=false}={}){
  const res=await fetch(`${URL}/${auth?'auth/v1':'rest/v1'}/${path}`,{method,headers:headers(bearer),body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json().catch(()=>null);
  if(!res.ok)throw Object.assign(new Error(data?.message||data?.msg||'Falha no Supabase'),{status:res.status});
  return data;
}
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
  try{
    if(!KEY)throw fail('Serviço indisponível',503);
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!token)throw fail('Sessão obrigatória',401);
    const user=await call('user',{auth:true,bearer:token});
    const staff=await call(`usuarios_admin?id=eq.${encodeURIComponent(user.id)}&ativo=eq.true&select=id`);
    if(!staff.length)throw fail('Acesso negado',403);
    const allowed=await call('rpc/tem_permissao_admin',{method:'POST',bearer:token,body:{p_modulo:'guia_comercial',p_acao:'editar'}});
    if(allowed!==true)throw fail('Permissão insuficiente',403);
    const guiaId=String(req.body?.guia_id||'');
    const email=String(req.body?.email||'').trim().toLowerCase();
    if(!/^[0-9a-f-]{36}$/i.test(guiaId)||!/^\S+@\S+\.\S+$/.test(email))throw fail('Cadastro ou e-mail inválido');
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim();
    const {createHash}=require('node:crypto');
    const hash=createHash('sha256').update(ip).digest('hex');
    const withinLimit=await call('rpc/parceiro_consumir_convite_limite',{method:'POST',body:{p_ip_hash:hash}});
    if(!withinLimit)throw fail('Limite de convites atingido. Tente novamente em uma hora.',429);
    const guide=await call(`guia_comercial?id=eq.${encodeURIComponent(guiaId)}&select=id`);
    if(!guide.length)throw fail('Cadastro não encontrado',404);
    const existing=await call(`parceiros?guia_id=eq.${encodeURIComponent(guiaId)}&ativo=eq.true&select=id`);
    if(existing.length)throw fail('Este cadastro já possui parceiro ativo',409);
    const created=await call('admin/users',{auth:true,method:'POST',body:{email,email_confirm:true}});
    try{
      await call('parceiros',{method:'POST',body:{user_id:created.id,guia_id:guiaId,email}});
      const link=await call('admin/generate_link',{auth:true,method:'POST',body:{type:'recovery',email,options:{redirect_to:'https://parceiros.euamourania.com.br/login'}}});
      return res.status(201).json({user_id:created.id,email,invite_link:link?.action_link||link?.properties?.action_link||null});
    }catch(error){await call(`admin/users/${created.id}`,{auth:true,method:'DELETE'}).catch(()=>{});throw error;}
  }catch(error){return res.status(error.status||500).json({error:error.message||'Falha ao criar parceiro'});}
};
