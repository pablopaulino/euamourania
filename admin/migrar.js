import { exigirAdministrador } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { gerarSlug } from "../assets/js/utils.js";

const linksIniciais = [["Nosso site","https://euamourania.com.br/","ðŸŒ"],["Canal WhatsApp","https://whatsapp.com/channel/0029VapPdlLGpLHTXQELk210","ðŸ’¬"],["WhatsApp","https://wa.me/5517976005583","ðŸ“±"],["YouTube","https://www.youtube.com/@EuAmoUr%C3%A2nia","â–¶ï¸"],["Instagram","https://instagram.com/euamourania","ðŸ“·"],["Facebook","https://facebook.com/euamourania","ðŸ‘¥"],["X (Twitter)","https://x.com/euamourania","ð•"],["TikTok","https://tiktok.com/@euamourania","ðŸŽµ"]].map(([titulo,url,icone],ordem)=>({titulo,url,icone,ordem,status:"ativo"}));
const allowedStatus = new Set(["rascunho","publicado","arquivado"]);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const textoPuro = (html = "") => { const el = document.createElement("div"); el.innerHTML = html; return (el.textContent || "").replace(/\s+/g, " ").trim(); };

let root = document;
let shellContainer = null;
let moduleContext = {};
let acesso = null;
let statusEl = null;
let migrationButton = null;
let importState = { itens: [], arquivo: null };
let cleanupHandlers = [];
let mounted = false;
let runId = 0;

const $ = selector => root.querySelector(selector);

function addCleanup(handler) {
  cleanupHandlers.push(handler);
}

function addListener(target, event, handler, options) {
  target?.addEventListener(event, handler, options);
  addCleanup(() => target?.removeEventListener(event, handler, options));
}

function getDb() {
  return moduleContext.db || getSupabase();
}

function ensureImportStyles() {
  if (document.getElementById("guide-json-styles")) return;
  const style = document.createElement("style");
  style.id = "guide-json-styles";
  style.textContent = `.importacao-module .guide-import-panel{margin-bottom:1.5rem}.importacao-module .guide-import-grid{display:grid;grid-template-columns:1fr auto;gap:1rem;align-items:end}.importacao-module .guide-file-box{padding:1.2rem;border:2px dashed #bdd0d7;border-radius:14px;background:#f8fbfc}.importacao-module .guide-file-box input{margin-top:.7rem}.importacao-module .guide-import-actions{display:flex;gap:.65rem;flex-wrap:wrap}.importacao-module .guide-import-note{margin:.8rem 0;padding:.8rem 1rem;border-radius:9px;background:#eaf4f6;color:#234b58}.importacao-module .guide-import-note.error{background:#fde8e5;color:#8e271c}.importacao-module .guide-preview{margin-top:1rem}.importacao-module .guide-preview table{min-width:760px}.importacao-module .guide-preview small{display:block;color:#657780}.importacao-module .guide-import-stats{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1rem}.importacao-module .guide-import-stats span{padding:.4rem .65rem;border-radius:999px;background:#e6f0f3;color:#0b4f6c;font-size:.75rem;font-weight:750}@media(max-width:760px){.importacao-module .guide-import-grid{grid-template-columns:1fr}.importacao-module .guide-import-actions{flex-direction:column}.importacao-module .guide-import-actions .admin-button{width:100%}}`;
  document.head.append(style);
  addCleanup(() => style.remove());
}

function renderShell(container) {
  container.classList.add("importacao-module");
  container.innerHTML = `<section class="panel"><div class="panel-header"><div><h2>ImportaÃ§Ã£o segura</h2><p>Transfere notÃ­cias, guia, turismo, categorias e links para o Supabase. Nenhuma Secret Key Ã© utilizada.</p></div></div><div class="resource-form"><div class="full-row"><p>VocÃª pode repetir a operaÃ§Ã£o: notÃ­cias, guia, turismo e categorias sÃ£o atualizados pelo slug; links existentes nÃ£o sÃ£o duplicados.</p><button id="run-migration" class="admin-button" type="button">Migrar dados agora</button><p id="migration-status" class="form-message" role="status">Verificando acessoâ€¦</p></div></div></section>`;
}

