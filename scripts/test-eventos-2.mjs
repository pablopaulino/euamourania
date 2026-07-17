import { readFileSync, existsSync, readdirSync } from "node:fs";

const read = file => readFileSync(file, "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
};

const migration = read("supabase/migrations/20260717_eventos_2_0.sql");
assert(migration.includes("create table if not exists public.eventos_principais"), "migração cria eventos_principais");
assert(migration.includes("create table if not exists public.eventos_edicoes"), "migração cria eventos_edicoes");
assert(migration.includes("unique (evento_id, ano)"), "edições impedem ano duplicado no mesmo evento");
assert(migration.includes("enable row level security"), "RLS está habilitado nas novas tabelas");
assert(migration.includes("tem_permissao_admin('eventos'"), "políticas usam permissão administrativa de eventos");

const publicData = read("assets/js/services/publicDataService.js");
assert(publicData.includes('"eventos_principais"'), "serviço público permite eventos principais");
assert(publicData.includes('"eventos_edicoes"'), "serviço público permite edições");

const index = read("eventos/index.html");
assert(index.includes("eventos-page.js"), "página /eventos carrega o módulo público");
assert(existsSync("eventos/evento.html"), "existe página pública do evento principal");
assert(existsSync("eventos/edicao.html"), "existe página pública da edição");
assert(existsSync("assets/js/pages/evento-principal-page.js"), "existe script do evento principal");
assert(existsSync("assets/js/pages/evento-edicao-page.js"), "existe script da edição");

const vercel = read("vercel.json");
assert(vercel.includes('/eventos/:slug/:ano'), "Vercel reescreve edição anual de evento");
assert(vercel.includes('/eventos/:slug'), "Vercel reescreve página permanente do evento");

const sitemap = read("api/sitemaps.js");
assert(sitemap.includes("eventos_principais"), "sitemap inclui eventos principais");
assert(sitemap.includes("eventos_edicoes"), "sitemap inclui edições de eventos");

const search = read("assets/js/services/searchService.js");
assert(search.includes("evento_principal"), "busca global indexa eventos principais");
assert(search.includes("evento_edicao"), "busca global indexa edições");

const apiFunctions = readdirSync("api").filter(name => name.endsWith(".js"));
assert(apiFunctions.length <= 12, `projeto mantém até 12 funções serverless (${apiFunctions.length})`);

if (process.exitCode) process.exit(process.exitCode);
console.log("Eventos 2.0 validado.");
