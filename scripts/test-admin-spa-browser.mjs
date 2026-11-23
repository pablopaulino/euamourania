import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "../outputs/catalogos-tools/node_modules/playwright/index.mjs");
import { resolve, extname } from "node:path";

// Run the real shell, router and modules with a local PostgREST-shaped fixture.
function mockClient() {
  let transport;
  function query(table) {
    const params = new URLSearchParams();
    let single = false;
    let method = "GET";
    return new Proxy({}, {
      get(_, name) {
        if (name === "then") return (ok, fail) => {
          const url = new URL("/rest/v1/" + table, location.origin);
          url.search = params;
          transport(url, {method}).then(async response => {
            const rows = method === "HEAD" ? [] : await response.json();
            return {data:single ? rows[0] || null : rows, count:rows.length, error:null};
          }).then(ok, fail);
        };
        return function(...args) {
          params.append(name, JSON.stringify(args));
          single ||= name === "single" || name === "maybeSingle";
          if (name === "select" && args[1]?.head) method = "HEAD";
          if (name === "update") method = "PATCH";
          return this;
        };
      }
    });
  }
  const db = {
    auth: {onAuthStateChange() {}, async getSession() { return {data:{session:{user:{id:"user"}}}}; }},
    from: query, rpc: () => Promise.resolve({data:[], error:null})
  };
  return options => { transport ||= options?.global.fetch; return db; };
}

const queries = [];
let role = "super_admin";
const config = JSON.parse(await readFile("vercel.json", "utf8"));
const routes = config.rewrites.filter(r => r.destination === "/admin/index.html").map(r => r.source);
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.endsWith("/supabaseClient.js")) {
      res.setHeader("Content-Type","text/javascript");
      return res.end("export const supabaseConfigurado=()=>true;export const getSupabase=(" + mockClient.toString() + ")();");
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      queries.push([req.method, url.pathname, url.search]);
      const rows = url.pathname.endsWith("/usuarios_admin") ? [{id:"user", nome:"Equipe", funcao:role, ativo:true}] :
        url.pathname.endsWith("/guia_comercial") ? [{id:"company",nome:"Empresa de teste",status:"publicado"}] :
        url.pathname.endsWith("/noticias") ? [{id:"article", titulo:"Matéria local", slug:"materia-local", status:"rascunho"}] : [];
      res.setHeader("Content-Type","application/json");
      return res.end(JSON.stringify(rows));
    }
    let path = routes.includes(url.pathname) ? "/admin/index.html" : url.pathname;
    const filename = resolve("." + path);
    if (!filename.startsWith(resolve(".") + (process.platform === "win32" ? "\\" : "/"))) throw Error("invalid path");
    res.setHeader("Content-Type", ({".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png"})[extname(path)] || "application/octet-stream");
    res.end(await readFile(filename));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
