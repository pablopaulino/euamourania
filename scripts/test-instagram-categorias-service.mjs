import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../assets/js/services/melhoresService.js',import.meta.url),'utf8');
const match=source.match(/export async function salvarInstagramCategoria\(payloads\)\s*\{[\s\S]*?\n\}/);
assert.ok(match,'Operação por categoria não encontrada');
let saved;
let failure=null;
const context={db:()=>({from:table=>{
  assert.equal(table,'melhores_instagram_votos');
  return {upsert:(rows,options)=>{
    saved={rows,options};
    return {select:async()=>({data:rows,error:failure})};
  }};
}})};
const save=vm.runInNewContext(`(${match[0].replace('export ','')})`,context);
const rows=[{edicao_id:'e',categoria_id:'c',indicado_id:'a',votos:0},{edicao_id:'e',categoria_id:'c',indicado_id:'b',votos:14}];
await save(rows);
assert.equal(saved.rows,rows,'A categoria deve ser enviada em uma única operação');
assert.equal(saved.options.onConflict,'edicao_id,categoria_id,indicado_id');
await assert.rejects(()=>save([]));
failure=new Error('Falha ao salvar');
await assert.rejects(()=>save(rows),/Falha ao salvar/);
const migration=await readFile(new URL('../supabase/migrations/20261108_melhores_instagram_segundo_comprovante.sql',import.meta.url),'utf8');
assert.match(migration,/add column if not exists comprovante_url_2/i);
assert.match(migration,/melhores_comprovante_em_uso/);
assert.match(migration,/as restrictive for delete/i);
console.log('Lançamento atômico e proteção dos comprovantes verificados.');
