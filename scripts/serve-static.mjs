import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 4173);
const host = process.argv[3] || process.env.HOST || "127.0.0.1";
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const config = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const shellPaths = new Set(config.rewrites.filter(rule => rule.destination === "/admin/index.html").map(rule => rule.source));

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = shellPaths.has(pathname) ? "admin/index.html" : pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    let file = normalize(join(root, relative));
    if (!file.startsWith(normalize(root))) throw new Error("invalid path");
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Não encontrado");
  }
}).listen(port, host, () => console.log(`http://${host}:${port}`));