async function lerJson(caminho) {
  const response = await fetch(caminho, { cache: "no-store" });
  if (!response.ok) throw new Error(`NÃ£o foi possÃ­vel ler ${caminho}.`);
  const texto = await response.text();
  try { return JSON.parse(texto); }
  catch { return JSON.parse(texto.replace(/,\s*]/g, "]")); }
}

async function migrar() {
  if (!migrationButton || !statusEl) return;
  migrationButton.disabled = true;
  statusEl.textContent = "Lendo os dados e preparando a importaÃ§Ã£oâ€¦";
  const localRun = runId;
  const supabase = getDb();
  try {
    const [noticiasAntigas, guiaAntigo] = await Promise.all([lerJson("../news-data.json"), lerJson("../guia-data.json")]);
    const noticias = noticiasAntigas.map(item => {
      const resumo = textoPuro(item.content).slice(0, 240);
      return { titulo:item.title, slug:gerarSlug(item.title), resumo, conteudo_html:item.content || "", imagem_url:item.image || null, categoria_nome:"NotÃ­cias", autor:(item.author || "Equipe Eu Amo UrÃ¢nia").replace(/^\s*Por\s+/i, ""), status:"publicado", destaque:item.id === 1, publicado_em:item.date ? `${item.date}T12:00:00-03:00` : new Date().toISOString(), seo_titulo:item.title, seo_descricao:resumo.slice(0,160) };
    });
    const guia = guiaAntigo.map(item => ({ nome:item.nome, slug:gerarSlug(item.nome), categoria_nome:item.categoria || "outros", descricao:item.descricao || "", imagem_url:item.imagem || null, whatsapp:item.whatsapp || null, instagram:item.instagram || null, endereco:item.endereco || null, recomendado:Boolean(item.destaque), status:"publicado", seo_titulo:item.nome, seo_descricao:textoPuro(item.descricao || "").slice(0,160) }));
    const turismo = guiaAntigo.filter(item => item.categoria === "turismo").map(item => ({ nome:item.nome, slug:gerarSlug(item.nome), descricao:item.descricao || "", conteudo_html:item.descricao ? `<p>${item.descricao}</p>` : "", imagem_url:item.imagem || null, endereco:item.endereco || null, whatsapp:item.whatsapp || null, status:"publicado", destaque:Boolean(item.destaque), seo_titulo:`${item.nome} | Turismo em UrÃ¢nia`, seo_descricao:textoPuro(item.descricao || "").slice(0,160) }));
    const categorias = [{nome:"NotÃ­cias",slug:"noticias",tipo:"noticias",ordem:0,status:"ativo"}, ...[...new Set(guiaAntigo.map(item => item.categoria).filter(Boolean))].map((nome, ordem) => ({nome, slug:gerarSlug(nome), tipo:"guia", ordem, status:"ativo"})), {nome:"Pontos turÃ­sticos",slug:"pontos-turisticos",tipo:"turismo",ordem:0,status:"ativo"}];
    for (const [tabela, dados] of [["noticias",noticias],["guia_comercial",guia],["turismo",turismo],["categorias",categorias]]) {
      const { error } = await supabase.from(tabela).upsert(dados, { onConflict:"slug" });
      if (error) throw new Error(`${tabela}: ${error.message}`);
    }
    const { data:linksAtuais, error:linksError } = await supabase.from("links").select("url");
    if (linksError) throw linksError;
    const urlsAtuais = new Set((linksAtuais || []).map(item => item.url));
    const linksNovos = linksIniciais.filter(item => !urlsAtuais.has(item.url));
    if (linksNovos.length) {
      const { error } = await supabase.from("links").insert(linksNovos);
      if (error) throw error;
    }
    if (!mounted || localRun !== runId) return;
    statusEl.innerHTML = `<strong>MigraÃ§Ã£o concluÃ­da.</strong><br>${noticias.length} notÃ­cias, ${guia.length} itens do guia, ${turismo.length} ponto turÃ­stico e ${linksIniciais.length} links conferidos.`;
    migrationButton.textContent = "Executar novamente";
  } catch (error) {
    console.error(error);
    if (mounted && localRun === runId) statusEl.textContent = `Falha na migraÃ§Ã£o: ${error.message}`;
  } finally {
    if (mounted && localRun === runId) migrationButton.disabled = false;
  }
}

