import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Emulates the public Vercel rewrites locally for visual and raw-HTML checks.
// It is intentionally not part of the production routing or deployment.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const renderDetail = require("../api/noticia.js");
const renderHome = require("../api/home.js");
const port = Number(process.argv[2] || 4177);
const host = process.argv[3] || "127.0.0.1";
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json"
};

function route(pathname) {
  if (pathname === "/") return { handler: renderHome, query: {} };
  if (pathname === "/news" || pathname === "/news/") {
    return { handler: renderDetail, query: { tipo: "news-list" } };
  }
  if (pathname === "/guia.html") return { handler: renderDetail, query: { tipo: "guide-list" } };
  if (pathname === "/turismo.html") return { handler: renderDetail, query: { tipo: "tourism-list" } };
  if (pathname === "/eventos" || pathname === "/eventos/") {
    return { handler: renderDetail, query: { tipo: "agenda-list" } };
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "noticias" && parts.length === 2) {
    return { handler: renderDetail, query: { tipo: "news", slug: parts[1] } };
  }
  if (parts[0] === "guia" && parts.length === 2) {
    return { handler: renderDetail, query: { tipo: "guia", slug: parts[1] } };
  }
  if (parts[0] === "turismo" && parts.length === 2) {
    return { handler: renderDetail, query: { tipo: "turismo", slug: parts[1] } };
  }
  if (parts[0] === "eventos" && parts[1] === "agenda" && parts.length === 3) {
    return { handler: renderDetail, query: { tipo: "social", mode: "event-detail", slug: parts[2] } };
  }
  if (parts[0] === "eventos" && parts.length === 3) {
    return { handler: renderDetail, query: { tipo: "social", mode: "event-edition", slug: parts[1], ano: parts[2] } };
  }
  if (parts[0] === "eventos" && parts.length === 2) {
    return { handler: renderDetail, query: { tipo: "social", mode: "event-main", slug: parts[1] } };
  }
  return null;
}

async function serveFile(pathname, response) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let file = normalize(join(root, relative));
  if (!file.startsWith(normalize(root))) throw new Error("invalid path");
  if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  const body = await readFile(file);
  response.writeHead(200, {
    "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    const match = route(pathname);
    if (!match) return await serveFile(pathname, response);

    const query = { ...Object.fromEntries(url.searchParams), ...match.query };
    const req = { method: request.method, url: request.url, headers: request.headers, query };
    const res = {
      statusCode: 200,
      headers: { "Cache-Control": "no-store" },
      setHeader(name, value) { this.headers[name] = value; return this; },
      status(code) { this.statusCode = code; return this; },
      send(body) {
        response.writeHead(this.statusCode, { ...this.headers, "Cache-Control": "no-store" });
        response.end(body);
        return this;
      }
    };
    await match.handler(req, res);
  } catch (error) {
    console.error("local SSR preview:", error);
    if (!response.headersSent) response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Não foi possível carregar a prévia local");
  }
}).listen(port, host, () => console.log(`http://${host}:${port}`));
