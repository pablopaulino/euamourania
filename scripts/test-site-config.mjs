import fs from "node:fs";
import {execFileSync} from "node:child_process";

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const fail=message=>{throw new Error(message)};
const ok=(condition,message)=>condition||fail(message);

const admin=read("admin/site-settings.js");
const migration=read("supabase/migrations/20260629_configuracoes_globais.sql");
const publicModule=read("assets/js/pages/site-config-page.js");
const script=read("script.js");
const vercel=JSON.parse(read("vercel.json"));
const articleApi=read("api/noticia.js");
const newsletterApi=read("api/newsletter-send.js");

const keys=[...admin.matchAll(/\["([a-z0-9_]+)","/g)].map(match=>match[1]);
ok(keys.length>=75,`Poucos campos globais detectados: ${keys.length}`);
ok(new Set(keys).size===keys.length,"Há chaves duplicadas no editor de configurações");
const missing=keys.filter(key=>!migration.includes(`'${key}'`));
ok(!missing.length,`Chaves ausentes na migração: ${missing.join(", ")}`);

ok(script.includes('assets/js/pages/site-config-page.js'),"Módulo público não está carregado globalmente");
ok(publicModule.includes('fetchPublicRows("configuracoes_site"'),"Módulo público não consulta configurações_site");
ok(publicModule.includes("MutationObserver"),"Conteúdo inserido dinamicamente não é atualizado");
ok(publicModule.includes("safeHtml")&&publicModule.includes('querySelectorAll("script,style,object,embed")'),"Conteúdo HTML institucional não está sanitizado");
ok(admin.includes('inputType=type==="url"?"text":type'),"Campos de imagem ainda usam a validação nativa que rejeita caminhos /assets");
ok(admin.includes('inputmode="url" data-type="url"'),"Campos de URL perderam sua identificação semântica");
ok(admin.includes("validSiteReference(value)"),"Links e caminhos internos não possuem validação própria");
ok(admin.includes("/assets/imagem.jpg"),"O painel não orienta sobre caminhos internos de imagens");

const rootRewrite=vercel.rewrites?.find(item=>item.source==="/"&&!item.has);
ok(rootRewrite?.destination==="/api/home","A home não usa o SEO dinâmico da Vercel");
ok(articleApi.includes("dominio_principal")&&articleApi.includes("seo_publicador")&&articleApi.includes("seo_logo"),"SEO das notícias não usa a identidade global");
ok(newsletterApi.includes("logo_principal")&&newsletterApi.includes("texto_rodape"),"Newsletter não usa a identidade global");

for(const file of ["api/home.js","api/noticia.js","api/newsletter-send.js","assets/js/pages/site-config-page.js","admin/site-settings.js"]){
  execFileSync(process.execPath,["--check",file],{stdio:"pipe"});
}

const publicFiles=[publicModule,admin,articleApi,newsletterApi].join("\n");
ok(!/service[_-]?role/i.test(publicFiles),"Referência a Service Role encontrada na implementação global");
ok(!/BREVO_API_KEY\s*=\s*["'][^"']+/i.test(publicFiles),"Chave Brevo exposta no código");

console.log(`Configurações globais validadas: ${keys.length} campos, SEO e newsletter integrados.`);
