// Read-only smoke check against scripts/serve-public-ssr-local.mjs.
const base = process.argv[2] || "http://127.0.0.1:4177";
const paths = [
  "/",
  "/news/",
  "/guia.html",
  "/turismo.html",
  "/eventos/",
  "/noticias/1-festival-gastronomico-e-de-musica-urania",
  "/guia/mega-fome",
  "/turismo/cristo-redentor-de-urania",
  "/eventos/agenda/feira-livre-noturna",
  "/eventos/festa-do-peao-de-urania",
  "/eventos/festa-do-peao-de-urania/2026"
];

const results = await Promise.all(paths.map(async pathname => {
  try {
    const response = await fetch(new URL(pathname, base));
    const html = await response.text();
    const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
    const title = main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]*>/g, "") || "";
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || "";
    const expectedPublicLink = pathname === "/" ? /href="\/(?:noticias|guia|turismo)\// :
      pathname === "/news/" ? /href="\/noticias\// :
      pathname === "/guia.html" ? /href="\/guia\// :
      pathname === "/turismo.html" ? /href="\/turismo\// :
      pathname === "/eventos/" ? /href="\/eventos\/(?:agenda|[a-z0-9-]+)\// : null;
    return {
      pathname, status: response.status, mainChars: main.length, title,
      serverRendered: main.includes("data-server-rendered"),
      ogImages: (html.match(/property=["']og:image["']/g) || []).length,
      canonical,
      realLink: !expectedPublicLink || expectedPublicLink.test(main)
    };
  } catch (error) {
    return { pathname, error: error.message };
  }
}));

console.log(JSON.stringify(results, null, 2));
if (results.some(result => result.status !== 200 || !result.title || !result.serverRendered || result.ogImages !== 1 || !result.canonical || !result.realLink)) {
  process.exitCode = 1;
}
