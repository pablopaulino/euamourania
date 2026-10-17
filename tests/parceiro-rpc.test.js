const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261016_01_parceiros_v1.sql'),'utf8');
test('RPC valida campos operacionais e rejeita campos editoriais',()=>{
  const rpc=sql.split('create or replace function public.parceiro_atualizar_cadastro')[1];
  assert.ok(rpc);
  for(const field of ['descricao','imagem_url','galeria_urls','whatsapp','telefone','instagram','facebook','site','endereco','horario','opening_hours','opening_hours_note','mapa_url'])assert.match(rpc,new RegExp("'"+field+"'"));
  assert.match(rpc,/raise exception 'Campo não permitido'/);
  assert.doesNotMatch(rpc,/p_dados\s*\?\s*'status'/);
  assert.match(rpc,/where user_id=auth\.uid\(\) and guia_id=p_guia_id and ativo=true/);
});
