const SUPABASE_URL=process.env.SUPABASE_URL||"https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY;
const EXPO_ACCESS_TOKEN=process.env.EXPO_ACCESS_TOKEN;
const EXPO_ENDPOINT="https://exp.host/--/api/v2/push/send";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const chunks=(items,size)=>Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));

function bearer(req){return String(req.headers.authorization||"").replace(/^Bearer\s+/i,"")}
async function rest(path,{method="GET",body,token}={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    method,
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${token||SUPABASE_KEY}`,
      "Content-Type":"application/json",
      Prefer:"return=representation"
    },
    body:body?JSON.stringify(body):undefined
  });
  const text=await response.text(),data=text?JSON.parse(text):null;
  if(!response.ok)throw Object.assign(new Error(data?.message||`Supabase ${response.status}`),{status:response.status});
  return data;
}
async function canSend(token){
  if(!token)return false;
  try{return await rest("rpc/tem_permissao_admin",{method:"POST",token,body:{p_modulo:"notificacoes",p_acao:"enviar"}})===true}
  catch{return false}
}
function destination(notification){
  const value=String(notification.destino_valor||"").replace(/^\/+/,"");
  if(notification.destino_tipo==="empresa"&&value)return`/empresa/${value}`;
  if(notification.destino_tipo==="turismo"&&value)return`/turismo/${value}`;
  if(notification.destino_tipo==="evento"&&value)return`/eventos/${value}`;
  return"/";
}
async function sendBatch(messages){
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch(EXPO_ENDPOINT,{
      method:"POST",
      headers:{
        Accept:"application/json",
        "Content-Type":"application/json",
        Authorization:`Bearer ${EXPO_ACCESS_TOKEN}`
      },
      body:JSON.stringify(messages)
    });
    if(response.ok)return response.json();
    if(![429,500,502,503,504].includes(response.status)){
      const text=await response.text();
      throw new Error(`Expo Push ${response.status}: ${text.slice(0,240)}`);
    }
    await sleep(500*(2**attempt));
  }
  throw new Error("Expo Push indisponível após novas tentativas.");
}

module.exports=async(req,res)=>{
  if(req.method!=="POST")return res.status(405).json({error:"Método não permitido"});
  if(!SUPABASE_KEY)return res.status(503).json({error:"SUPABASE_PUBLISHABLE_KEY não configurada na Vercel."});
  if(!EXPO_ACCESS_TOKEN)return res.status(503).json({error:"EXPO_ACCESS_TOKEN não configurado na Vercel."});
  const token=bearer(req);
  if(!await canSend(token))return res.status(403).json({error:"Permissão para enviar notificações necessária."});

  const id=String(req.body?.id||"");
  try{
    const notification=(await rest(`app_notificacoes?id=eq.${encodeURIComponent(id)}&select=*`,{token}))?.[0];
    if(!notification)return res.status(404).json({error:"Notificação não encontrada."});
    if(!["rascunho","falhou"].includes(notification.status))return res.status(409).json({error:"Esta notificação já foi processada."});

    await rest(`app_notificacoes?id=eq.${id}`,{method:"PATCH",token,body:{status:"enviando",total_erros:0,total_aceitos:0,total_destinatarios:0}});
    const platformFilter=notification.plataforma==="todos"?"":`&plataforma=eq.${notification.plataforma}`;
    const devices=await rest(`app_push_tokens?ativo=eq.true${platformFilter}&select=id,expo_push_token&order=visto_em.desc`,{token});
    if(!devices.length)throw Object.assign(new Error("Nenhum aparelho autorizou notificações para esse público."),{status:400});

    const path=destination(notification);
    const messages=devices.map(device=>({
      to:device.expo_push_token,
      title:notification.titulo,
      body:notification.mensagem,
      sound:"default",
      priority:"high",
      channelId:"novidades",
      data:{path,notificationId:notification.id}
    }));
    let accepted=0;
    const failures=[];
    for(const group of chunks(messages,100)){
      const result=await sendBatch(group);
      const tickets=Array.isArray(result.data)?result.data:[result.data];
      tickets.forEach((ticket,index)=>{
        const device=devices[messages.indexOf(group[index])];
        if(ticket?.status==="ok"){accepted++;return}
        failures.push({
          notificacao_id:notification.id,
          token_id:device?.id||null,
          codigo:ticket?.details?.error||"UNKNOWN",
          mensagem:ticket?.message||"Falha não detalhada"
        });
      });
    }
    if(failures.length)await rest("app_push_falhas",{method:"POST",token,body:failures});
    const invalidIds=failures.filter(item=>item.codigo==="DeviceNotRegistered").map(item=>item.token_id).filter(Boolean);
    for(const invalidId of invalidIds){
      await rest(`app_push_tokens?id=eq.${invalidId}`,{method:"PATCH",token,body:{ativo:false}});
    }
    await rest(`app_notificacoes?id=eq.${id}`,{method:"PATCH",token,body:{
      status:"enviado",
      total_destinatarios:devices.length,
      total_aceitos:accepted,
      total_erros:failures.length,
      enviado_em:new Date().toISOString()
    }});
    return res.status(200).json({ok:true,total:devices.length,accepted,errors:failures.length});
  }catch(error){
    console.error("push-send:",error);
    if(id)await rest(`app_notificacoes?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",token,body:{status:"falhou"}}).catch(()=>{});
    return res.status(error.status||500).json({error:error.message||"Falha no envio das notificações."});
  }
};
