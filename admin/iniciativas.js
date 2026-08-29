import {
  listarFormasAjuda,
  listarIniciativasAdmin,
  salvarFormaAjuda,
  salvarIniciativa,
  excluirFormaAjuda
} from "../assets/js/services/iniciativasService.js";
import { gerarSlug } from "../assets/js/utils.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[char]));

let app = null;
let moduleStyle = null;
let cleanupHandlers = [];

const state = {
  items: [],
  selected: null,
  help: [],
  message: ""
};

const blank = () => ({
  tipo: "projeto",
  titulo: "",
  slug: "",
  resumo: "",
  descricao: "",
  imagem_capa_url: "",
  status: "rascunho",
  destaque: false,
  exibir_na_listagem: true,
  responsavel_nome: "",
  telefone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  site_url: "",
  inicio_em: "",
  termina_em: "",
  iniciativa_pai_id: ""
});

function addCleanup(handler) {
  cleanupHandlers.push(handler);
}

function ensureModuleStyle() {
  if (document.querySelector('link[data-admin-module-style="iniciativas"]')) return;
  moduleStyle = document.createElement("link");
  moduleStyle.rel = "stylesheet";
  moduleStyle.href = "/admin/iniciativas.css";
  moduleStyle.dataset.adminModuleStyle = "iniciativas";
  document.head.append(moduleStyle);
  addCleanup(() => {
    moduleStyle?.remove();
    moduleStyle = null;
  });
}

function value(formData, name) {
  return String(formData.get(name) || "").trim() || null;
}

function formatType(type) {
  return type === "projeto" ? "Projeto permanente" : "Ação da comunidade";
}

