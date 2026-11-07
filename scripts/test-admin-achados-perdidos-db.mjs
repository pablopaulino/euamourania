import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../outputs/catalogos-tools/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const id='11111111-1111-1111-1111-111111111111';
try{
 await db.exec(`create role anon; create role authenticated; create table public.admin_permissoes_funcao(funcao text,modulo text,acao text,primary key(funcao,modulo,acao)); create table public.achados_perdidos(id uuid primary key,tipo text,categoria text,titulo text,descricao text,local text,whatsapp text,contato_nome text,imagem_url text,criado_em timestamptz,ocorrido_em timestamptz,atualizado_em timestamptz,status text); create table public.push_teste(item_id uuid); create function public.is_super_admin() returns boolean language sql as $$ select coalesce(current_setting('test.admin',true),'')='sim' $$; create function public.publicar_achado_perdido_v2(uuid,text,text,text,text,text,text,text,text,text,timestamptz) returns void language sql as $$ select $$; create function public.fake_approval() returns trigger language plpgsql as $$ begin if old.status='pendente' and new.status='ativo' then insert into public.push_teste values(new.id); end if; return new; end $$; create trigger achados_perdidos_aprovacao_push before update of status on public.achados_perdidos for each row execute function public.fake_approval(); insert into public.achados_perdidos values ('${id}','perdido','objeto','Chave perdida','Descrição','Praça','5511999999999',null,null,now(),null,'2026-01-01T00:00:00Z','pendente'); grant select on public.achados_perdidos to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261031_admin_achados_perdidos.sql',import.meta.url),'utf8'));
 await db.exec("set role authenticated; set test.admin='nao'");
 await assert.rejects(()=>db.query('select * from public.admin_listar_achados_pendentes()'),/Sem permissão/);
 await assert.rejects(()=>db.query(`select public.admin_moderar_achado('${id}','aprovar','2026-01-01T00:00:00Z')`),/Sem permissão/);
 await assert.rejects(()=>db.query(`update public.achados_perdidos set status='ativo' where id='${id}'`),/permission denied/);
 await db.exec("set test.admin='sim'");
 let result=await db.query('select id from public.admin_listar_achados_pendentes()');assert.equal(result.rows.length,1);
 result=await db.query(`select public.admin_moderar_achado('${id}','aprovar','2025-01-01T00:00:00Z') as ok`);assert.equal(result.rows[0].ok,false);
 result=await db.query(`select public.admin_moderar_achado('${id}','aprovar','2026-01-01T00:00:00Z') as ok`);assert.equal(result.rows[0].ok,true);
 result=await db.query(`select public.admin_moderar_achado('${id}','rejeitar','2026-01-01T00:00:00Z') as ok`);assert.equal(result.rows[0].ok,false);
 await db.exec('reset role'); result=await db.query('select status,(select count(*)::int from public.push_teste) as alertas from public.achados_perdidos');assert.equal(result.rows[0].status,'ativo');assert.equal(result.rows[0].alertas,1);
 console.log('Banco isolado: permissões, listagem, concorrência, aprovação e gatilho validados.');
}finally{await db.close()}
