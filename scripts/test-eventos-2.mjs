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

const admin = read("admin/admin.js");
const access = read("admin/access-control.js");
assert(admin.includes('["descricao_curta","Descrição curta"'), "painel usa acentos corretos em eventos principais");
assert(admin.includes('["evento_id","Evento principal","event-principal-select"'), "edições usam seletor de evento principal em vez de ID manual");
assert(admin.includes("carregarSelectEventosPrincipais"), "painel carrega eventos principais no seletor");
assert(admin.includes('["galeria_historica","Galeria histórica","url-list"'), "galeria histórica usa campo amigável por linhas");
assert(admin.includes('["patrocinadores","Patrocinadores","line-list"'), "patrocinadores não exigem JSON manual");
assert(admin.includes('value===undefined&&name==="ativo"?true'), "evento principal novo nasce ativo por padrão");
assert(access.includes('eventosEdicoesNav[1] = "Edições"'), "menu do painel corrige o texto Edições");

const media = read("admin/media-upload.js");
assert(media.includes("eventos_principais:\"eventos/principais\""), "biblioteca de mídia atende eventos principais");
assert(media.includes("imagem_capa_url"), "imagem de capa usa biblioteca de mídia");
assert(media.includes("cartaz_url"), "cartaz da edição usa biblioteca de mídia");
assert(media.includes("banner_url"), "banner da edição usa biblioteca de mídia");

const categories = read("admin/category-fields.js");
assert(categories.includes("eventos_principais:{tipo:\"eventos\""), "eventos principais usam categorias do tipo eventos");
assert(categories.includes('nameField:"categoria"'), "categoria do evento principal salva no campo correto");

const apiFunctions = readdirSync("api").filter(name => name.endsWith(".js"));
assert(apiFunctions.length <= 12, `projeto mantém até 12 funções serverless (${apiFunctions.length})`);

if (process.exitCode) process.exit(process.exitCode);
console.log("Eventos 2.0 validado.");
