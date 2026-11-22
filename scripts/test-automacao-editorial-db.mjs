import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../outputs/catalogos-tools/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function public.tem_permissao_admin(text,text) returns boolean language sql stable as $$
      select current_setting('test.permission',true) = 'yes' $$;`);
  // Schema base integral do projeto; PGlite já fornece gen_random_uuid.
  const schema=await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');
  await db.exec(schema.replace('create extension if not exists pgcrypto;',''));
  await db.exec(`alter table public.noticias add column criado_por uuid references auth.users(id),
    add column status_editorial text not null default 'rascunho';
    alter table public.noticias add constraint noticias_publicacao_aprovada_check check(status<>'publicado' or status_editorial='aprovado');`);
  const trigger=await readFile(new URL('../supabase/migrations/20260701_super_admin_publicacao_direta.sql',import.meta.url),'utf8');
  await db.exec(trigger.slice(trigger.indexOf('create or replace function public.proteger_estado_editorial()'),trigger.indexOf('-- Administradores e Editores')));
  await db.exec(await readFile(new URL('../supabase/migrations/20261109_automacao_editorial_base.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261110_automacao_editorial_execucao.sql', import.meta.url), 'utf8'));
  await db.exec("grant usage on schema public to authenticated, service_role; grant select on public.editorial_fontes, public.editorial_pautas to authenticated;");
  await db.exec("insert into editorial_execucoes(id) values ('00000000-0000-0000-0000-000000000001')");
  await db.exec("insert into editorial_fontes(nome,url,tipo) values ('Fonte teste','https://example.org','site')");
  const args = [ '00000000-0000-0000-0000-000000000001', 'fato-1234567890123456', 'Título', 'titulo', 'Resumo', '<p>Conteúdo</p>', 'SEO', 'Descrição', JSON.stringify([{url:'https://example.org',titulo:'Fonte'}]), 'Interesse local', '[]', false ];
  const sql = 'select public.editorial_criar_rascunho($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12) as id';
  await db.exec("set role authenticated; set test.permission='no'");
  await assert.rejects(() => db.query(sql,args), /permission denied/);
  assert.equal((await db.query('select * from editorial_fontes')).rows.length,0);
  await db.exec("set test.permission='yes'");
  assert.equal((await db.query('select * from editorial_fontes')).rows.length,1);
  await db.exec('reset role; set role service_role');
  const id=(await db.query(sql,args)).rows[0].id;
  const duplicate=[...args]; duplicate[3]='titulo-outro';
  await assert.rejects(() => db.query(sql,duplicate), /duplicate key/);
  await db.exec('reset role');
  let rows=(await db.query('select * from noticias')).rows;
  assert.equal(rows.length,1); assert.equal(rows[0].id,id); assert.equal(rows[0].status,'rascunho');
  assert.equal(rows[0].status_editorial,'rascunho'); assert.equal(rows[0].destaque,false);
  assert.equal(rows[0].publicado_em,null); assert.equal(rows[0].imagem_url,null);
  await db.query('update noticias set titulo=$1 where id=$2',['Editado por pessoa',id]);
  await db.exec('set role service_role');
  await assert.rejects(() => db.query(sql,duplicate), /duplicate key/);
  await db.exec('reset role');
  rows=(await db.query('select titulo from noticias')).rows;
  assert.equal(rows[0].titulo,'Editado por pessoa');
  await assert.rejects(() => db.exec("insert into editorial_execucoes default values"), /duplicate key/);
  await db.exec("update editorial_execucoes set estado='concluida',finalizada_em=now() where estado='iniciada'");
  await db.exec('set role service_role');
  assert.equal((await db.query('select editorial_iniciar_execucao(true) as id')).rows[0].id,null);
  const manual=(await db.query('select editorial_iniciar_execucao(false) as id')).rows[0].id;
  assert.ok(manual);
  await assert.rejects(()=>db.query('select editorial_iniciar_execucao(false)'),/andamento/);
  await db.exec('reset role');
  await db.query("update editorial_execucoes set estado='concluida',finalizada_em=now() where id=$1",[manual]);
  await db.exec('update editorial_configuracao set ativa=true');
  await db.exec('set role service_role');
  assert.ok((await db.query('select editorial_iniciar_execucao(true) as id')).rows[0].id);
  assert.equal((await db.query('select editorial_iniciar_execucao(true) as id')).rows[0].id,null);
  await db.exec("reset role");
  await db.exec(await readFile(new URL('../supabase/migrations/20261121181239_automacao_editorial_v2.sql',import.meta.url),'utf8'));
  const source=(await db.query('select confiabilidade,escopo from editorial_fontes')).rows[0];
  assert.deepEqual(source,{confiabilidade:'portal',escopo:'local'});
  await assert.rejects(()=>db.exec("update editorial_fontes set escopo='outro'"),/check/);
  const run=(await db.query("select id from editorial_execucoes where estado='iniciada'")).rows[0].id;
  const dados={titulo:'Título novo',slug:'titulo-novo',categoria:'Cidade',subtitulo:'Subtítulo',resumo:'Resumo',
    conteudo_html:'<p>Texto</p>',titulo_seo:'SEO',descricao_seo:'Descrição',legenda_imagem:'Legenda',
    prompt_imagem:'Paisagem urbana',revisao_reforcada:true,pendencias:['Revisar']};
  const rpc='select editorial_criar_rascunho_v2($1,$2,$3::jsonb) as id';
  const key='chave-valida-para-candidata';
  const parametros=[run,key,JSON.stringify(dados)];
  await db.exec("set role authenticated");
  await assert.rejects(()=>db.query(rpc,parametros),/permission denied/);
  await db.exec("reset role; set role service_role");
  await db.query(`insert into editorial_pautas(execucao_id,chave_fato,fato_original,titulo,escopo,estado_triagem,fontes,relevancia)
    values($1,$2,'fato-novo','Pauta','regional_nacional','descartada',$3,'Aguardando')`,[run,key,args[8]]);
  const novo=(await db.query(rpc,parametros)).rows[0].id;
  const gravado=(await db.query('select * from noticias where id=$1',[novo])).rows[0];
  assert.equal(gravado.categoria_nome,'Cidade');
  assert.equal(gravado.subtitulo,'Subtítulo');
  assert.equal(gravado.status,'rascunho');
  assert.equal(gravado.status_editorial,'rascunho');
  assert.equal(gravado.imagem_url,null);
  assert.equal(gravado.publicado_em,null);
  assert.equal(gravado.destaque,false);
  assert.deepEqual((await db.query('select escopo,estado_triagem,legenda_imagem,prompt_imagem from editorial_pautas where noticia_id=$1',[novo])).rows[0],
    {escopo:'regional_nacional',estado_triagem:'selecionada',legenda_imagem:'Legenda',prompt_imagem:'Paisagem urbana'});
  await db.exec('reset role');
  await db.query("update noticias set titulo='Revisão humana' where id=$1",[novo]);
  await assert.rejects(()=>db.query(rpc,parametros),/já selecionada/);
  assert.equal((await db.query('select titulo from noticias where id=$1',[novo])).rows[0].titulo,'Revisão humana');
  console.log('Migração em PostgreSQL isolado: permissões, rascunho, atomicidade, duplicação e edição humana validadas.');
} finally { await db.close(); }
