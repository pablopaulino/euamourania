const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../parceiro/auth.js'),'utf8')
  .replace(/^import .*;\r?\n/,'const getSupabase=globalThis.__partnerTestDb;\n')
  .replace(/^import \{partnerPath\} from '\.\/paths\.js';\r?\n/m,"const partnerPath=path=>'/parceiro/'+path;\n");
async function load(db){globalThis.__partnerTestDb=()=>db;return import('data:text/javascript,'+encodeURIComponent(source)+'#'+Math.random());}
test('verificarParceiro rejeita anônimo',async()=>{
  const {verificarParceiro}=await load({auth:{getSession:async()=>({data:{session:null}})}});
  assert.equal(await verificarParceiro(),null);
});
test('verificarParceiro rejeita usuário de staff sem parceiro ativo',async()=>{
  const db={auth:{getSession:async()=>({data:{session:{user:{id:'staff-id'}}}})},from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})})};
  const {verificarParceiro}=await load(db);
  assert.equal(await verificarParceiro(),null);
});
