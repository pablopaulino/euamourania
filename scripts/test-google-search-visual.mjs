import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const exists = async path => {
  try {
    await access(new URL(path, root));
    return true;
  } catch {
    return false;
  }
};
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requiredAssets = [
  "favicon.ico",
  "favicon.svg",
  "favicon.png",
  "apple-touch-icon.png",
  "manifest.webmanifest",
  "assets/icons/favicon-48x48.png",
  "assets/icons/icon-192x192.png",
  "assets/icons/icon-512x512.png",
  "assets/icons/apple-touch-icon.png"
];

for (const asset of requiredAssets) {
  must(await exists(asset), `Arquivo de identidade ausente: ${asset}`);
}

const manifest = JSON.parse(await read("manifest.webmanifest"));
must(manifest.name === "Eu Amo Urânia", "Manifest não identifica corretamente o portal.");
must(manifest.icons?.some(icon => icon.sizes === "192x192"), "Manifest não possui ícone Android/PWA 192x192.");
must(manifest.icons?.some(icon => icon.sizes === "512x512"), "Manifest não possui ícone Android/PWA 512x512.");

const publicPages = [
  "index.html",
  "news/index.html",
  "guia.html",
  "turismo.html",
  "eventos/index.html",
  "links/index.html",
  "quem-somos.html"
];

for (const page of publicPages) {
  const html = await read(page);
  must(html.includes('rel="icon" href="/favicon.ico"'), `${page}: favicon.ico estável ausente.`);
  must(html.includes('rel="icon" href="/favicon.svg"'), `${page}: favicon.svg ausente.`);
  must(html.includes('rel="apple-touch-icon" href="/apple-touch-icon.png"'), `${page}: apple-touch-icon ausente.`);
  must(html.includes('rel="manifest" href="/manifest.webmanifest"'), `${page}: manifest ausente.`);
  must(html.includes('property="og:image"'), `${page}: og:image ausente.`);
  must(html.includes('name="twitter:image"'), `${page}: twitter:image ausente.`);
  must(html.includes('rel="canonical"'), `${page}: canonical ausente.`);
}

const [home, newsApi, sitemapApi, vercelSource] = await Promise.all([
  read("index.html"),
  read("api/noticia.js"),
  read("api/sitemaps.js"),
  read("vercel.json")
]);
const vercel = JSON.parse(vercelSource);

must(home.includes('"@type": "Organization"'), "Home não possui Organization.");
must(home.includes('"@type": "WebSite"'), "Home não possui WebSite.");
must(home.includes('"@type": "SearchAction"'), "Home não possui SearchAction.");
must(newsApi.includes('rel="manifest" href="/manifest.webmanifest"'), "Notícia server-side não anuncia manifest.");
must(newsApi.includes('rel="icon" href="${esc(favicon)}" sizes="any"'), "Notícia server-side não anuncia favicon estável.");
must(newsApi.includes("og:image:alt") && newsApi.includes("twitter:image:alt"), "Notícia server-side não inclui alt das imagens sociais.");
must(sitemapApi.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'), "Sitemap geral não anuncia namespace de imagens.");
must(sitemapApi.includes("<image:image>") && sitemapApi.includes("<image:loc>"), "Sitemap geral não inclui imagens das notícias.");
must(
  vercel.headers.some(item => item.source.includes("favicon.ico") && item.headers.some(header => header.key === "Cache-Control")),
  "Vercel não define cache para favicon/manifest."
);

console.log("Presença visual no Google validada: favicon, manifest, OG/Twitter, schema e sitemap de imagens.");
