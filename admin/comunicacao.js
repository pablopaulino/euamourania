import { exigirAdministrador, sair } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import "./media-upload.js";

let db = getSupabase();
let app = document.getElementById("communication-app");
let root = document;
let cleanupHandlers = [];
let mountedContainer = null;
let moduleContext = {};
const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));
const fmt = value => new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
const date = value => value ? new Date(value).toLocaleString("pt-BR") : "—";
const dateOnly = value => value ? new Date(value).toLocaleDateString("pt-BR") : "—";

let editor;

const interests = [
  ["noticias", "Notícias"],
  ["eventos", "Eventos"],
  ["turismo", "Turismo"],
  ["comercio", "Comércio"],
  ["promocoes", "Promoções"],
  ["esportes", "Esportes"],
  ["politica", "Política"],
  ["tudo", "Tudo"]
];

function toast(message, type = "success") {
  if (typeof moduleContext.toast === "function") {
    moduleContext.toast(message, type);
    return;
  }
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.textContent = message;
  document.getElementById("toasts").append(element);
  setTimeout(() => element.remove(), 3500);
}

function loading() {
  app.innerHTML = '<div class="ads-card"><div class="skeleton"></div><div class="skeleton"></div></div>';
}

function tabs(view) {
  root.querySelectorAll(".ads-tab").forEach(button => {
    button.classList.toggle("active", (button.dataset.communicationView || button.dataset.view) === view);
  });
}

function addCleanup(target, event, handler, options) {
  target?.addEventListener(event, handler, options);
  cleanupHandlers.push(() => target?.removeEventListener(event, handler, options));
}