let browser, page;
try {
  browser = await chromium.launch({channel:"chrome", headless:true});
  page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route(/^https:\/\//, route => route.abort());
  const base = "http://127.0.0.1:" + server.address().port;
  await page.addInitScript(() => {
    window.Quill = class {
      constructor(selector) { this.root = document.querySelector(selector); }
      on() {}
      disable() {}
      static find() { return null; }
    };
  });
  await page.goto(base + "/admin/noticias");
  const nav = page.locator(".admin-nav");
  const news = page.locator("#news-search");
  await news.fill("local");
  await page.evaluate(() => { window.shellMarker = 42; });
  const reads = () => queries.filter(([method,path]) => method === "GET" && path === "/rest/v1/noticias").length;
  const before = reads();
  const navCount = await nav.locator("button").count();
  assert.equal(navCount,17);
  for (const [view, ready] of [["publicidade","#metrics .metric-card strong"],["melhores",".awards-tabs"],["guia_comercial","#resource-search"],["dashboard",".ops-dashboard"]]) {
    await nav.locator('[data-view="' + view + '"]').click();
    await page.locator(ready).first().waitFor();
    assert.equal(await nav.locator(".active").count(),1);
  }
  const eventReads = () => queries.filter(([,path]) => path.endsWith("/analytics_eventos")).length;
  const initialEventReads = eventReads();
  for (const days of [14, 30, 7]) {
    const period = page.locator(`[data-period="${days}"]`);
    await period.click();
    assert.equal(await period.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(".cock-point").count(), days);
  }
  await page.locator(".cock-point").first().focus();
  assert.equal(await page.locator(".cock-point:focus").count(), 1);
  assert.equal(eventReads(), initialEventReads);
  const afterDashboard = reads();
  await nav.locator('[data-view="noticias"]').click();
  await news.waitFor();
  assert.equal(await news.inputValue(),"local");
  assert.equal(reads(),afterDashboard);
  assert.equal(await page.evaluate(() => window.shellMarker),42);
  assert.equal(queries.filter(([,p,q]) => p.endsWith("/usuarios_admin") && q.includes("maybeSingle")).length,1);
  await page.locator("#refresh-data").click();
  await page.waitForFunction(() => document.querySelector("#news-search")?.value === "");
  assert.ok(reads() > afterDashboard && before > 0);
  await page.locator('#section-tabs [data-view="automacao_editorial"]').click();
  await page.waitForURL("**/admin/automacao-editorial");
  await page.goBack();
  await news.waitFor();
  assert.equal(await nav.locator("button").count(),navCount);
  await page.locator("[data-news-edit]").click();
  await page.waitForURL("**/admin/noticia-editor?id=article");
  await page.locator("#news-form [name=titulo]").fill("Matéria editada");
  await page.locator("#news-form [data-save-status=rascunho]").click();
  await news.waitFor();
  assert.ok(queries.some(([m,path]) => m === "PATCH" && path.endsWith("/noticias")));
  await nav.locator('[data-view="guia_comercial"]').click();
  await page.locator("#page-primary-action [data-new]").click();
  await page.locator("#resource-form select[name=cms_categoria_id]").waitFor();
  await page.locator("#resource-form [data-cancel]").click();
  await page.locator("#resource-search").waitFor();
  await nav.locator('[data-view="publicidade"]').click();
  await page.locator('[data-tab="positions"]').click();
  await page.locator("#positions-view .placement-item").first().waitFor();
  await nav.locator('[data-view="noticias"]').click();
  await news.waitFor();
  await nav.locator('[data-view="publicidade"]').click();
  await page.locator("#positions-view .placement-item").first().waitFor();
  await nav.locator('[data-view="categorias"]').click();
  await page.locator("#cat-search").waitFor();
  await page.locator("#page-primary-action button").click();
  await page.locator("#category-form").waitFor();
  await page.locator("[data-back-categories]").click();
  await page.locator("#cat-search").waitFor();
  await nav.locator('[data-view="viva_assinaturas"]').click();
  await page.locator(".viva-btn-manage").first().click();
  await page.waitForURL("**/admin/viva-assinaturas?guia_id=company");
  await page.locator("#subscription-back").click();
  await page.locator(".viva-btn-manage").first().waitFor();
  await nav.locator('[data-view="telefones_uteis"]').click();
  await page.locator('#section-tabs [data-view="natal_premiado"]').click();
  await page.locator('button[data-new="prizes"]').click();
  await page.locator('#natal-form [name="name"]').waitFor();
  assert.equal(await page.evaluate(() => window.shellMarker),42);
  await page.setViewportSize({width:390,height:844});
  await page.locator("#mobile-menu").click();
  await nav.locator('[data-view="guia_comercial"]').click();
  await page.locator("#resource-search").waitFor();
  assert.equal(await page.locator("#sidebar").evaluate(el=>el.classList.contains("open")),false);
  role = "comercial";
  await page.goto(base + "/admin/usuarios.html");
  await page.waitForURL("**/admin");
  await page.locator(".ops-dashboard").waitFor();
  assert.equal(await nav.locator('[data-view="usuarios"]').count(),0);
  assert.equal(await nav.getByRole("button",{name:"Central de Comunicação",includeHidden:true}).getAttribute("data-view"),"submissoes");
  assert.deepEqual(errors,[]);
  console.log("SPA validada em desktop e celular: histórico, cache, filtros, atualização, sessão e permissões.");
} catch (error) {
  console.error(await page?.locator("#app-content").innerText({timeout:1500}).catch(() => "Sem painel"));
  throw error;
} finally { await browser?.close(); server.close(); }
