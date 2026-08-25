import { temPermissao } from "./auth.js";
import { gerarSlug } from "../assets/js/utils.js";

let app = null;
let db = null;
let context = {};
let moduleStyle = null;
let cleanupHandlers = [];

const state = {
  categories: [],
  contacts: [],
  reports: [],
  search: "",
  category: "all",
  status: "all",
  form: null,
  categoryForm: null,
  message: "",
  loading: true
};

const statusLabels = {
  source_verified: "Fonte oficial",
  manually_verified: "Revisado",
  needs_review: "Precisa revisar"
};

function addCleanup(handler) {
  cleanupHandlers.push(handler);
}

function ensureModuleStyle() {
  if (document.querySelector('link[data-admin-module-style="telefones-uteis"]')) return;
  moduleStyle = document.createElement("link");
  moduleStyle.rel = "stylesheet";
  moduleStyle.href = "/admin/telefones-uteis.css";
  moduleStyle.dataset.adminModuleStyle = "telefones-uteis";
  document.head.append(moduleStyle);
  addCleanup(() => {
    moduleStyle?.remove();
    moduleStyle = null;
  });
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function nullIfBlank(value) {
  const clean = String(value ?? "").trim();
  return clean || null;
}

function toNumber(value, fallback = 100) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function categoryName(id) {
  return state.categories.find(item => item.id === id)?.name || "Sem categoria";
}

function filteredContacts() {
  const query = normalize(state.search);
  return state.contacts
    .filter(contact => {
      if (state.category !== "all" && contact.category_id !== state.category) return false;
      if (state.status !== "all") {
        if (state.status === "active" && !contact.is_active) return false;
        if (state.status === "inactive" && contact.is_active) return false;
        if (state.status === "needs_review" && contact.verification_status !== "needs_review") return false;
      }
      if (!query) return true;
      return normalize(`${contact.name} ${contact.phone} ${contact.description ?? ""} ${categoryName(contact.category_id)}`).includes(query);
    })
    .sort((a, b) => Number(b.is_emergency) - Number(a.is_emergency) || Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR"));
}

function renderCategoryOptions(selectedId = "") {
  return state.categories
    .map(category => `<option value="${escapeHtml(category.id)}" ${category.id === selectedId ? "selected" : ""}>${escapeHtml(category.name)}</option>`)
    .join("");
}

function renderStatusOptions(selected = "needs_review") {
  return Object.entries(statusLabels)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function renderMetrics() {
  const active = state.contacts.filter(item => item.is_active).length;
  const emergency = state.contacts.filter(item => item.is_emergency && item.is_active).length;
  const pending = state.contacts.filter(item => item.verification_status === "needs_review").length;
  const reports = state.reports.filter(item => item.status === "pending").length;
  return `
    <div class="useful-metrics">
      <article><span>Publicados</span><strong>${active}</strong></article>
      <article><span>Urgência</span><strong>${emergency}</strong></article>
      <article><span>Para revisar</span><strong>${pending}</strong></article>
      <article><span>Relatos pendentes</span><strong>${reports}</strong></article>
    </div>`;
}

function renderContactRow(contact) {
  const status = statusLabels[contact.verification_status] || contact.verification_status;
  return `
    <article class="useful-row ${contact.is_active ? "" : "is-muted"}">
      <div class="useful-row-main">
        <span class="useful-icon">${contact.is_emergency ? "!" : "☎"}</span>
        <div>
          <strong>${escapeHtml(contact.name)}</strong>
          <p>${escapeHtml(categoryName(contact.category_id))} · ${escapeHtml(contact.phone)}</p>
          <div class="useful-badges">
            ${contact.is_emergency ? '<span class="badge danger">Urgência</span>' : ""}
            ${contact.is_featured ? '<span class="badge">Destaque</span>' : ""}
            <span class="badge ${contact.verification_status === "needs_review" ? "warning" : "success"}">${escapeHtml(status)}</span>
            ${contact.is_active ? "" : '<span class="badge muted">Inativo</span>'}
          </div>
        </div>
      </div>
      <div class="useful-actions">
        <button class="admin-button secondary" type="button" data-edit-contact="${escapeHtml(contact.id)}">Editar</button>
        <button class="admin-button secondary" type="button" data-verify-contact="${escapeHtml(contact.id)}">Revisado</button>
        <button class="admin-button secondary" type="button" data-toggle-contact="${escapeHtml(contact.id)}">${contact.is_active ? "Ocultar" : "Publicar"}</button>
      </div>
    </article>`;
}

function renderContactForm() {
  if (!state.form) return "";
  const contact = state.form === "new" ? {} : state.contacts.find(item => item.id === state.form) || {};
  return `
    <section class="useful-form-panel">
      <header>
        <div><p class="eyebrow">${contact.id ? "Editar" : "Novo"}</p><h3>${contact.id ? escapeHtml(contact.name) : "Telefone útil"}</h3></div>
        <button class="admin-button secondary" type="button" data-close-form>Fechar</button>
      </header>
      <form data-contact-form>
        <input type="hidden" name="id" value="${escapeHtml(contact.id || "")}">
        <label>Nome<input name="name" required value="${escapeHtml(contact.name || "")}"></label>
        <label>Slug<input name="slug" placeholder="gerado automaticamente" value="${escapeHtml(contact.slug || "")}"></label>
        <label>Categoria<select name="category_id"><option value="">Sem categoria</option>${renderCategoryOptions(contact.category_id || "")}</select></label>
        <label>Telefone principal<input name="phone" required value="${escapeHtml(contact.phone || "")}"></label>
        <label>Telefone secundário<input name="secondary_phone" value="${escapeHtml(contact.secondary_phone || "")}"></label>
        <label>WhatsApp<input name="whatsapp" value="${escapeHtml(contact.whatsapp || "")}"></label>
        <label>Descrição<textarea name="description" rows="3">${escapeHtml(contact.description || "")}</textarea></label>
        <label>Endereço<textarea name="address" rows="2">${escapeHtml(contact.address || "")}</textarea></label>
        <label>Horário<textarea name="opening_hours" rows="2">${escapeHtml(contact.opening_hours || "")}</textarea></label>
        <label>Busca no mapa<input name="maps_query" value="${escapeHtml(contact.maps_query || "")}"></label>
        <label>Palavras-chave<input name="keywords" value="${escapeHtml((contact.keywords || []).join(", "))}"></label>
        <div class="useful-grid-3">
          <label>Ordem<input name="sort_order" type="number" value="${escapeHtml(contact.sort_order ?? 100)}"></label>
          <label>Status<select name="verification_status">${renderStatusOptions(contact.verification_status || "needs_review")}</select></label>
          <label>Revisado em<input name="reviewed_at" type="date" value="${escapeHtml(contact.reviewed_at || "")}"></label>
        </div>
        <label>Fonte<input name="source_name" value="${escapeHtml(contact.source_name || "")}"></label>
        <label>URL da fonte<input name="source_url" value="${escapeHtml(contact.source_url || "")}"></label>
        <div class="useful-checks">
          <label><input type="checkbox" name="is_emergency" ${contact.is_emergency ? "checked" : ""}> Urgência</label>
          <label><input type="checkbox" name="is_featured" ${contact.is_featured ? "checked" : ""}> Destaque</label>
          <label><input type="checkbox" name="is_active" ${contact.id ? contact.is_active ? "checked" : "" : "checked"}> Publicado</label>
        </div>
        <button class="admin-button" type="submit">Salvar telefone</button>
      </form>
    </section>`;
}

function renderCategoryForm() {
  if (!state.categoryForm) return "";
  const category = state.categoryForm === "new" ? {} : state.categories.find(item => item.id === state.categoryForm) || {};
  return `
    <form class="useful-category-form" data-category-form>
      <input type="hidden" name="id" value="${escapeHtml(category.id || "")}">
      <label>Categoria<input name="name" required value="${escapeHtml(category.name || "")}"></label>
      <label>Slug<input name="slug" value="${escapeHtml(category.slug || "")}"></label>
      <label>Ícone Ionicons<input name="icon" placeholder="call-outline" value="${escapeHtml(category.icon || "")}"></label>
      <label>Ordem<input name="sort_order" type="number" value="${escapeHtml(category.sort_order ?? 100)}"></label>
      <label class="useful-inline"><input type="checkbox" name="is_active" ${category.id ? category.is_active ? "checked" : "" : "checked"}> Ativa</label>
      <button class="admin-button" type="submit">Salvar categoria</button>
      <button class="admin-button secondary" type="button" data-close-category-form>Cancelar</button>
    </form>`;
}

function renderReports() {
  const reports = state.reports.filter(item => item.status === "pending").slice(0, 8);
  if (!reports.length) return '<p class="useful-empty-small">Nenhum relato pendente.</p>';
  return reports.map(report => `
    <article class="useful-report">
      <div>
        <strong>${escapeHtml(state.contacts.find(item => item.id === report.contact_id)?.name || "Contato")}</strong>
        <p>${escapeHtml(report.message)}</p>
      </div>
      <button class="admin-button secondary" type="button" data-review-report="${escapeHtml(report.id)}">Marcar revisado</button>
    </article>`).join("");
}

function render() {
  if (!app) return;
  const contacts = filteredContacts();
  app.classList.remove("loading");
  app.innerHTML = `
    <section class="useful-admin">
      <header class="useful-hero">
        <div>
          <p class="eyebrow">Viva Urânia</p>
          <h2>Telefones úteis</h2>
          <p>Organize contatos importantes, urgências e serviços que aparecem no aplicativo.</p>
        </div>
        <button class="admin-button" type="button" data-new-contact>Novo telefone</button>
      </header>
      ${state.message ? `<p class="form-message">${escapeHtml(state.message)}</p>` : ""}
      ${renderMetrics()}
      <section class="useful-layout">
        <div class="useful-main">
          <div class="useful-toolbar">
            <input data-search placeholder="Buscar por nome, telefone ou categoria" value="${escapeHtml(state.search)}">
            <select data-filter-category><option value="all">Todas as categorias</option>${renderCategoryOptions(state.category)}</select>
            <select data-filter-status>
              <option value="all" ${state.status === "all" ? "selected" : ""}>Todos</option>
              <option value="active" ${state.status === "active" ? "selected" : ""}>Publicados</option>
              <option value="inactive" ${state.status === "inactive" ? "selected" : ""}>Ocultos</option>
              <option value="needs_review" ${state.status === "needs_review" ? "selected" : ""}>Precisam revisar</option>
            </select>
          </div>
          <div class="useful-list">${contacts.length ? contacts.map(renderContactRow).join("") : '<div class="useful-empty">Nenhum telefone encontrado.</div>'}</div>
        </div>
        <aside class="useful-side">
          ${renderContactForm()}
          <section class="useful-panel">
            <header><h3>Categorias</h3><button class="admin-button secondary" type="button" data-new-category>Nova</button></header>
            ${renderCategoryForm()}
            <div class="useful-category-list">
              ${state.categories.map(category => `<button type="button" data-edit-category="${escapeHtml(category.id)}"><span>${escapeHtml(category.name)}</span><small>${category.is_active ? "Ativa" : "Oculta"}</small></button>`).join("")}
            </div>
          </section>
          <section class="useful-panel">
            <header><h3>Relatos do app</h3></header>
            ${renderReports()}
          </section>
        </aside>
      </section>
    </section>`;
}

async function loadData() {
  state.loading = true;
  const [categoriesResult, contactsResult, reportsResult] = await Promise.all([
    db.from("useful_contact_categories").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    db.from("useful_contacts").select("*").order("is_emergency", { ascending: false }).order("is_featured", { ascending: false }).order("sort_order", { ascending: true }).order("name", { ascending: true }),
    db.from("useful_contact_reports").select("*").order("created_at", { ascending: false }).limit(50)
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (contactsResult.error) throw contactsResult.error;
  if (reportsResult.error) throw reportsResult.error;
  state.categories = categoriesResult.data || [];
  state.contacts = contactsResult.data || [];
  state.reports = reportsResult.data || [];
  state.loading = false;
  render();
}

async function saveContact(formData) {
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (!name || !phone) throw new Error("Informe nome e telefone.");
  const status = String(formData.get("verification_status") || "needs_review");
  const values = {
    name,
    slug: nullIfBlank(formData.get("slug")) || gerarSlug(name),
    category_id: nullIfBlank(formData.get("category_id")),
    description: nullIfBlank(formData.get("description")),
    phone,
    secondary_phone: nullIfBlank(formData.get("secondary_phone")),
    whatsapp: nullIfBlank(formData.get("whatsapp")),
    address: nullIfBlank(formData.get("address")),
    opening_hours: nullIfBlank(formData.get("opening_hours")),
    maps_query: nullIfBlank(formData.get("maps_query")),
    keywords: String(formData.get("keywords") || "").split(",").map(item => item.trim()).filter(Boolean),
    is_emergency: formData.has("is_emergency"),
    is_featured: formData.has("is_featured"),
    is_active: formData.has("is_active"),
    sort_order: toNumber(formData.get("sort_order")),
    verification_status: status,
    reviewed_at: nullIfBlank(formData.get("reviewed_at")) || (status === "needs_review" ? null : todayIsoDate()),
    source_name: nullIfBlank(formData.get("source_name")),
    source_url: nullIfBlank(formData.get("source_url")),
    updated_at: new Date().toISOString()
  };
  const id = nullIfBlank(formData.get("id"));
  const result = id
    ? await db.from("useful_contacts").update(values).eq("id", id)
    : await db.from("useful_contacts").insert(values);
  if (result.error) throw result.error;
  state.form = null;
  state.message = "Telefone salvo.";
  await loadData();
}

async function saveCategory(formData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Informe o nome da categoria.");
  const values = {
    name,
    slug: nullIfBlank(formData.get("slug")) || gerarSlug(name),
    icon: nullIfBlank(formData.get("icon")),
    sort_order: toNumber(formData.get("sort_order")),
    is_active: formData.has("is_active"),
    updated_at: new Date().toISOString()
  };
  const id = nullIfBlank(formData.get("id"));
  const result = id
    ? await db.from("useful_contact_categories").update(values).eq("id", id)
    : await db.from("useful_contact_categories").insert(values);
  if (result.error) throw result.error;
  state.categoryForm = null;
  state.message = "Categoria salva.";
  await loadData();
}

async function updateContact(id, values) {
  const { error } = await db.from("useful_contacts").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  await loadData();
}

async function markReportReviewed(id) {
  const { error } = await db.from("useful_contact_reports").update({ status: "reviewed" }).eq("id", id);
  if (error) throw error;
  await loadData();
}

function bindEvents() {
  app.addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button) return;
    try {
      if (button.dataset.newContact !== undefined) { state.form = "new"; render(); }
      if (button.dataset.editContact) { state.form = button.dataset.editContact; render(); }
      if (button.dataset.closeForm !== undefined) { state.form = null; render(); }
      if (button.dataset.newCategory !== undefined) { state.categoryForm = "new"; render(); }
      if (button.dataset.editCategory) { state.categoryForm = button.dataset.editCategory; render(); }
      if (button.dataset.closeCategoryForm !== undefined) { state.categoryForm = null; render(); }
      if (button.dataset.verifyContact) await updateContact(button.dataset.verifyContact, { verification_status: "manually_verified", reviewed_at: todayIsoDate() });
      if (button.dataset.toggleContact) {
        const contact = state.contacts.find(item => item.id === button.dataset.toggleContact);
        if (contact) await updateContact(contact.id, { is_active: !contact.is_active });
      }
      if (button.dataset.reviewReport) await markReportReviewed(button.dataset.reviewReport);
    } catch (error) {
      state.message = error.message || "Não foi possível salvar.";
      render();
    }
  });
  app.addEventListener("input", event => {
    if (event.target.matches("[data-search]")) {
      state.search = event.target.value;
      render();
    }
  });
  app.addEventListener("change", event => {
    if (event.target.matches("[data-filter-category]")) {
      state.category = event.target.value;
      render();
    }
    if (event.target.matches("[data-filter-status]")) {
      state.status = event.target.value;
      render();
    }
  });
  app.addEventListener("submit", async event => {
    const contactForm = event.target.closest("[data-contact-form]");
    const categoryForm = event.target.closest("[data-category-form]");
    if (!contactForm && !categoryForm) return;
    event.preventDefault();
    try {
      if (contactForm) await saveContact(new FormData(contactForm));
      if (categoryForm) await saveCategory(new FormData(categoryForm));
    } catch (error) {
      state.message = error.message || "Não foi possível salvar.";
      render();
    }
  });
}

export async function mount(container, options = {}) {
  app = null;
  db = options.db;
  context = options;
  cleanupHandlers = [];
  ensureModuleStyle();
  options.setTitle?.("Telefones úteis", "Organize contatos importantes e urgências exibidos no app.");
  container.innerHTML = `<section id="useful-contacts-admin" class="useful-admin loading">Carregando telefones úteis…</section>`;
  app = container.querySelector("#useful-contacts-admin");
  if (!temPermissao(options.access?.admin, "configuracoes", "ler")) {
    app.innerHTML = `<section class="panel"><p class="form-message">Você não tem permissão para acessar Telefones úteis.</p></section>`;
    return;
  }
  bindEvents();
  try {
    await loadData();
  } catch (error) {
    app.innerHTML = `<section class="panel"><h2>Não foi possível carregar Telefones úteis</h2><p class="form-message">${escapeHtml(error.message || "Erro inesperado.")}</p><p>Se necessário, rode a migration incremental de permissões administrativas para useful_contacts.</p></section>`;
  }
}

export function unmount() {
  cleanupHandlers.forEach(handler => handler());
  cleanupHandlers = [];
  app = null;
  db = null;
  context = {};
}
