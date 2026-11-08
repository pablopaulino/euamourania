import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.MELHORES_VOTO_SECRET = 'test-secret';
const pending = [];
globalThis.fetch = async url => {
  await new Promise(resolve => pending.push({url:String(url), resolve}));
  const isEdition = String(url).includes('melhores_edicoes');
  return {ok:true, text:async()=>JSON.stringify(isEdition ? [{id:'e',status:'votacao_aberta',votacao_inicio_site:'2026-01-01T00:00:00Z',votacao_fim:'2027-01-01T00:00:00Z'}] : [])};
};
const handler = createRequire(import.meta.url)('../api/melhores-votar.js');
const response = {headers:{},setHeader(name,value){this.headers[name]=value},status(code){this.statusCode=code;return this},send(value){this.body=JSON.parse(value);return this}};
const running = handler({method:'GET',url:'/?edicao_id=123e4567-e89b-42d3-a456-426614174000',headers:{host:'example.com'},socket:{}},response);
await new Promise(resolve=>setImmediate(resolve));
assert.equal(pending.length,2,'Edição e votos devem começar a carregar em paralelo');
pending.forEach(item=>item.resolve());
await running;
assert.equal(response.statusCode,200);
assert.deepEqual(response.body.votos_site,[]);
assert.match(response.headers['Set-Cookie'],/HttpOnly/);
assert.equal(response.headers['Cache-Control'],'no-store');
console.log('Carregamento paralelo e resposta privada de votação verificados.');
