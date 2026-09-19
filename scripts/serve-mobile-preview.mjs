import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const host = process.argv[2] || "127.0.0.1";
const port = Number(process.argv[3] || 4174);
const exactFiles = new Set([
  "favicon.ico",
  "favicon.svg",
  "apple-touch-icon.png",
  "manifest.webmanifest",
  "preview/home/home-preview.css"
]);
const allowedPrefixes = [
  "assets/",
  "preview/agenda/",
  "preview/guia/",
  "preview/iniciativas/",
  "preview/busca/",
  "preview/categorias/",
  "preview/quem-somos/",
  "preview/colabore/",
  "preview/divulgue/",
  "preview/cadastrar-empresa/",
  "preview/cadastrar-evento/",
  "preview/links/",
  "preview/noticias/politica-editorial/",
  "preview/noticias/sobre-publicacoes/",
  "preview/noticias/correcoes-transparencia-contato/",
  "preview/legal/",
  "preview/termos/",
  "preview/privacidade/",
  "preview/descadastrar/",
  "preview/melhores/",
  "preview/noticias/materia/",
  "preview/urania/"
];
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") throw new Error("method");
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let relative = normalize(pathname.replace(/^\/+/, "")).replaceAll("\\", "/");
    if (!relative || relative.includes("..")) throw new Error("path");
    if (!exactFiles.has(relative) && !allowedPrefixes.some(prefix => relative.startsWith(prefix))) throw new Error("denied");
    let file = normalize(join(root, relative));
    if (!file.startsWith(normalize(root))) throw new Error("path");
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Não encontrado");
  }
}).listen(port, host, () => console.log(`http://${host}:${port}`));
