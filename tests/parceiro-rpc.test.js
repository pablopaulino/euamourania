const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261016_01_parceiros_v1.sql'),'utf8');
const atualizacao=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261017_01_parceiros_categoria_fotos.sql'),'utf8');
test('RPC valida campos operacionais e rejeita campos editoriais',()=>{
  const rpc=sql.split('create or replace function public.parceiro_atualizar_cadastro')[1];
  assert.ok(rpc);
  for(const field of ['descricao','imagem_url','galeria_urls','whatsapp','telefone','instagram','facebook','site','endereco','horario','opening_hours','opening_hours_note','mapa_url'])assert.match(rpc,new RegExp("'"+field+"'"));
  assert.match(rpc,/raise exception 'Campo não permitido'/);
  assert.doesNotMatch(rpc,/p_dados\s*\?\s*'status'/);
  assert.match(rpc,/where user_id=auth\.uid\(\) and guia_id=p_guia_id and ativo=true/);
});
test('RPC atualizada mantém nome imutável e valida categoria e quatro fotos extras',()=>{
  const rpc=atualizacao.split('create or replace function public.parceiro_atualizar_cadastro')[1];
  assert.ok(rpc);
  assert.match(rpc,/where user_id=auth\.uid\(\) and guia_id=p_guia_id and ativo=true/);
  assert.match(rpc,/where id=v_categoria_id and tipo='guia' and status='ativo'/);
  assert.match(rpc,/v_novas_fotos>4/);
  assert.match(rpc,/raise exception 'Campo não permitido'/);
  assert.doesNotMatch(rpc,/p_dados\s*\?\s*'nome'/);
  assert.doesNotMatch(rpc,/\bnome\s*=\s*case\s+when\s+p_dados/i);
});