function formatStatus(status) {
  return ({
    rascunho: "Rascunho",
    publicado: "Publicado",
    encerrado: "Encerrado",
    arquivado: "Arquivado"
  })[status] || status || "Sem status";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeDateTime(value) {
  if (!value) return "";
  return String(value).slice(0, 16);
}

async function load() {
  state.items = await listarIniciativasAdmin();
  if (state.selected?.id) {
    state.selected = state.items.find(item => item.id === state.selected.id) || null;
    state.help = state.selected ? await listarFormasAjuda(state.selected.id) : [];
  }
  render();
}

function metrics() {
  const published = state.items.filter(item => item.status === "publicado").length;
  const featured = state.items.filter(item => item.destaque).length;
  const actions = state.items.filter(item => item.tipo === "acao").length;
  return `
    <div class="initiatives-metrics" aria-label="Resumo das iniciativas">
      <article><strong>${state.items.length}</strong><span>cadastradas</span></article>
      <article><strong>${published}</strong><span>publicadas</span></article>
      <article><strong>${featured}</strong><span>em destaque</span></article>
      <article><strong>${actions}</strong><span>ações</span></article>
    </div>
  `;
}

function listItems() {
  const rows = state.items.map(item => {
    const active = state.selected?.id === item.id ? " active" : "";
    const image = item.imagem_capa_url
      ? `<img src="${esc(item.imagem_capa_url)}" alt="">`
      : `<span class="initiative-list-placeholder">${item.tipo === "projeto" ? "P" : "A"}</span>`;
    return `
      <button class="initiative-list-item${active}" type="button" data-select="${item.id}">
        ${image}
        <span>
          <strong>${esc(item.titulo || "Sem título")}</strong>
          <small>${esc(formatType(item.tipo))} · ${esc(formatStatus(item.status))}</small>
        </span>
        ${item.destaque ? '<em>Destaque</em>' : ""}
      </button>
    `;
  }).join("");

  return `
    <aside class="initiatives-sidebar-card">
      <div class="initiatives-card-head">
        <div>
          <p class="eyebrow">Acervo</p>
          <h3>Iniciativas</h3>
        </div>
        <span>${state.items.length}</span>
      </div>
      <div class="initiatives-list">
        ${rows || '<p class="initiatives-empty">Nenhuma iniciativa cadastrada.</p>'}
      </div>
    </aside>
  `;
}

function statusOptions(current) {
  return ["rascunho", "publicado", "encerrado", "arquivado"]
    .map(status => `<option value="${status}" ${current === status ? "selected" : ""}>${formatStatus(status)}</option>`)
    .join("");
}

function typeOptions(current) {
  return `
    <option value="projeto" ${current === "projeto" ? "selected" : ""}>Projeto permanente</option>
    <option value="acao" ${current === "acao" ? "selected" : ""}>Ação da comunidade</option>
  `;
}

function parentOptions(item) {
  const projects = state.items.filter(entry => entry.tipo === "projeto" && entry.id !== item.id);
  return `
    <option value="">Ação independente</option>
    ${projects.map(entry => `<option value="${entry.id}" ${entry.id === item.iniciativa_pai_id ? "selected" : ""}>${esc(entry.titulo)}</option>`).join("")}
  `;
}

function form(item) {
  return `
    <form id="initiative-form" class="initiatives-form">
      <section class="initiative-editor-section">
        <div class="initiatives-section-title">
          <span>01</span>
          <div>
            <h3>Conteúdo público</h3>
            <p>Informações que aparecem no site e no aplicativo.</p>
          </div>
        </div>
        <div class="initiatives-form-grid">
          <label>Tipo<select name="tipo">${typeOptions(item.tipo)}</select></label>
          <label>Projeto pai<select name="iniciativa_pai_id">${parentOptions(item)}</select></label>
          <label>Título<input required name="titulo" value="${esc(item.titulo)}"></label>
          <label>Slug<input required name="slug" value="${esc(item.slug)}"></label>
          <label class="wide">Imagem de capa<input name="imagem_capa_url" value="${esc(item.imagem_capa_url)}" placeholder="URL ou caminho da imagem"></label>
          <label class="wide">Resumo<textarea name="resumo" rows="3">${esc(item.resumo)}</textarea></label>
          <label class="wide">Sobre<textarea name="descricao" rows="7">${esc(item.descricao)}</textarea></label>
        </div>
      </section>

      <section class="initiative-editor-section">
        <div class="initiatives-section-title">
          <span>02</span>
          <div>
            <h3>Contato e responsável</h3>
            <p>Dados para orientar quem quiser participar ou ajudar.</p>
          </div>
        </div>
        <div class="initiatives-form-grid">
          <label>Responsável<input name="responsavel_nome" value="${esc(item.responsavel_nome)}"></label>
          <label>WhatsApp<input name="whatsapp" value="${esc(item.whatsapp)}"></label>
          <label>Telefone<input name="telefone" value="${esc(item.telefone)}"></label>
          <label>E-mail<input type="email" name="email" value="${esc(item.email)}"></label>
          <label>Instagram<input name="instagram" value="${esc(item.instagram)}"></label>
          <label>Site<input type="url" name="site_url" value="${esc(item.site_url)}"></label>
        </div>
      </section>

      <section class="initiative-editor-section compact">
        <div class="initiatives-section-title">
          <span>03</span>
          <div>
            <h3>Publicação</h3>
            <p>Status, datas e visibilidade da iniciativa.</p>
          </div>
        </div>
        <div class="initiatives-form-grid">
          <label>Status<select name="status">${statusOptions(item.status)}</select></label>
          <label>Início<input type="datetime-local" name="inicio_em" value="${esc(normalizeDateTime(item.inicio_em))}"></label>
          <label>Encerramento<input type="datetime-local" name="termina_em" value="${esc(normalizeDateTime(item.termina_em))}"></label>
          <div class="initiatives-checks">
            <label><input type="checkbox" name="destaque" ${item.destaque ? "checked" : ""}> Destacar</label>
            <label><input type="checkbox" name="exibir_na_listagem" ${item.exibir_na_listagem ? "checked" : ""}> Exibir na listagem</label>
          </div>
        </div>
      </section>

      <div class="initiatives-actions">
        <button class="admin-button" type="submit">Salvar iniciativa</button>
      </div>
    </form>
  `;
}

function helpTypeOptions() {
  return ["pix", "whatsapp", "telefone", "site", "voluntariado", "materiais", "outro"]
    .map(type => `<option value="${type}">${type}</option>`)
    .join("");
}

function helps() {
  if (!state.selected?.id) {
    return `
      <section class="initiative-help-card muted">
        <h3>Formas de ajuda</h3>
        <p>Salve a iniciativa primeiro para adicionar Pix, WhatsApp, links, materiais ou formas de voluntariado.</p>
      </section>
    `;
  }

  const rows = state.help.map(item => `
    <article class="initiative-help-item">
      <div>
        <strong>${esc(item.titulo)}</strong>
        <span>${esc(item.tipo)}${item.recebedor_nome ? ` · ${esc(item.recebedor_nome)}` : ""}</span>
      </div>
      <button data-delete-help="${item.id}" class="admin-button secondary" type="button">Remover</button>
    </article>
  `).join("");

  return `
    <section class="initiative-help-card">
      <div class="initiatives-card-head">
        <div>
          <p class="eyebrow">Participação</p>
          <h3>Formas de ajuda</h3>
        </div>
        <span>${state.help.length}</span>
      </div>
      <p class="initiative-help-note">Essas opções aparecem para o público ajudar de forma orientada. Remover uma opção oculta imediatamente após salvar no banco.</p>
      <div class="initiative-help-list">
        ${rows || '<p class="initiatives-empty">Nenhuma forma cadastrada.</p>'}
      </div>
      <form id="help-form" class="initiatives-help-form">
        <div class="initiatives-form-grid">
          <label>Tipo<select name="tipo">${helpTypeOptions()}</select></label>
          <label>Título<input required name="titulo"></label>
          <label>Valor / chave / link<input name="valor_publico"></label>
          <label>Recebedor<input name="recebedor_nome" placeholder="Obrigatório para Pix"></label>
          <label>Ordem<input type="number" name="ordem" value="100"></label>
          <label class="wide">Descrição<textarea name="descricao" rows="3"></textarea></label>
        </div>
        <button class="admin-button secondary" type="submit">Adicionar forma de ajuda</button>
      </form>
    </section>
  `;
}

function selectedSummary(item) {
  const label = item.id ? "Editando iniciativa" : "Nova iniciativa";
  const title = item.titulo || "Configure uma nova iniciativa";
  const period = [formatDate(item.inicio_em), formatDate(item.termina_em)].filter(Boolean).join(" até ");
  return `
    <section class="initiatives-editor-head">
      <div>
        <p class="eyebrow">${label}</p>
        <h3>${esc(title)}</h3>
        <p>${esc(item.resumo || "Use os campos abaixo para cadastrar uma iniciativa clara, confiável e fácil de apoiar.")}</p>
      </div>
      <div class="initiatives-editor-badges">
        <span>${esc(formatType(item.tipo))}</span>
        <span>${esc(formatStatus(item.status))}</span>
        ${period ? `<span>${esc(period)}</span>` : ""}
      </div>
    </section>
  `;
}

function render() {
  const root = app || document.querySelector("#app-content");
  if (!root) return;
  app = root;
  const item = state.selected || blank();
  root.innerHTML = `
    <section class="admin-page initiatives-admin-page">
      <header class="admin-page-header initiatives-page-header">
        <div>
          <p class="eyebrow">Comunidade</p>
          <h2>Iniciativas da Comunidade</h2>
          <p>Cadastre projetos permanentes, ações independentes e formas de ajuda revisadas.</p>
        </div>
        <button id="new-initiative" class="admin-button" type="button">Nova iniciativa</button>
      </header>
      ${metrics()}
      ${state.message ? `<p class="form-message">${esc(state.message)}</p>` : ""}
      <div class="initiatives-layout">
        ${listItems()}
        <main class="initiatives-editor-card">
          ${selectedSummary(item)}
          ${form(item)}
          ${helps()}
        </main>
      </div>
    </section>
  `;
  bind(root);
}

function bind(root) {
  root.querySelector("#new-initiative")?.addEventListener("click", () => {
    state.selected = null;
    state.help = [];
    state.message = "";
    render();
  });

  root.querySelectorAll("[data-select]").forEach(button => button.addEventListener("click", async () => {
    state.selected = state.items.find(item => item.id === button.dataset.select) || null;
    state.help = state.selected ? await listarFormasAjuda(state.selected.id) : [];
    state.message = "";
    render();
  }));

  root.querySelector("#initiative-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const titulo = value(formData, "titulo");
    const existing = state.selected ? { ...state.selected } : {};
    await salvarIniciativa({
      ...existing,
      id: state.selected?.id,
      tipo: value(formData, "tipo"),
      iniciativa_pai_id: value(formData, "iniciativa_pai_id"),
      titulo,
      slug: value(formData, "slug") || gerarSlug(titulo),
      resumo: value(formData, "resumo"),
      descricao: value(formData, "descricao"),
      imagem_capa_url: value(formData, "imagem_capa_url"),
      status: value(formData, "status"),
      responsavel_nome: value(formData, "responsavel_nome"),
      telefone: value(formData, "telefone"),
      whatsapp: value(formData, "whatsapp"),
      email: value(formData, "email"),
      instagram: value(formData, "instagram"),
      site_url: value(formData, "site_url"),
      inicio_em: value(formData, "inicio_em"),
      termina_em: value(formData, "termina_em"),
      destaque: formData.get("destaque") === "on",
      exibir_na_listagem: formData.get("exibir_na_listagem") === "on"
    });
    state.message = "Iniciativa salva.";
    await load();
  });

  root.querySelector("#help-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await salvarFormaAjuda({
      iniciativa_id: state.selected.id,
      tipo: value(formData, "tipo"),
      titulo: value(formData, "titulo"),
      descricao: value(formData, "descricao"),
      valor_publico: value(formData, "valor_publico"),
      recebedor_nome: value(formData, "recebedor_nome"),
      ordem: Number(formData.get("ordem") || 100),
      ativo: true
    });
    state.message = "Forma de ajuda salva.";
    await load();
  });

  root.querySelectorAll("[data-delete-help]").forEach(button => button.addEventListener("click", async () => {
    await excluirFormaAjuda(button.dataset.deleteHelp);
    state.message = "Forma de ajuda removida.";
    await load();
  }));
}

export async function mount(container) {
  app = container || document.querySelector("#app-content");
  ensureModuleStyle();
  await load();
}

export function unmount() {
  cleanupHandlers.forEach(handler => handler());
  cleanupHandlers = [];
  app = null;
}
