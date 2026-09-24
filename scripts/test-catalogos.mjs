import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog, parseCatalog, duplicateCatalog } from '../assets/js/catalog-schema.mjs';
import { restaurant,florist,clothing } from './fixtures/catalogos-v1.mjs';
import { existsSync } from 'node:fs';
for(const make of [restaurant,florist,clothing]){
 const d=make();assert.deepEqual(validateCatalog(d).errors,[]);assert.deepEqual(parseCatalog(JSON.stringify(d)).doc,d);const copy=duplicateCatalog(d);assert.notEqual(copy.catalog.key,d.catalog.key);assert.equal(copy.catalog.status,'rascunho');assert.equal(validateCatalog(copy).valid,true);
}
const official=JSON.parse(await readFile(new URL('../modelos/catalogo-exemplo-v1.json',import.meta.url),'utf8'));
assert.equal(validateCatalog(official).valid,true);
const exampleProducts=official.catalog.categories.flatMap(category=>category.products);
assert.ok(exampleProducts.some(product=>product.price_mode==='fixo'&&product.price_cents>0&&product.images.some(image=>image.url.startsWith('https://'))));
assert.ok(exampleProducts.some(product=>product.price_mode==='variacoes'&&product.variants.length&&product.option_groups.some(group=>group.min>0)&&product.option_groups.some(group=>group.min===0&&group.options.some(option=>option.price_cents>0))));
const invalid=mutate=>{const d=restaurant();mutate(d,d.catalog.categories[0].products[0]);assert.equal(validateCatalog(d).valid,false);};
invalid(d=>d.version=2);invalid(d=>d.catalog.extra='ignored?');invalid((d,p)=>p.key=d.catalog.key);invalid((d,p)=>p.variants[0].price_cents=32.50);invalid((d,p)=>p.images=[{url:'javascript:alert(1)'}]);invalid((d,p)=>p.variants.push({...p.variants[0],key:'new'}));invalid((d,p)=>p.option_groups[0].min=3);invalid((d,p)=>p.option_groups[0].options[0].product_key='missing');invalid((d,p)=>p.option_groups[0].options[0].product_key='pizza');invalid((d,p)=>p.promo_price_cents=5000);
invalid((d,p)=>{const second=structuredClone(p);second.key='pizza-two';second.variants=[];second.option_groups=[];second.price_mode='fixo';second.price_cents=1000;p.option_groups[0].options[0].product_key='pizza-two';second.option_groups=[{key:'group-two',name:'Escolha',order:0,min:0,max:1,selection:'unica',options:[{key:'option-two',name:'Pizza',order:0,price_cents:0,available:true,quantity:1,product_key:'pizza'}]}];d.catalog.categories[0].products.push(second);});
assert.throws(()=>parseCatalog('{'),/JSON inválido/);
assert.throws(()=>parseCatalog(' '.repeat(5242881)),/5 MB/);
const sql=await readFile(new URL('../supabase/migrations/20260924_viva_catalogos.sql',import.meta.url),'utf8');
assert.match(sql,/enable row level security/);assert.match(sql,/revoke all on public/);assert.match(sql,/for update/);assert.match(sql,/revision<>p_revision/);
console.log('Catálogos: contratos, cenários genéricos, cópia e validação OK.');

