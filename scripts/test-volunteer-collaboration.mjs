import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  migration,
  publicDataService,
  publicPage,
  pageScript,
  inviteScript,
  newsIndex,
  newsDetails,
  adminIndex,
  adminScript,
  adminAccessControl,
  adminAuth,
  sitemap,
  searchService
] = await Promise.all([
  read("supabase/migrations/20260716_colaboradores_voluntarios.sql"),
  read("assets/js/services/publicDataService.js"),
  read("colabore/index.html"),
  read("assets/js/pages/colabore-page.js"),
  read("assets/js/pages/colabore-public.js"),
  read("news/index.html"),
  read("news-details.html"),
  read("admin/index.html"),
  read("admin/admin.js"),
  read("admin/access-control.js"),
  read("admin/auth.js"),
  read("api/sitemaps.js"),
  read("assets/js/services/searchService.js")
]);

must(migration.includes("create table if not exists public.colaboradores_voluntarios"), "Tabela de colaboradores voluntarios ausente.");
must(migration.includes("public.enviar_colaboracao_voluntaria"), "RPC publico de colaboracao ausente.");
must(migration.includes("p_website text default null"), "Honeypot anti-spam ausente na RPC.");
must(migration.includes("aceite_voluntario is true"), "Aceite voluntario obrigatorio ausente.");
must(migration.includes("enable row level security"), "RLS ausente na tabela de colaboradores.");
must(migration.includes("grant execute on function public.enviar_colaboracao_voluntaria"), "Grant da RPC ausente.");

must(publicDataService.includes('"enviar_colaboracao_voluntaria"'), "RPC nao liberada no publicDataService.");
must(publicPage.includes("colabore-page.js"), "Pagina publica nao carrega o script do formulario.");
must(publicPage.includes("volunt") && publicPage.includes("remunera"), "Pagina publica precisa deixar claro o carater voluntario.");
must(pageScript.includes("callPublicRpc(\"enviar_colaboracao_voluntaria\""), "Formulario nao envia para a RPC correta.");
must(pageScript.includes("p_website"), "Formulario nao envia o honeypot.");
must(inviteScript.includes("/colabore/"), "Convite publico nao aponta para /colabore/.");
must(newsIndex.includes("colabore-public.js"), "Convite voluntario ausente na pagina de noticias.");
must(newsDetails.includes("colabore-public.js"), "Convite voluntario ausente na noticia individual.");

must(adminIndex.includes('data-view="colaboradores_voluntarios"'), "Menu administrativo de colaboracoes ausente.");
must(adminScript.includes("colaboradores_voluntarios"), "Recurso administrativo de colaboradores ausente.");
must(adminScript.includes("colaboradoresNovos") && adminScript.includes("recentCollaborators"), "Dashboard nao integra colaboradores voluntarios.");
must(adminAccessControl.includes("colaboradores_voluntarios") && adminAccessControl.includes("colaboradores"), "Menu dinamico nao conhece colaboradores.");
must(adminAuth.includes("colaboradores:*"), "Permissoes administrativas de colaboradores ausentes.");
must(adminScript.includes('type==="tags"'), "Campo de interesses como tags ausente.");
must(adminScript.includes('type==="volunteer-status"'), "Status dos colaboradores ausente.");
must(adminScript.includes('split(",")'), "Conversao de interesses para lista ausente.");

must(sitemap.includes('"/colabore/"'), "Pagina /colabore/ ausente do sitemap.");
must(searchService.includes('url: "/colabore/"'), "Pagina /colabore/ ausente da busca global.");

console.log("Colaboracao voluntaria validada: formulario publico, RPC, painel, busca e sitemap integrados.");
