import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../outputs/catalogos-tools/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create schema storage; create table public.app_notificacoes(id int primary key); create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,delete on storage.objects to authenticated; create policy allow_delete on storage.objects for delete to authenticated using (true); create policy allow_select on storage.objects for select to authenticated using (true); insert into public.app_notificacoes values (1);`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261106_app_notificacoes_imagem.sql',import.meta.url),'utf8'));
 await db.exec(`update public.app_notificacoes set imagem_url='https://example.test/storage/v1/object/public/cms-media/comunicacao/notificacoes/2026/11/x.png' where id=1; insert into storage.objects values ('cms-media','comunicacao/notificacoes/2026/11/x.png'),('cms-media','comunicacao/notificacoes/2026/11/y.png'); set role authenticated; delete from storage.objects where name like 'comunicacao/notificacoes/%'; reset role;`);
 const result=await db.query('select name from storage.objects order by name');assert.deepEqual(result.rows.map(r=>r.name),['comunicacao/notificacoes/2026/11/x.png']);
 console.log('Migração: coluna opcional e proteção da imagem em uso validadas em banco isolado.');
} finally {await db.close()}
