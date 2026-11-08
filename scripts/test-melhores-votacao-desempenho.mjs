import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.MELHORES_VOTO_SECRET = 'test-secret';
process.env.TURNSTILE_SECRET_KEY = 'test-turnstile';
const calls = [];
let validTurnstile = true;
globalThis.fetch = async url => {
  const path = String(url);
  calls.push(path);
  if (path.includes('rate_check')) return {ok:true,text:async()=>JSON.stringify(true)};
  if (path.includes('siteverify')) return {json:async()=>({success:validTurnstile,action:'vote',hostname:'euamourania.com.br'})};
  const result = path.includes('melhores_edicoes') ? [{status:'votacao_aberta',votacao_inicio_site:'2020-01-01',votacao_fim:'2099-01-01'}]
    : path.includes('melhores_categorias') ? [{status:'ativo',visibilidade_publica:true}]
    : path.includes('melhores_indicados') ? [{status:'ativo',aprovado:true}]
    : {voto_id:'vote-id',status:'valido'};
  return {ok:true,text:async()=>JSON.stringify(result)};
};
const handler = createRequire(import.meta.url)('../api/melhores-votar.js');
const uuid = '123e4567-e89b-42d3-a456-426614174000';
const req = {method:'POST',headers:{host:'euamourania.com.br','x-forwarded-for':'192.0.2.1'},socket:{},body:{edicao_id:uuid,categoria_id:uuid,indicado_id:uuid,turnstile_token:'token'}};
const response = () => ({setHeader(){},status(code){this.statusCode=code;return this},send(value){this.body=JSON.parse(value);return this}});
let res = response();
await handler(req,res);
assert.equal(res.statusCode,200);
assert.equal(res.body.voto_id,'vote-id');
assert.equal(calls.filter(x=>x.includes('melhores_site_registrar_voto')).length,1);
validTurnstile = false; calls.length = 0; res = response();
await handler(req,res);
assert.equal(res.statusCode,403);
assert.equal(calls.filter(x=>x.includes('melhores_site_registrar_voto')).length,0,'Verificação inválida não deve registrar voto');
console.log('Validações e registro seguro de voto verificados.');
