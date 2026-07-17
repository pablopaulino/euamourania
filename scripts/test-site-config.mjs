import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const fail = message => { throw new Error(message); };
const ok = (condition, message) => condition || fail(message);

const admin = read("admin/site-settings.js");
const migration = read("supabase/migrations/20260629_configuracoes_globais.sql");
const publicModule = read("assets/js/pages/site-config-page.js");
const script = read("script.js");
const vercel = JSON.parse(read("vercel.json"));
const articleApi = read("api/noticia.js");
const newsletterApi = read("api/newsletter-send.js");

const keys = [...admin.matchAll(/\[\s*"([a-z0-9_]+)"\s*,\s*"/g)].map(match => match[1]);
const requiredKeys = [
  "nome_site",
  "descricao_site",
  "email_contato",
  "whatsapp",
  "instagram",
  "facebook",
  "youtube",
  "texto_rodape"
];
ok(keys.length >= requiredKeys.length, `Poucos campos globais detectados: ${keys.length}`);
const requiredMissing = requiredKeys.filter(key => !keys.includes(key));
ok(!requiredMissing.length, `Campos essenciais ausentes no editor: ${requiredMissing.join(", ")}`);
ok(new Set(keys).size === keys.length, "Há chaves duplicadas no editor de configurações");
const missing = requiredKeys.filter(key => !migration.includes(`'${key}'`));
ok(!missing.length, `Chaves essenciais ausentes na migração: ${missing.join(", ")}`);

ok(script.includes("assets/js/pages/site-config-page.js"), "Módulo público não está carregado globalmente");
ok(publicModule.includes('fetchPublicRows("configuracoes_site"'), "Módulo público não consulta configurações_site");
ok(publicModule.includes("MutationObserver"), "Conteúdo inserido dinamicamente não é atualizado");
ok(publicModule.includes("safeHtml") && publicModule.includes('querySelectorAll("script,style,object,embed")'), "Conteúdo HTML institucional não está sanitizado");
ok(/inputType\s*=\s*type\s*===\s*"url"\s*\?\s*"text"\s*:\s*type/.test(admin), "Campos de imagem ainda usam a validação nativa que rejeita caminhos /assets");
ok(/inputmode="url"\s+data-type="url"/.test(admin), "Campos de URL perderam sua identificação semântica");
ok(admin.includes("validSiteReference(value)"), "Links e caminhos internos não possuem validação própria");
ok(admin.includes("caminho interno"), "O painel não orienta sobre caminhos internos");

const rootRewrite = vercel.rewrites?.find(item => item.source === "/" && !item.has);
ok(rootRewrite?.destination === "/api/home", "A home não usa o SEO dinâmico da Vercel");
ok(articleApi.includes("dominio_principal") && articleApi.includes("seo_publicador") && articleApi.includes("seo_logo"), "SEO das notícias não usa a identidade global");
ok(newsletterApi.includes("logo_principal") && newsletterApi.includes("texto_rodape"), "Newsletter não usa a identidade global");

for (const file of ["api/home.js", "api/noticia.js", "api/newsletter-send.js", "assets/js/pages/site-config-page.js", "admin/site-settings.js"]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
}

const publicFiles = [publicModule, admin, articleApi, newsletterApi].join("\n");
ok(!/service[_-]?role/i.test(publicFiles), "Referência a Service Role encontrada na implementação global");
ok(!/BREVO_API_KEY\s*=\s*["'][^"']+/i.test(publicFiles), "Chave Brevo exposta no código");

console.log(`Configurações globais validadas: ${keys.length} campos essenciais, SEO e newsletter integrados.`);
