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
const editionSeoMigration = read("supabase/migrations/20260717_eventos_edicoes_seo.sql");
assert(migration.includes("create table if not exists public.eventos_principais"), "migração cria eventos_principais");
assert(migration.includes("create table if not exists public.eventos_edicoes"), "migração cria eventos_edicoes");
assert(migration.includes("unique (evento_id, ano)"), "edições impedem ano duplicado no mesmo evento");
assert(migration.includes("enable row level security"), "RLS está habilitado nas novas tabelas");
assert(migration.includes("tem_permissao_admin('eventos'"), "políticas usam permissão administrativa de eventos");

const publicData = read("assets/js/services/publicDataService.js");
assert(editionSeoMigration.includes("add column if not exists seo_titulo"), "edicoes de eventos possuem titulo SEO no banco");
assert(editionSeoMigration.includes("add column if not exists seo_descricao"), "edicoes de eventos possuem descricao SEO no banco");
assert(publicData.includes('"eventos_principais"'), "serviço público permite eventos principais");
assert(publicData.includes('"eventos_edicoes"'), "serviço público permite edições");

const index = read("eventos/index.html");
assert(index.includes("eventos-page.js"), "página /eventos carrega o módulo público");
assert(existsSync("eventos/evento.html"), "existe página pública do evento principal");
assert(existsSync("eventos/edicao.html"), "existe página pública da edição");
assert(existsSync("assets/js/pages/evento-principal-page.js"), "existe script do evento principal");
assert(existsSync("assets/js/pages/evento-edicao-page.js"), "existe script da edição");

const eventoPrincipal = read("assets/js/pages/evento-principal-page.js");
const eventoEdicao = read("assets/js/pages/evento-edicao-page.js");
const eventosPage = read("assets/js/pages/eventos-page.js");
const eventosHelpers = read("assets/js/pages/eventos-helpers.js");
assert(eventoPrincipal.includes("function getEventSlug()"), "pagina do evento le slug pela URL bonita");
assert(eventoPrincipal.includes('parts[0] === "eventos"'), "evento principal funciona em /eventos/slug");
assert(eventoPrincipal.includes("event-public-hero"), "evento principal renderiza cabecalho visual");
assert(eventoPrincipal.includes("event-copy"), "evento principal renderiza historia do evento");
assert(eventoPrincipal.includes("event-editions-grid"), "evento principal renderiza edicoes em cards");
assert(eventoPrincipal.includes("definirMeta"), "evento principal possui SEO dinamico");
assert(eventoPrincipal.includes("canonical"), "evento principal define URL canonica");
assert(eventoEdicao.includes("function getRouteParams()"), "pagina da edicao le slug e ano pela URL bonita");
assert(eventoEdicao.includes('parts[0] === "eventos"'), "edicao funciona em /eventos/slug/ano");
assert(eventoEdicao.includes("seoTitle"), "edicao possui titulo SEO proprio");
assert(eventoEdicao.includes("seoDescription"), "edicao possui descricao SEO propria");
assert(eventoEdicao.includes("edicao.seo_titulo"), "edicao usa titulo SEO cadastrado quando existir");
assert(eventoEdicao.includes("edicao.seo_descricao"), "edicao usa descricao SEO cadastrada quando existir");
assert(eventoEdicao.includes("canonical"), "edicao define URL canonica propria");
assert(eventosPage.includes("Abrir evento"), "cards de eventos principais possuem botao abrir evento");
assert(eventosHelpers.includes("Abrir edição"), "cards de edicoes possuem botao abrir edicao");
assert(eventosPage.includes("data-event-principal-id"), "cards de eventos principais registram audiencia");
assert(eventosHelpers.includes("data-event-edition-id"), "cards de edicoes registram audiencia");

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

assert(admin.includes('["seo_titulo","Título SEO","text"]'), "painel permite titulo SEO em eventos e edicoes");
assert(admin.includes('["seo_descricao","Descrição SEO","textarea"]'), "painel permite descricao SEO em eventos e edicoes");

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
