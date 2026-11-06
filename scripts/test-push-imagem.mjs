import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='test-key';
process.env.EXPO_ACCESS_TOKEN='test-token';
const handler=require('../api/push-send.js');
const good='https://example.supabase.co/storage/v1/object/public/cms-media/comunicacao/notificacoes/2026/11/a-b.png';
async function run(image, allowed=true) {
  let expoPayload=null, writes=0;
  globalThis.fetch=async (url, options={})=>{
    url=String(url);
    const json=(data)=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
    if(url.includes('rpc/tem_permissao_admin'))return json(allowed);
    if(url.includes('rpc/app_push_tokens_para_notificacao'))return json([{id:'device',expo_push_token:'ExponentPushToken[abc]'}]);
    if(url.startsWith('https://exp.host/')){expoPayload=JSON.parse(options.body);return json({data:[{status:'ok'}]});}
    if(url.includes('app_notificacoes')){
      if(options.method==='PATCH'){writes++;return json([])}
      return json([{id:'n1',status:'rascunho',titulo:'Título',mensagem:'Mensagem',caminho:'/',imagem_url:image}]);
    }
    throw new Error(`Unexpected request ${url}`);
  };
  const res={code:0,body:null,status(code){this.code=code;return this},json(data){this.body=data;return this}};
  await handler({method:'POST',headers:{authorization:'Bearer x'},body:{id:'n1'}},res);
  return {res,expoPayload,writes};
}
let result=await run(good);assert.equal(result.res.code,200);assert.equal(result.expoPayload[0].richContent.image,good);assert.equal(result.expoPayload[0].data.path,'/');
result=await run(null);assert.equal(result.res.code,200);assert.equal('richContent' in result.expoPayload[0],false);
for(const url of ['http://example.supabase.co/storage/v1/object/public/cms-media/comunicacao/notificacoes/a.png','https://evil.example/a.png',good+'?token=secret','https://example.supabase.co/storage/v1/object/public/cms-media/outro/a.png']){result=await run(url);assert.equal(result.res.code,400);assert.equal(result.expoPayload,null);assert.equal(result.writes,0);}
result=await run(good,false);assert.equal(result.res.code,403);assert.equal(result.expoPayload,null);
console.log('Push: imagem opcional, mensagem sem imagem, permissão e URLs inválidas validados sem envio real.');
