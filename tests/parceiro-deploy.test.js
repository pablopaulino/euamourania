const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('painel usa as 12 funções existentes no plano Hobby',()=>{
  const root=path.join(__dirname,'..');
  const functions=fs.readdirSync(path.join(root,'api')).filter(name=>name.endsWith('.js'));
  assert.equal(functions.length,12);
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  assert.ok(config.rewrites.some(route=>route.source==='/api/admin-criar-parceiro'&&route.destination==='/api/admin-users?operacao=criar-parceiro'));
  assert.ok(config.rewrites.some(route=>route.source==='/api/parceiro-impacto'&&route.destination==='/api/admin-users?operacao=impacto-parceiro'));
});

test('rota de convite chega ao handler específico',async()=>{
  const handler=require('../api/admin-users.js');
  let result;
  const res={status(code){result={code};return this},json(body){result.body=body;return this}};
  await handler({method:'GET',query:{operacao:'criar-parceiro'},url:'/api/admin-users?operacao=criar-parceiro'},res);
  assert.equal(result.code,405);
});

test('impacto soma apenas eventos das empresas e retorna totais agregados',async()=>{
  const handler=require('../lib/parceiro-impacto.js');
  const previousFetch=global.fetch;
  const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paths=[];
  process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
  global.fetch=async url=>{
    const path=new URL(url).searchParams;
    paths.push(path.toString());
    const total=path.has('status')?77:path.get('tipo')==='eq.guia_view'?1234:56;
    return {ok:true,headers:{get:()=>`0-0/${total}`}};
  };
  try{
    let result;
    const res={setHeader(){},status(code){result={code};return this},json(body){result.body=body;return this}};
    await handler({method:'GET'},res);
    assert.equal(result.code,200);
    assert.deepEqual(result.body,{empresas:77,visualizacoes:1234,cliquesWhatsapp:56});
    assert.equal(paths.length,3);
    assert.ok(paths.filter(path=>path.includes('recurso_tipo=eq.guia')).length===2);
  }finally{
    global.fetch=previousFetch;
    if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
  }
});