function ensureCommunicationStyles() {
  ["publicidade.css", "comunicacao.css?v=20260717-newsletter-mensal", "comunicacao-fixes.css"].forEach(href => {
    if (document.querySelector(`link[data-communication-style][href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.communicationStyle = "true";
    document.head.appendChild(link);
    cleanupHandlers.push(() => link.remove());
  });
}

function renderShell(container) {
  container.classList.add("communication-module", "ads-content");
  container.innerHTML = `
    <div class="ads-heading">
      <div>
        <h2>Central de Comunicação</h2>
        <p>Assinantes, newsletters e resultados em um só lugar.</p>
      </div>
      <button class="admin-button" id="new-newsletter" type="button">+ Nova newsletter</button>
    </div>
    <div class="ads-tabs">
      <button class="ads-tab active" data-communication-view="dashboard" type="button">Visão geral</button>
      <button class="ads-tab" data-communication-view="subscribers" type="button">Assinantes</button>
      <button class="ads-tab" data-communication-view="newsletters" type="button">Newsletters</button>
    </div>
    <div id="communication-app"><div class="skeleton"></div></div>
  `;
}

function checks(name, selected = []) {
  return interests.map(([value, label]) => `
    <label class="ads-checkbox">
      <input type="checkbox" name="${name}" value="${value}" ${selected.includes(value) ? "checked" : ""}>
      ${label}
    </label>
  `).join("");
}

function monthlyInfo(newsletter) {
  const config = newsletter?.configuracao_futura || {};
  if (!newsletter) {
    return {
      title: "Nenhum resumo mensal gerado",
      text: "Gere um rascunho automático com os destaques dos últimos 30 dias.",
      period: "Pronto para gerar",
      recipients: 0,
      sent: 0,
      failures: 0
    };
  }
  return {
    title: newsletter.titulo || "Resumo mensal",
    text: newsletter.assunto || "Newsletter mensal do portal.",
    period: config.periodo_rotulo || config.periodo_chave || dateOnly(newsletter.criado_em),
    recipients: config.destinatarios_previstos || newsletter.total_enviados || 0,
    sent: newsletter.total_enviados || 0,
    failures: config.total_falhas || 0
  };
}

async function dashboard() {
  tabs("dashboard");
  loading();
  try {
    const [{ data: summary, error }, { data: last }, { data: monthly }] = await Promise.all([
      db.from("comunicacao_resumo").select("*").single(),
      db.from("newsletters").select("titulo,status,total_enviados,total_aberturas,total_cliques,enviado_em,criado_em,automatizacao_tipo,configuracao_futura").order("criado_em", { ascending: false }).limit(6),
      db.from("newsletters").select("*").eq("automatizacao_tipo", "resumo_mensal").order("criado_em", { ascending: false }).limit(1)
    ]);
    if (error) throw error;

    const monthlyCard = monthlyInfo(monthly?.[0]);
    const cards = [
      ["Total de assinantes", summary.total_assinantes],
      ["Assinantes ativos", summary.assinantes_ativos],
      ["Campanhas enviadas", summary.campanhas_enviadas],
      ["Aberturas", summary.aberturas],
      ["Cliques", summary.cliques],
      ["Taxa de cliques", `${summary.taxa_cliques}%`],
      ["Descadastros", summary.descadastros]
    ];

    app.innerHTML = `
      <div class="ads-grid">
        ${cards.map(([label, value]) => `
          <article class="metric-card">
            <span>${esc(label)}</span>
            <strong>${typeof value === "number" ? fmt(value) : esc(value)}</strong>
          </article>
        `).join("")}
      </div>

      <section class="ads-card monthly-newsletter-card">
        <div>
          <span class="cms-kicker">Automação assistida</span>
          <h3>Newsletter mensal automática</h3>
          <p>Gera um rascunho com notícias mais acessadas, empresas mais visitadas e novidades dos últimos 30 dias. O envio continua manual, depois da sua revisão.</p>
        </div>
        <div class="monthly-newsletter-panel">
          <div>
            <small>Último resumo</small>
            <strong>${esc(monthlyCard.title)}</strong>
            <span>${esc(monthlyCard.period)}</span>
          </div>
          <div class="monthly-newsletter-stats">
            <span><strong>${fmt(monthlyCard.recipients)}</strong> destinatários previstos</span>
            <span><strong>${fmt(monthlyCard.sent)}</strong> envios concluídos</span>
            <span><strong>${fmt(monthlyCard.failures)}</strong> falhas</span>
          </div>
          <div class="monthly-newsletter-actions">
            ${monthly?.[0]?.id ? `<button class="admin-button secondary" data-news-edit="${monthly[0].id}">Editar último</button>` : ""}
            <button class="admin-button" id="generate-monthly" data-generate-monthly>Gerar resumo mensal</button>
          </div>
        </div>
      </section>

      <section class="ads-card">
        <h3>Campanhas recentes</h3>
        <div class="table-wrap">
          <table class="cms-table">
            <thead><tr><th>Newsletter</th><th>Status</th><th>Enviados</th><th>Aberturas</th><th>Cliques</th></tr></thead>
            <tbody>
              ${(last || []).map(item => `
                <tr>
                  <td>
                    <strong>${esc(item.titulo)}</strong>
                    <small>${item.automatizacao_tipo === "resumo_mensal" ? "Resumo mensal · " : ""}${date(item.enviado_em || item.criado_em)}</small>
                  </td>
                  <td><span class="status-pill ${esc(item.status)}">${esc(item.status)}</span></td>
                  <td>${fmt(item.total_enviados)}</td>
                  <td>${fmt(item.total_aberturas)}</td>
                  <td>${fmt(item.total_cliques)}</td>
                </tr>
              `).join("") || '<tr><td colspan="5">Nenhuma campanha ainda.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;
  } catch (error) {
    app.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`;
  }
}

async function subscribers() {
  tabs("subscribers");
  loading();
  const { data, error } = await db.from("newsletter_assinantes").select("*").order("cadastrado_em", { ascending: false });
  if (error) return app.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`;

  app.innerHTML = `
    <section class="ads-card">
      <div class="cms-section-head">
        <div>
          <h2>Assinantes</h2>
          <p>Gerencie contatos, interesses e consentimento.</p>
        </div>
        <button class="admin-button" id="add-subscriber">Novo assinante</button>
      </div>
      <div class="cms-toolbar-v2">
        <input id="sub-search" placeholder="Pesquisar nome ou e-mail…">
        <select id="sub-status">
          <option value="">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
          <option value="descadastrado">Descadastrados</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="cms-table">
          <thead><tr><th>Assinante</th><th>Cidade</th><th>Interesses</th><th>Origem</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody id="sub-rows">
            ${(data || []).map(item => `
              <tr data-search="${esc(`${item.nome || ""} ${item.email || ""}`.toLowerCase())}" data-status="${esc(item.status)}">
                <td class="cms-title-cell"><strong>${esc(item.nome || "Sem nome")}</strong><small>${esc(item.email)}</small></td>
                <td>${esc(item.cidade || "—")}</td>
                <td>${esc((item.interesses || []).join(", "))}</td>
                <td>${esc(item.origem)}</td>
                <td><span class="status-pill ${esc(item.status)}">${esc(item.status)}</span></td>
                <td><div class="cms-actions"><button data-sub-edit="${item.id}">Editar</button><button class="danger" data-sub-delete="${item.id}">Excluir</button></div></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;

  const filter = () => {
    const search = document.getElementById("sub-search").value.toLowerCase();
    const status = document.getElementById("sub-status").value;
    document.querySelectorAll("#sub-rows tr").forEach(row => {
      row.hidden = !(row.dataset.search.includes(search) && (!status || row.dataset.status === status));
    });
  };
  document.getElementById("sub-search").oninput = filter;
  document.getElementById("sub-status").onchange = filter;
  document.getElementById("add-subscriber").onclick = () => subscriberForm();
}

async function subscriberForm(id) {
  let subscriber = { status: "ativo", interesses: ["tudo"] };
  if (id) {
    const { data } = await db.from("newsletter_assinantes").select("*").eq("id", id).single();
    subscriber = data;
  }

  app.innerHTML = `
    <section class="ads-card">
      <h3>${id ? "Editar" : "Novo"} assinante</h3>
      <form id="sub-form" class="cms-form">
        <div class="cms-field"><label>Nome</label><input name="nome" value="${esc(subscriber.nome || "")}"></div>
        <div class="cms-field"><label>E-mail *</label><input name="email" type="email" required value="${esc(subscriber.email || "")}"></div>
        <div class="cms-field"><label>Cidade</label><input name="cidade" value="${esc(subscriber.cidade || "")}"></div>
        <div class="cms-field"><label>Origem</label><input name="origem" value="${esc(subscriber.origem || "painel")}"></div>
        <div class="cms-field">
          <label>Status</label>
          <select name="status">${["ativo", "inativo", "descadastrado"].map(status => `<option ${subscriber.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>
        </div>
        <fieldset class="cms-field full"><legend>Interesses</legend><div class="newsletter-admin-checks">${checks("interesses", subscriber.interesses)}</div></fieldset>
        <div class="cms-sticky-actions"><button type="button" class="admin-button secondary" id="sub-cancel">Cancelar</button><button class="admin-button">Salvar</button></div>
      </form>
    </section>
  `;

  document.getElementById("sub-cancel").onclick = subscribers;
  document.getElementById("sub-form").onsubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      nome: form.get("nome") || null,
      email: form.get("email"),
      cidade: form.get("cidade") || null,
      origem: form.get("origem") || "painel",
      status: form.get("status"),
      interesses: form.getAll("interesses")
    };
    const query = id ? db.from("newsletter_assinantes").update(payload).eq("id", id) : db.from("newsletter_assinantes").insert(payload);
    const { error } = await query;
    error ? toast(error.message, "error") : (toast("Assinante salvo."), subscribers());
  };
}

function newsletterRow(newsletter) {
  const config = newsletter.configuracao_futura || {};
  const monthly = newsletter.automatizacao_tipo === "resumo_mensal";
  const period = config.periodo_rotulo || config.periodo_chave;
  const failures = config.total_falhas || 0;
  return `
    <tr>
      <td class="cms-title-cell">
        <strong>${esc(newsletter.titulo)}</strong>
        <small>${monthly ? "Resumo mensal · " : ""}${esc(newsletter.assunto)}</small>
        ${period ? `<small>Período: ${esc(period)}</small>` : ""}
      </td>
      <td>${esc((newsletter.interesses_alvo || []).join(", "))}</td>
      <td><span class="status-pill ${esc(newsletter.status)}">${esc(newsletter.status)}</span></td>
      <td>${date(newsletter.agendado_em)}</td>
      <td>
        ${fmt(newsletter.total_enviados)} enviados · ${fmt(newsletter.total_aberturas)} aberturas · ${fmt(newsletter.total_cliques)} cliques
        ${monthly ? `<small>${fmt(config.destinatarios_previstos || 0)} destinatários previstos · ${fmt(failures)} falhas</small>` : ""}
      </td>
      <td>
        <div class="cms-actions">
          <button data-news-edit="${newsletter.id}">Editar</button>
          <button data-news-test="${newsletter.id}">Teste</button>
          <button data-news-send="${newsletter.id}">Enviar</button>
          <button data-news-copy="${newsletter.id}">Duplicar</button>
          <button class="danger" data-news-delete="${newsletter.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `;
}

async function newsletters() {
  tabs("newsletters");
  loading();
  const { data, error } = await db.from("newsletters").select("*").order("criado_em", { ascending: false });
  if (error) return app.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`;

  app.innerHTML = `
    <section class="ads-card">
      <div class="cms-section-head">
        <div>
          <h2>Newsletters</h2>
          <p>Crie, teste, agende e acompanhe seus envios.</p>
        </div>
        <div class="newsletter-head-actions">
          <button class="admin-button secondary" data-generate-monthly>Gerar resumo mensal</button>
          <button class="admin-button" id="add-news">Nova newsletter</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="cms-table">
          <thead><tr><th>Campanha</th><th>Público</th><th>Status</th><th>Agendamento</th><th>Resultados</th><th>Ações</th></tr></thead>
          <tbody>${(data || []).map(newsletterRow).join("") || '<tr><td colspan="6">Nenhuma newsletter.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
  document.getElementById("add-news").onclick = () => newsletterForm();
}

async function newsletterForm(id) {
  let newsletter = { status: "rascunho", interesses_alvo: ["tudo"], configuracao_futura: {} };
  if (id) {
    const { data } = await db.from("newsletters").select("*").eq("id", id).single();
    newsletter = data;
  }
  const config = newsletter.configuracao_futura || {};

  app.innerHTML = `
    <section class="ads-card">
      <h3>${id ? "Editar" : "Nova"} newsletter</h3>
      ${newsletter.automatizacao_tipo === "resumo_mensal" ? `
        <div class="monthly-editor-note">
          <span>Resumo mensal</span>
          <strong>${esc(config.periodo_rotulo || config.periodo_chave || "Período automático")}</strong>
          <small>${fmt(config.destinatarios_previstos || 0)} destinatários previstos · envio manual após revisão</small>
        </div>
      ` : ""}
      <form id="news-form" class="cms-form">
        <div class="cms-field"><label>Título interno *</label><input name="titulo" required value="${esc(newsletter.titulo || "")}"></div>
        <div class="cms-field"><label>Assunto do e-mail *</label><input name="assunto" required value="${esc(newsletter.assunto || "")}"></div>
        <div class="cms-field full"><label>Texto de prévia</label><input name="preheader" value="${esc(newsletter.preheader || "")}"></div>
        <div class="cms-field"><label>Imagem</label><input name="imagem_url" type="url" value="${esc(newsletter.imagem_url || "")}"></div>
        <div class="cms-field"><label>Agendar envio</label><input name="agendado_em" type="datetime-local" value="${newsletter.agendado_em ? new Date(newsletter.agendado_em).toISOString().slice(0, 16) : ""}"></div>
        <div class="cms-field full"><label>Conteúdo</label><div id="editor"></div></div>
        <div class="cms-field"><label>Texto do botão</label><input name="texto_botao" value="${esc(newsletter.texto_botao || "")}"></div>
        <div class="cms-field"><label>Link do botão</label><input name="link_botao" type="url" value="${esc(newsletter.link_botao || "")}"></div>
        <fieldset class="cms-field full"><legend>Público por interesses</legend><div class="newsletter-admin-checks">${checks("interesses", newsletter.interesses_alvo)}</div></fieldset>
        <div class="cms-sticky-actions"><button type="button" class="admin-button secondary" id="news-cancel">Cancelar</button><button class="admin-button">Salvar rascunho</button></div>
      </form>
    </section>
  `;

  editor = new Quill("#editor", {
    theme: "snow",
    modules: { toolbar: [[{ header: [2, 3, false] }], ["bold", "italic", "blockquote"], [{ list: "ordered" }, { list: "bullet" }], ["link", "image"], ["clean"]] }
  });
  editor.root.innerHTML = newsletter.conteudo_html || "";
  document.getElementById("news-cancel").onclick = newsletters;
  document.getElementById("news-form").onsubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      titulo: form.get("titulo"),
      assunto: form.get("assunto"),
      preheader: form.get("preheader") || null,
      imagem_url: form.get("imagem_url") || null,
      conteudo_html: editor.root.innerHTML,
      texto_botao: form.get("texto_botao") || null,
      link_botao: form.get("link_botao") || null,
      interesses_alvo: form.getAll("interesses"),
      agendado_em: form.get("agendado_em") ? new Date(form.get("agendado_em")).toISOString() : null,
      status: form.get("agendado_em") ? "agendado" : "rascunho",
      automatizacao_tipo: newsletter.automatizacao_tipo || null,
      configuracao_futura: newsletter.configuracao_futura || {}
    };
    const query = id ? db.from("newsletters").update(payload).eq("id", id) : db.from("newsletters").insert(payload);
    const { error } = await query;
    error ? toast(error.message, "error") : (toast("Newsletter salva."), newsletters());
  };
}

async function send(id, action) {
  const { data: { session } } = await db.auth.getSession();
  let testEmail;
  if (action === "test") {
    testEmail = prompt("E-mail que receberá o teste:");
    if (!testEmail) return;
  } else if (!confirm(action === "schedule" ? "Confirmar agendamento?" : "Enviar esta newsletter agora para o público selecionado?")) {
    return;
  }
  const response = await fetch("/api/newsletter-send", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id, action, testEmail })
  });
  const data = await response.json();
  response.ok ? (toast(data.message), newsletters()) : toast(data.error || "Falha no envio", "error");
}

async function generateMonthly() {
  const button = root.querySelector("[data-generate-monthly]");
  const { data: { session } } = await db.auth.getSession();
  if (!session?.access_token) return toast("Sessão expirada. Faça login novamente.", "error");
  if (!confirm("Gerar um rascunho com os destaques dos últimos 30 dias? Se já existir resumo deste mês, ele será reaproveitado.")) return;

  if (button) {
    button.disabled = true;
    button.textContent = "Gerando…";
  }

  try {
    const response = await fetch("/api/newsletter-send", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_monthly" })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Falha ao gerar resumo mensal");
    toast(result.message || "Resumo mensal gerado.");
    if (result.newsletter?.id) newsletterForm(result.newsletter.id);
    else newsletters();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Gerar resumo mensal";
    }
  }
}

function bindCommunicationEvents(){
 root.querySelectorAll(".ads-tab").forEach(button => {
  const handler = event => {
    event.preventDefault();
    event.stopPropagation();
    ({ dashboard, subscribers, newsletters }[button.dataset.communicationView || button.dataset.view])();
  };
  addCleanup(button, "click", handler);
 });
 addCleanup(root.getElementById?.("new-newsletter") || root.querySelector("#new-newsletter"), "click", () => newsletterForm());

 const appClickHandler = async event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.generateMonthly !== undefined) generateMonthly();
  if (button.dataset.subEdit) subscriberForm(button.dataset.subEdit);
  if (button.dataset.subDelete && confirm("Excluir este assinante?")) {
    const { error } = await db.from("newsletter_assinantes").delete().eq("id", button.dataset.subDelete);
    error ? toast(error.message, "error") : (toast("Assinante excluído."), subscribers());
  }
  if (button.dataset.newsEdit) newsletterForm(button.dataset.newsEdit);
  if (button.dataset.newsTest) send(button.dataset.newsTest, "test");
 if (button.dataset.newsSend) {
    const { data: newsletter } = await db.from("newsletters").select("status,agendado_em").eq("id", button.dataset.newsSend).single();
    const action = newsletter?.status === "agendado" && newsletter.agendado_em ? "schedule" : "send";
    send(button.dataset.newsSend, action);
  }
  if (button.dataset.newsDelete && confirm("Excluir esta newsletter?")) {
    const { error } = await db.from("newsletters").delete().eq("id", button.dataset.newsDelete);
    error ? toast(error.message, "error") : (toast("Newsletter excluída."), newsletters());
  }
  if (button.dataset.newsCopy) {
    const { data } = await db.from("newsletters").select("*").eq("id", button.dataset.newsCopy).single();
    delete data.id;
    delete data.criado_em;
    delete data.atualizado_em;
    data.titulo += " (cópia)";
    data.status = "rascunho";
    data.agendado_em = null;
    data.enviado_em = null;
    data.automatizacao_tipo = null;
    data.configuracao_futura = {};
    data.total_enviados = data.total_entregues = data.total_aberturas = data.total_cliques = data.total_descadastros = 0;
    await db.from("newsletters").insert(data);
    toast("Newsletter duplicada.");
    newsletters();
  }
 };
 addCleanup(app, "click", appClickHandler);
}