// Opcional: PostgreSQL WASM local, nunca Supabase remoto.
if(process.argv.includes('--database')){
 if(!existsSync(new URL('../outputs/catalogos-tools/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url)))throw new Error('Ferramenta local ausente. Rode: npm install --prefix outputs/catalogos-tools --no-save --package-lock=false @electric-sql/pglite playwright');
 const {PGlite}=await import('../outputs/catalogos-tools/node_modules/@electric-sql/pglite/dist/index.js');
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;insert into auth.users values(auth.uid());create table public.guia_comercial(id uuid primary key,nome text);insert into public.guia_comercial values('00000000-0000-0000-0000-000000000002','Teste local'),('00000000-0000-0000-0000-000000000003','Outra empresa');create function public.tem_permissao_admin(text,text) returns boolean language sql as $$select coalesce(current_setting('test.permission',true),'yes')='yes' or (current_setting('test.permission',true)='read' and $2='ler')$$;`);
 await db.exec(sql);
 // Existing media contract stubbed locally; the real updated SQL is executed.
 await db.exec(`alter table guia_comercial add column imagem_url text,add column galeria_urls jsonb;`);
 const mediaTables={noticias:'imagem_url text,seo_imagem text,conteudo_html text',turismo:'imagem_url text,galeria_urls jsonb,conteudo_html text',eventos:'imagem_url text',eventos_principais:'imagem_capa_url text,galeria_historica jsonb,historia_html text',eventos_edicoes:'cartaz_url text,banner_url text,galeria jsonb,patrocinadores jsonb,programacao_html text,atracoes_html text,resumo_pos_evento_html text',newsletters:'imagem_url text,conteudo_html text,configuracao_futura jsonb',campanhas_publicitarias:'imagem_url text,logo_empresa_url text,configuracao_futura jsonb',melhores_edicoes:'imagem_capa_url text,regulamento text,metodologia text',melhores_categorias:'imagem_url text',melhores_indicados:'imagem_url text,descricao_completa text',app_melhores_vencedores:'imagem_url text',configuracoes_site:'valor text'};
 for(const [table,columns]of Object.entries(mediaTables))await db.exec(`create table public.${table}(${columns})`);
 await db.exec(`create table public.cms_midias(id uuid primary key default gen_random_uuid(),caminho text,url text,pasta text,nome_original text,mime_type text,tamanho bigint,largura integer,altura integer,variante text,criado_em timestamptz default now());create function public.is_super_admin() returns boolean language sql as $$select true$$;`);
 const previousMedia=await readFile(new URL('../supabase/migrations/20260701_cms_media_library.sql',import.meta.url),'utf8');
 await db.exec(previousMedia.slice(previousMedia.indexOf('create or replace function public.listar_midias_cms()'),previousMedia.indexOf('revoke all on function public.midia_cms_em_uso(text)')));
 // Simula o remoto: PUBLIC e as duas roles têm EXECUTE antes da migration.
 await db.exec('create function public.midia_cms_em_uso(text) returns boolean language sql as $$select false$$;grant execute on function public.midia_cms_em_uso(text),public.listar_midias_cms() to public,anon,authenticated;');
 const beforePrivileges=(await db.query(`select has_function_privilege('anon','public.midia_cms_em_uso(text)','EXECUTE') anon_helper,has_function_privilege('authenticated','public.midia_cms_em_uso(text)','EXECUTE') admin_helper,has_function_privilege('anon','public.listar_midias_cms()','EXECUTE') anon_list,has_function_privilege('authenticated','public.listar_midias_cms()','EXECUTE') admin_list`)).rows[0];
 assert.deepEqual(beforePrivileges,{anon_helper:true,admin_helper:true,anon_list:true,admin_list:true});
 await db.exec(await readFile(new URL('../supabase/migrations/20260924_viva_catalogos_midias.sql',import.meta.url),'utf8'));
 const privileges=(await db.query(`select has_function_privilege('anon','public.midia_cms_em_uso(text)','EXECUTE') anon_helper,has_function_privilege('authenticated','public.midia_cms_em_uso(text)','EXECUTE') admin_helper,has_function_privilege('anon','public.listar_midias_cms()','EXECUTE') anon_list,has_function_privilege('authenticated','public.listar_midias_cms()','EXECUTE') admin_list`)).rows[0];
 assert.deepEqual(privileges,{anon_helper:false,admin_helper:false,anon_list:false,admin_list:true});
 const paths=(await db.query("select proname,proconfig from pg_proc where pronamespace='public'::regnamespace and proname in ('midia_cms_em_uso','listar_midias_cms','salvar_catalogo','excluir_catalogo')")).rows;
 assert.equal(paths.length,4);for(const fn of paths)assert.ok(fn.proconfig.some(v=>/^search_path=pg_catalog,\s*pg_temp$/.test(v)),`${fn.proname}: search_path inseguro: ${fn.proconfig}`);
 const company='00000000-0000-0000-0000-000000000002';
 const save=async(d,id=null,revision=null)=>(await db.query('select public.salvar_catalogo($1,$2::jsonb,$3,$4) id',[company,JSON.stringify(d),id,revision])).rows[0].id;
 const load=async id=>(await db.query('select public.exportar_catalogo($1) data',[id])).rows[0].data;
 for(const make of [restaurant,florist,clothing]){const id=await save(make());const r=await load(id);assert.equal(validateCatalog(r.document).valid,true,JSON.stringify(validateCatalog(r.document).errors));assert.equal(r.document.catalog.name,make().catalog.name);}
 const initial=restaurant();initial.catalog.key='test-update';initial.catalog.categories[0].products[0].images=[{url:'https://example.com/local-test.jpg',alt:'Teste isolado'}];const id=await save(initial);
 assert.equal((await db.query("select midia_cms_em_uso('https://example.com/local-test.jpg') used")).rows[0].used,true);
 await db.exec("insert into public.cms_midias(caminho,url,pasta,variante) values('local-test.jpg','https://example.com/local-test.jpg','catalogos','otimizada')");
 await db.exec('set role authenticated');assert.equal((await db.query('select em_uso from public.listar_midias_cms()')).rows[0].em_uso,true);await assert.rejects(db.query("select midia_cms_em_uso('https://example.com/local-test.jpg')"),/permission/);await db.exec('reset role');
 assert.equal((await db.query("select midia_cms_em_uso('https://example.com/unused.jpg') used")).rows[0].used,false);
 const before=(await db.query('select id from catalogo_produtos where catalogo_id=$1',[id])).rows[0].id;
 let r=await load(id);r.document.catalog.name='Atualizado';await save(r.document,id,r.revision);
 assert.equal((await db.query('select id from catalogo_produtos where catalogo_id=$1',[id])).rows[0].id,before);
 await assert.rejects(save(r.document,id,r.revision),/Outro administrador/);
 await assert.rejects(save(initial),/unique|duplicate/);
 // A matching external identity must not produce a second catalog.
 const external=florist();external.catalog.key='external';external.catalog.external_id='partner-123';const externalId=await save(external);external.catalog.key='another-key';await assert.rejects(save(external),/unique|duplicate/);
 // Stable variant IDs permit swapping attribute combinations in a single transaction.
 let variantDoc=await load(externalId);const vs=variantDoc.document.catalog.categories[0].products[0].variants;[vs[0].attributes,vs[1].attributes]=[vs[1].attributes,vs[0].attributes];await save(variantDoc.document,externalId,variantDoc.revision);
 // SQL-side validation still applies if a caller bypasses the frontend validator.
 for(const mutate of [d=>d.version=9,d=>d.catalog.unexpected=true,d=>d.catalog.categories[0].active='true',d=>d.catalog.categories[0].products[0].variants[0].price_cents=1.5]){const invalid=restaurant();invalid.catalog.key=crypto.randomUUID();mutate(invalid);await assert.rejects(save(invalid));}
 r=await load(id);const bad=structuredClone(r.document);bad.catalog.categories[0].products[0].variants[0].price_cents=-10;
 await assert.rejects(save(bad,id,r.revision));assert.equal((await load(id)).revision,r.revision);
 bad.catalog.categories[0].products[0].variants[0].price_cents=1000;bad.catalog.categories[0].products[0].option_groups[0].options[0].product_key='pizza';await assert.rejects(save(bad,id,r.revision),/combo/);
 await db.exec(`set test.permission='read';set role authenticated;`);
 assert.equal((await load(id)).document.catalog.name,'Atualizado');await assert.rejects(save(r.document,id,r.revision),/permissão/);await assert.rejects(db.exec("update catalogos set name='hack'"),/permission/);
 await db.exec('reset role;set test.permission=\'no\';set role authenticated;');assert.equal(await load(id),null);await assert.rejects(save(initial),/permissão/);
 await db.exec('reset role;set role anon;');await assert.rejects(load(id),/permission/);await assert.rejects(db.query('select * from catalogos'),/permission/);
 await db.exec('reset role;set test.permission=\'yes\';');
 r=await load(id);r.document.catalog.categories[0].products=[];await save(r.document,id,r.revision);assert.equal((await db.query('select count(*)::int n from catalogo_produtos where catalogo_id=$1',[id])).rows[0].n,0);
 r=await load(id);await db.query('select excluir_catalogo($1,$2)',[id,r.revision]);assert.equal(await load(id),null);
 assert.equal((await db.query("select midia_cms_em_uso('https://example.com/local-test.jpg') used")).rows[0].used,false);
 const linkedDoc=restaurant();linkedDoc.catalog.key='linked-company-test';const linked=await save(linkedDoc);await assert.rejects(db.query('delete from guia_comercial where id=$1',[company]),/foreign key/);await db.query('select excluir_catalogo($1,$2)',[linked,1]);
 await db.close();console.log('PostgreSQL local: migration, CRUD, múltiplos catálogos, round-trip, IDs, rollback, revisão concorrente e RLS OK.');
}
