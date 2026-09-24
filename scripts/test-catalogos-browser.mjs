// Optional local integration harness: real module + isolated PostgreSQL, no remote services.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
if(!existsSync(new URL('../outputs/catalogos-tools/node_modules/playwright/index.mjs',import.meta.url)))throw new Error('Ferramentas locais ausentes. Rode: npm install --prefix outputs/catalogos-tools --no-save --package-lock=false @electric-sql/pglite playwright');
import { restaurant } from './fixtures/catalogos-v1.mjs';
const {chromium}=await import('../outputs/catalogos-tools/node_modules/playwright/index.mjs');
const {PGlite}=await import('../outputs/catalogos-tools/node_modules/@electric-sql/pglite/dist/index.js');
const db=new PGlite();
const company='00000000-0000-0000-0000-000000000002';
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;insert into auth.users values(auth.uid());create table guia_comercial(id uuid primary key,nome text);insert into guia_comercial values('${company}','Empresa de teste local');create function tem_permissao_admin(text,text) returns boolean language sql as $$select true$$;`);
await db.exec(await readFile('supabase/migrations/20260924_viva_catalogos.sql','utf8'));
const seed=restaurant();
await db.query('select salvar_catalogo($1,$2::jsonb)',[company,JSON.stringify(seed)]);
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/__db'){
   let body='';for await(const chunk of req)body+=chunk;
   const {table,rpc,args,from=0,to=499}=JSON.parse(body);let data;
   if(table==='guia_comercial')data=(await db.query('select * from guia_comercial order by nome,id offset $1 limit $2',[from,to-from+1])).rows;
   else if(table==='catalogos')data=(await db.query(`select c.*,jsonb_build_array(jsonb_build_object('count',(select count(*) from catalogo_categorias where catalogo_id=c.id))) catalogo_categorias,jsonb_build_array(jsonb_build_object('count',(select count(*) from catalogo_produtos where catalogo_id=c.id))) catalogo_produtos from catalogos c order by name,id offset $1 limit $2`,[from,to-from+1])).rows;
   else if(table==='cms_midias')data=[];
   else if(rpc==='salvar_catalogo')data=(await db.query('select salvar_catalogo($1,$2::jsonb,$3,$4) data',[args.p_empresa_id,JSON.stringify(args.p_documento),args.p_id,args.p_revision])).rows[0].data;
   else if(rpc==='exportar_catalogo')data=(await db.query('select exportar_catalogo($1) data',[args.p_id])).rows[0].data;
   else if(rpc==='excluir_catalogo'){await db.query('select excluir_catalogo($1,$2)',[args.p_id,args.p_revision]);data=null;}
   else throw new Error('Unexpected mock request');
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data,error:null}));return;
  }
  if(path.endsWith('/supabaseClient.js')){res.writeHead(200,{'Content-Type':'text/javascript'});res.end('export const getSupabase=()=>window.__db;export const supabaseConfigurado=()=>true;');return;}
  let file=resolve('.'+path);if(!file.startsWith(resolve('.')))throw new Error('Outside project');
  let content=await readFile(file);
  if(path==='/admin/index.html')content=content.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream'});res.end(content);
 }catch(e){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:e.message,code:e.code}}));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
await page.goto(base+'/admin/index.html');
await page.evaluate(async()=>{
 const request=async payload=>(await fetch('/__db',{method:'POST',body:JSON.stringify(payload)})).json();
 window.__db={rpc:(rpc,args)=>request({rpc,args}),from:table=>{let f=0,t=499;const q={select:()=>q,order:()=>q,eq:()=>q,limit:()=>q,range:(from,to)=>{f=from;t=to;return q;},then:(a,b)=>request({table,from:f,to:t}).then(a,b)};return q;}};
 window.__catalog=await import('/admin/catalogos.js');
 window.__context={db:window.__db,access:{admin:{ativo:true,funcao:'administrador'}},toast:message=>window.__lastToast=message,setPrimaryAction:()=>{}};
 await window.__catalog.mount(document.querySelector('#app-content'),window.__context);
});
const act=name=>page.locator(`[data-catalog-action="${name}"]`).first();
try{
 const modelLink=()=>page.getByRole('link',{name:'Baixar modelo JSON'});
 const modelDownload=page.waitForEvent('download');await modelLink().click();
 const downloadedModel=await modelDownload;
 assert.equal(downloadedModel.suggestedFilename(),'modelo-catalogo-viva-v1.json');
 assert.deepEqual(JSON.parse(await readFile(await downloadedModel.path(),'utf8')),JSON.parse(await readFile('modelos/catalogo-exemplo-v1.json','utf8')));
 await act('edit').click();await page.getByRole('heading',{name:'Dados gerais'}).waitFor();
 assert.equal(await modelLink().count(),1);
 await act('product').click();await page.locator('[data-product-editor]').waitFor();
 await page.locator('[data-path="catalog.categories.0.products.0.name"]').fill('Pizza editada localmente');
 await page.getByRole('button',{name:'Salvar catálogo',exact:true}).click();
 await page.waitForFunction(()=>window.__lastToast?.startsWith('Catálogo salvo'));
 assert.equal((await db.query("select name from catalogo_produtos where key='pizza'")).rows[0].name,'Pizza editada localmente');
 await act('product').click();await act('add-image').click();
 assert.equal(await page.getByRole('button',{name:'Escolher da biblioteca'}).count(),1);
 await page.locator('[data-catalog-image]').fill('https://example.com/pizza.jpg');
 await page.locator('[data-path$="images.0.alt"]').fill('Pizza de teste');
 await page.screenshot({path:'outputs/catalogos-editor-desktop.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'desktop overflow');
 await act('back').click();await act('new').click();
 await page.locator('[data-company]').selectOption('00000000-0000-0000-0000-000000000002');
 await page.locator('[data-path="catalog.name"]').fill('Produtos manuais');
 await act('add-category').click();await page.locator('[data-path="catalog.categories.0.name"]').fill('Presentes');
 await act('add-product').click();await page.locator('[data-path="catalog.categories.0.products.0.name"]').fill('Caneca');
 await page.locator('[data-path="catalog.categories.0.products.0.price_cents"]').fill('29.90');
 await page.evaluate(()=>window.__lastToast='');await page.getByRole('button',{name:'Salvar catálogo',exact:true}).click();await page.waitForFunction(()=>window.__lastToast?.startsWith('Catálogo salvo'));
 assert.equal((await db.query("select price_cents from catalogo_produtos where name='Caneca'")).rows[0].price_cents,2990);
 await act('back').click();await act('import').click();await page.locator('dialog [name=company]').selectOption('00000000-0000-0000-0000-000000000002');
 await page.locator('dialog textarea').fill('{');await page.locator('[data-validate]').click();assert.match(await page.locator('[data-summary]').innerText(),/JSON inválido/);
 const importDoc=restaurant();importDoc.catalog.key='import-test';await page.locator('dialog textarea').fill(JSON.stringify(importDoc));await page.locator('[data-validate]').click();assert.match(await page.locator('[data-summary]').innerText(),/1 categorias · 1 produtos · 3 variações/);await page.locator('[data-apply]').click();
 await page.evaluate(()=>window.__lastToast='');await page.getByRole('button',{name:'Salvar catálogo',exact:true}).click();await page.waitForFunction(()=>window.__lastToast?.startsWith('Catálogo salvo'));
 const download=page.waitForEvent('download');await act('export').click();assert.match((await download).suggestedFilename(),/catalogo-import-test.json/);
 await page.setViewportSize({width:390,height:844});await act('product').click();
 assert.equal(await page.locator('[data-product-editor]').evaluate(el=>el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=innerWidth),true,'mobile editor must fit viewport');
 assert.equal(await page.locator('.catalog-admin .table-wrap').first().evaluate(el=>el.scrollWidth<=el.clientWidth),true,'mobile product list must fit viewport');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile overflow');
 await page.screenshot({path:'outputs/catalogos-editor-mobile.png',fullPage:true});
 await page.evaluate(async()=>{window.__catalog.unmount();window.__context.access.admin.funcao='visualizador';await window.__catalog.mount(document.querySelector('#app-content'),window.__context);});
 assert.equal(await page.locator('[data-catalog-action=new]').count(),0);await act('view').click();await act('product').click();assert.equal(await page.locator('[data-product-editor]').count(),1);assert.equal(await page.locator('[data-path$="products.0.name"]').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('Navegador: editor, cadastro, preço, biblioteca, import/export, mobile e somente leitura OK.');
}finally{await browser.close();server.close();await db.close();}