function enhanceCommunicationRows() {
  const apply = () => {
    app.querySelectorAll("tr").forEach(row => {
      const original = row.querySelector("[data-news-test]");
      if (!original || row.querySelector(".mobile-news-test")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mobile-news-test";
      button.dataset.newsTest = original.dataset.newsTest;
      button.textContent = "Enviar teste";
      row.cells[0]?.append(button);
    });
    const empty = [...app.querySelectorAll("td")].find(td => td.textContent.includes("Nenhuma newsletter"));
    if (empty && !app.querySelector(".communication-help")) {
      const help = document.createElement("p");
      help.className = "communication-help";
      help.textContent = "Crie e salve a primeira newsletter. Depois o botão Enviar teste aparecerá nesta lista.";
      empty.append(help);
    }
  };
  const observer = new MutationObserver(apply);
  observer.observe(app, { childList: true, subtree: true });
  cleanupHandlers.push(() => observer.disconnect());
  apply();
}

export async function mount(container, context = {}) {
  unmount();
  mountedContainer = container;
  moduleContext = context;
  db = context.db || getSupabase();
  root = container;
  ensureCommunicationStyles();
  renderShell(container);
  app = container.querySelector("#communication-app");
  context.setTitle?.("Comunicação", "Assinantes, newsletters e resultados em um só lugar.");
  document.title = "Comunicação | Eu Amo Urânia";
  bindCommunicationEvents();
  enhanceCommunicationRows();
  await dashboard();
}

export function unmount() {
  cleanupHandlers.splice(0).forEach(clean => {
    try { clean(); } catch {}
  });
  if (editor) {
    editor = null;
  }
  if (mountedContainer) {
    mountedContainer.classList.remove("communication-module", "ads-content");
    mountedContainer.innerHTML = "";
  }
  mountedContainer = null;
  moduleContext = {};
  root = document;
  app = document.getElementById("communication-app");
}

async function bootLegacyPage() {
  const legacyApp = document.getElementById("communication-app");
  if (!legacyApp || document.body.dataset.adminShell === "true") return;
  app = legacyApp;
  root = document;
  const access = await exigirAdministrador();
  if (access) {
    document.getElementById("admin-user").textContent = access.admin.nome || access.user.email;
    document.getElementById("logout").onclick = sair;
    document.getElementById("mobile-menu").onclick = () => document.getElementById("sidebar").classList.toggle("open");
    bindCommunicationEvents();
    dashboard();
  }
}

bootLegacyPage();
