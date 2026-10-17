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
});

test('rota de convite chega ao handler específico',async()=>{
  const handler=require('../api/admin-users.js');
  let result;
  const res={status(code){result={code};return this},json(body){result.body=body;return this}};
  await handler({method:'GET',query:{operacao:'criar-parceiro'},url:'/api/admin-users?operacao=criar-parceiro'},res);
  assert.equal(result.code,405);
});