const onlyUrl = value => {
  const text = String(value || "").trim();
  if (!text) return null;
  try { const url = new URL(text); return ["http:","https:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};
const siteReference = value => {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^javascript:/i.test(text)) return null;
  if (/^(?:https?:\/\/|\/(?!\/)|\.{1,2}\/)/i.test(text)) return text;
  return /^[\w.-]/u.test(text) && !text.includes("<") && !text.includes(">") && !text.includes('"') ? text : null;
};
const optional = value => { const text = String(value ?? "").trim(); return text || null; };

function normalizeItem(item, index) {
  const errors = [], nome = String(item?.nome || "").trim();
  const categoria = String(item?.categoria_nome || item?.categoria || "").trim();
  if (!nome) errors.push(`Item ${index + 1}: informe o nome.`);
  if (!categoria) errors.push(`Item ${index + 1}: informe a categoria.`);
  const slug = gerarSlug(String(item?.slug || nome));
  if (!slug) errors.push(`Item ${index + 1}: nÃ£o foi possÃ­vel gerar o slug.`);
  const statusItem = String(item?.status || "publicado").toLowerCase();
  if (!allowedStatus.has(statusItem)) errors.push(`Item ${index + 1}: status invÃ¡lido.`);
  const urlFields = ["instagram","facebook","site","mapa_url"];
  for (const field of urlFields) if (item?.[field] && !onlyUrl(item[field])) errors.push(`Item ${index + 1}: ${field} precisa ser uma URL vÃ¡lida.`);
  if ((item?.imagem_url || item?.imagem) && !siteReference(item?.imagem_url || item?.imagem)) errors.push(`Item ${index + 1}: imagem_url precisa ser um link ou caminho interno vÃ¡lido.`);
  const galeria = Array.isArray(item?.galeria_urls) ? item.galeria_urls.filter(Boolean) : [];
  if (galeria.some(url => !siteReference(url))) errors.push(`Item ${index + 1}: galeria_urls contÃ©m link ou caminho invÃ¡lido.`);
  return { errors, data:{ nome, slug, categoria_nome:categoria, descricao:optional(item?.descricao), imagem_url:siteReference(item?.imagem_url || item?.imagem), galeria_urls:galeria.map(siteReference), whatsapp:optional(item?.whatsapp), telefone:optional(item?.telefone), instagram:onlyUrl(item?.instagram), facebook:onlyUrl(item?.facebook), site:onlyUrl(item?.site), endereco:optional(item?.endereco), horario:optional(item?.horario), mapa_url:onlyUrl(item?.mapa_url), recomendado:Boolean(item?.recomendado ?? item?.destaque), status:statusItem, seo_titulo:optional(item?.seo_titulo) || nome, seo_descricao:(optional(item?.seo_descricao) || optional(item?.descricao) || "").slice(0,160) || null } };
}

function renderGuidePreview(errors = []) {
  const preview = $("#guide-json-preview"), run = $("#import-guide-json");
  if (!preview || !run) return;
  if (errors.length) {
    preview.innerHTML = `<div class="guide-import-note error"><strong>Corrija o arquivo:</strong><br>${errors.map(esc).join("<br>")}</div>`;
    run.disabled = true;
    return;
  }
  const categories = new Set(importState.itens.map(item => item.categoria_nome));
  preview.innerHTML = `<div class="guide-import-stats"><span>${importState.itens.length} empresa(s)</span><span>${categories.size} categoria(s)</span><span>Duplicados serÃ£o atualizados pelo slug</span></div><div class="table-wrap guide-preview"><table><thead><tr><th>Empresa</th><th>Categoria</th><th>Status</th><th>Contato</th></tr></thead><tbody>${importState.itens.map(item => `<tr><td><strong>${esc(item.nome)}</strong><small>${esc(item.slug)}</small></td><td>${esc(item.categoria_nome)}</td><td><span class="status-pill ${esc(item.status)}">${esc(item.status)}</span></td><td>${esc(item.whatsapp || item.telefone || "â€”")}</td></tr>`).join("")}</tbody></table></div>`;
  run.disabled = !importState.itens.length;
  run.textContent = `Importar ${importState.itens.length} empresa(s)`;
}

async function readGuideFile(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) throw new Error("O arquivo JSON deve ter no mÃ¡ximo 2 MB.");
  const parsed = JSON.parse(await file.text());
  const rows = Array.isArray(parsed) ? parsed : parsed?.itens;
  if (!Array.isArray(rows)) throw new Error('Use uma lista JSON ou um objeto contendo o campo "itens".');
  if (!rows.length) throw new Error("O arquivo nÃ£o possui empresas para importar.");
  if (rows.length > 1000) throw new Error("Importe no mÃ¡ximo 1.000 empresas por arquivo.");
  const normalized = rows.map(normalizeItem), errors = normalized.flatMap(item => item.errors);
  const slugs = normalized.map(item => item.data.slug).filter(Boolean);
  const duplicates = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
  if (duplicates.length) errors.push(`Slugs repetidos no arquivo: ${[...new Set(duplicates)].join(", ")}.`);
  importState.arquivo = file;
  importState.itens = normalized.map(item => item.data);
  renderGuidePreview(errors);
}

async function ensureGuideCategories(items) {
  const db = getDb();
  const { data:all, error } = await db.from("categorias").select("id,nome,slug,tipo,ordem");
  if (error) throw error;
  const guide = (all || []).filter(item => item.tipo === "guia"), byName = new Map(guide.map(item => [item.nome.trim().toLowerCase(), item]));
  const usedSlugs = new Set((all || []).map(item => item.slug)), missing = [...new Set(items.map(item => item.categoria_nome))].filter(name => !byName.has(name.trim().toLowerCase()));
  let order = Math.max(0, ...guide.map(item => Number(item.ordem) || 0));
  const rows = missing.map(nome => {
    let slug = gerarSlug(nome), candidate = slug, count = 2;
    if (usedSlugs.has(candidate)) { candidate = `guia-${slug}`; while (usedSlugs.has(candidate)) candidate = `guia-${slug}-${count++}`; }
    usedSlugs.add(candidate); order += 10;
    return { nome, slug:candidate, tipo:"guia", ordem:order, status:"ativo" };
  });
  if (rows.length) {
    const { error:insertError } = await db.from("categorias").insert(rows);
    if (insertError) throw insertError;
  }
  const { data:updated, error:updatedError } = await db.from("categorias").select("id,nome").eq("tipo", "guia");
  if (updatedError) throw updatedError;
  return new Map((updated || []).map(item => [item.nome.trim().toLowerCase(), item]));
}

async function importGuideJson() {
  const run = $("#import-guide-json"), message = $("#guide-json-message");
  if (!importState.itens.length || !run || !message) return;
  if (!confirm(`Importar ${importState.itens.length} empresa(s) para o Guia Comercial?`)) return;
  run.disabled = true;
  run.textContent = "Preparando categoriasâ€¦";
  message.className = "guide-import-note";
  message.textContent = "Validando categorias e empresasâ€¦";
  try {
    const categories = await ensureGuideCategories(importState.itens), payload = importState.itens.map(item => ({ ...item, categoria_id:categories.get(item.categoria_nome.trim().toLowerCase())?.id || null }));
    for (let index = 0; index < payload.length; index += 100) {
      run.textContent = `Importando ${Math.min(index + 100, payload.length)} de ${payload.length}â€¦`;
      const { error } = await getDb().from("guia_comercial").upsert(payload.slice(index, index + 100), { onConflict:"slug" });
      if (error) throw error;
    }
    message.className = "guide-import-note";
    message.innerHTML = `<strong>ImportaÃ§Ã£o concluÃ­da.</strong> ${payload.length} empresa(s) foram criadas ou atualizadas.`;
    run.textContent = "ImportaÃ§Ã£o concluÃ­da";
  } catch (error) {
    message.className = "guide-import-note error";
    message.textContent = `Falha na importaÃ§Ã£o: ${error.message}`;
    run.disabled = false;
    run.textContent = `Importar ${importState.itens.length} empresa(s)`;
  }
}

function setupGuideJsonImport() {
  ensureImportStyles();
  const oldPanel = $(".panel"), section = document.createElement("section");
  section.className = "panel guide-import-panel";
  section.innerHTML = `<div class="panel-header"><div><h2>Importar Guia Comercial por arquivo</h2><p>Cadastre ou atualize vÃ¡rias empresas de uma vez, com validaÃ§Ã£o e prÃ©via.</p></div></div><div class="guide-import-grid"><div class="guide-file-box"><strong>1. Preencha o modelo JSON</strong><p>Nome e categoria sÃ£o obrigatÃ³rios. Os outros campos podem ficar vazios.</p><input id="guide-json-file" type="file" accept=".json,application/json"></div><div class="guide-import-actions"><a class="admin-button secondary" href="../modelos/guia-comercial-modelo.json" download>Baixar modelo JSON</a><button id="import-guide-json" class="admin-button" type="button" disabled>Importar empresas</button></div></div><div id="guide-json-preview"></div><p id="guide-json-message" class="guide-import-note">Selecione o arquivo preenchido para conferir os dados antes de importar.</p>`;
  oldPanel?.before(section);
  addCleanup(() => section.remove());
  addListener($("#guide-json-file"), "change", async event => {
    const message = $("#guide-json-message");
    try {
      message.className = "guide-import-note";
      message.textContent = "Lendo e validando arquivoâ€¦";
      await readGuideFile(event.target.files?.[0]);
      message.textContent = `Arquivo ${event.target.files?.[0]?.name || ""} validado.`;
    } catch (error) {
      importState.itens = [];
      renderGuidePreview([error.message]);
      message.className = "guide-import-note error";
      message.textContent = error.message;
    }
  });
  addListener($("#import-guide-json"), "click", importGuideJson);
}

async function initModule(context = {}) {
  moduleContext = context;
  acesso = context.access || await exigirAdministrador();
  if (!acesso?.configurado) return;
  mounted = true;
  runId += 1;
  moduleContext.setTitle?.("Migrar conteÃºdo antigo", "ImportaÃ§Ã£o segura de arquivos legados e lotes do Guia Comercial.");
  document.title = "Migrar conteÃºdo | Eu Amo UrÃ¢nia";
  const adminName = document.getElementById("admin-name") || document.getElementById("admin-user");
  if (adminName) adminName.textContent = acesso.admin?.nome || acesso.user?.email || "";
  statusEl = $("#migration-status");
  migrationButton = $("#run-migration");
  addListener(migrationButton, "click", migrar);
  if (statusEl) statusEl.textContent = "Pronto para importar os arquivos antigos. A operaÃ§Ã£o Ã© segura para repetir.";
  setupGuideJsonImport();
}

export async function mount(container, context = {}) {
  unmount();
  shellContainer = container;
  root = container;
  renderShell(container);
  await initModule(context);
}

export function unmount() {
  mounted = false;
  cleanupHandlers.splice(0).forEach(handler => {
    try { handler(); } catch (error) { console.warn("Falha ao desmontar ImportaÃ§Ã£o:", error); }
  });
  importState = { itens: [], arquivo: null };
  statusEl = null;
  migrationButton = null;
  acesso = null;
  moduleContext = {};
  if (shellContainer) {
    shellContainer.classList.remove("importacao-module");
    shellContainer.innerHTML = "";
  }
  shellContainer = null;
  root = document;
}

async function bootLegacyPage() {
  if (document.body?.dataset.adminShell === "true") return;
  const legacyStatus = document.getElementById("migration-status");
  const legacyButton = document.getElementById("run-migration");
  if (!legacyStatus || !legacyButton) return;
  root = document;
  document.querySelector("main")?.classList.add("importacao-module");
  statusEl = legacyStatus;
  migrationButton = legacyButton;
  await initModule({});
}

bootLegacyPage();
