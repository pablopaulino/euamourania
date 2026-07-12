import { exigirPermissao, sair } from "./auth.js";
import { gerarSlug } from "../assets/js/utils.js";
import {
  obterResumoMelhores,
  listarEdicoes,
  salvarEdicao,
  excluirEdicao,
  listarCategorias,
  salvarCategoria,
  excluirCategoria,
  listarIndicacoes,
  moderarIndicacao,
  excluirIndicacao,
  listarIndicados,
  salvarIndicado,
  excluirIndicado,
  listarGuiaComercial,
  listarInstagramVotos,
  salvarInstagramVoto,
  excluirInstagramVoto,
  obterApuracao,
  publicarResultado,
  listarResultados
} from "../assets/js/services/melhoresService.js";

const $ = selector => document.querySelector(selector);
const state = { tab: "dashboard", edicoes: [], categorias: [], indicacoes: [], indicados: [], guia: [], instagram: [], apuracao: [], resultados: [] };
const editionStatuses = [
  "planejamento",
  "indicacoes_abertas",
  "indicacoes_encerradas",
  "votacao_aberta",
  "votacao_encerrada",
  "apuracao",
  "resultado_publicado",
  "arquivada"
];
const categoryStatuses = ["ativo", "inativo", "arquivado"];
const nomineeStatuses = ["rascunho", "ativo", "inativo", "reprovado", "arquivado"];
const indicationStatuses = ["pendente", "aprovada", "rejeitada", "convertida", "duplicada", "spam"];

function escapeHtml(value = "") {
  const el = document.createElement("div");
  el.textContent = String(value ?? "");
  return el.innerHTML;
}

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 3800);
}

function fmtDate(value) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Não definido";
}

function fmtDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function validReference(value) {
  return !value || /^(?:https?:\/\/|\/(?!\/)|\.{1,2}\/|assets\/|#)/i.test(value);
}

function optionList(values, selected) {
  return values.map(value => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(value.replaceAll("_", " "))}</option>`).join("");
}

function setActiveTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".awards-tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".awards-view").forEach(view => view.classList.toggle("active", view.id === `${tab}-view`));
}

function showError(error) {
  const message = String(error?.message || error || "Erro inesperado.");
  const hint = message.includes("melhores_")
    ? "A migração da Fase 1 ainda precisa ser executada no Supabase antes de usar este módulo."
    : message;
  $(".awards-view.active").innerHTML = `<div class="awards-error"><strong>Não foi possível carregar o módulo.</strong><p>${escapeHtml(hint)}</p></div>`;
}

async function loadDashboard() {
  setActiveTab("dashboard");
  $("#dashboard-view").innerHTML = '<div class="loading">Carregando visão geral…</div>';
  try {
    const resumo = await obterResumoMelhores();
    const edicao = resumo.edicaoAtiva;
    $("#dashboard-view").innerHTML = `
      <div class="awards-grid">
        ${[
          ["Edições", resumo.edicoes],
          ["Categorias", resumo.categorias],
          ["Indicados", resumo.indicados],
          ["Indicados ativos", resumo.indicadosAtivos],
          ["Indicações pendentes", resumo.indicacoesPendentes]
        ].map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`).join("")}
      </div>
      <div class="awards-layout">
        <article class="awards-card">
          <h3>Edição ativa</h3>
          ${edicao ? `
            <div class="awards-name">
              ${edicao.imagem_capa_url ? `<img class="awards-thumb" src="${escapeHtml(edicao.imagem_capa_url)}" alt="">` : '<span class="awards-thumb"></span>'}
              <div>
                <strong>${escapeHtml(edicao.nome)}</strong>
                <small>${escapeHtml(String(edicao.ano))} · <span class="awards-status ${escapeHtml(edicao.status)}">${escapeHtml(edicao.status.replaceAll("_", " "))}</span></small>
              </div>
            </div>
            <div class="awards-kv" style="margin-top:1rem">
              <div><span>Indicações</span><strong>${fmtDate(edicao.indicacoes_inicio)} — ${fmtDate(edicao.indicacoes_fim)}</strong></div>
              <div><span>Votação</span><strong>${fmtDate(edicao.votacao_inicio)} — ${fmtDate(edicao.votacao_fim)}</strong></div>
              <div><span>Pesos</span><strong>Site ${edicao.peso_site}% · Instagram ${edicao.peso_instagram}%</strong></div>
            </div>
          ` : '<div class="awards-empty">Nenhuma edição ativa. Crie uma edição ou altere o status de uma existente.</div>'}
        </article>
        <article class="awards-card">
          <h3>Fase atual</h3>
          <p class="awards-note">
            Fluxo completo ativo: edições, categorias, indicações públicas, indicados,
            votação, Instagram, apuração e resultados oficiais.
          </p>
        </article>
      </div>`;
  } catch (error) {
    showError(error);
  }
}

async function loadEditions() {
  setActiveTab("editions");
  $("#editions-view").innerHTML = '<div class="loading">Carregando edições…</div>';
  try {
    state.edicoes = await listarEdicoes();
    $("#editions-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Edições</h3><p>Crie uma edição por ano e configure períodos, pesos e regulamento.</p></div>
          <button class="admin-button" data-new-edition>Nova edição</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Edição</th><th>Status</th><th>Votação</th><th>Pesos</th><th>Ações</th></tr></thead>
            <tbody>${state.edicoes.length ? state.edicoes.map(editionRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhuma edição cadastrada.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
  } catch (error) {
    showError(error);
  }
}

function editionRow(item) {
  return `<tr>
    <td><div class="awards-name">${item.imagem_capa_url ? `<img class="awards-thumb" src="${escapeHtml(item.imagem_capa_url)}" alt="">` : '<span class="awards-thumb"></span>'}<div><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.slug)} · ${item.ano}</small></div></div></td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status.replaceAll("_", " "))}</span></td>
    <td>${fmtDate(item.votacao_inicio)}<br><small>${fmtDate(item.votacao_fim)}</small></td>
    <td>Site ${item.peso_site}%<br><small>Instagram ${item.peso_instagram}%</small></td>
    <td><div class="awards-actions"><button data-edit-edition="${item.id}">Editar</button><button class="danger" data-delete-edition="${item.id}">Excluir</button></div></td>
  </tr>`;
}

async function loadCategories() {
  setActiveTab("categories");
  $("#categories-view").innerHTML = '<div class="loading">Carregando categorias…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const selected = $("#category-edition-filter")?.value || state.edicoes[0]?.id || "";
    state.categorias = await listarCategorias(selected);
    $("#categories-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Categorias</h3><p>As categorias não ficam fixas no código: tudo é administrável por edição.</p></div>
          <button class="admin-button" data-new-category>Nova categoria</button>
        </div>
        <div class="awards-toolbar">
          <input id="category-search" type="search" placeholder="Pesquisar categoria…">
          <select id="category-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === selected ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="category-status-filter"><option value="">Todos os status</option>${optionList(categoryStatuses, "")}</select>
          <button class="admin-button secondary" data-refresh-categories>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Categoria</th><th>Status</th><th>Ordem</th><th>Regras</th><th>Ações</th></tr></thead>
            <tbody id="category-rows">${state.categorias.length ? state.categorias.map(categoryRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhuma categoria nesta edição.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindFilter("category");
  } catch (error) {
    showError(error);
  }
}

function categoryRow(item) {
  return `<tr data-search="${escapeHtml(`${item.nome} ${item.slug}`.toLowerCase())}" data-status="${escapeHtml(item.status)}">
    <td><div class="awards-name">${item.imagem_url ? `<img class="awards-thumb" src="${escapeHtml(item.imagem_url)}" alt="">` : '<span class="awards-thumb"></span>'}<div><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.slug)}</small></div></div></td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
    <td>${Number(item.ordem || 0)}</td>
    <td><small>${item.permite_multiplos_votos ? `${item.max_escolhas} escolhas` : "1 voto"} · ${item.permite_indicacao_publica ? "indicação pública" : "sem indicação pública"}</small></td>
    <td><div class="awards-actions"><button data-edit-category="${item.id}">Editar</button><button class="danger" data-delete-category="${item.id}">Excluir</button></div></td>
  </tr>`;
}

async function loadIndications() {
  setActiveTab("indications");
  $("#indications-view").innerHTML = '<div class="loading">Carregando indicações…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#indication-edition-filter")?.value || state.edicoes[0]?.id || "";
    const status = $("#indication-status-filter")?.value || "";
    state.indicacoes = await listarIndicacoes({ edicaoId, status });
    $("#indications-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Indicações públicas</h3><p>Analise sugestões enviadas pela comunidade antes de transformar em indicado oficial.</p></div>
        </div>
        <div class="awards-toolbar">
          <input id="indication-search" type="search" placeholder="Pesquisar indicação…">
          <select id="indication-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="indication-status-filter"><option value="">Todos os status</option>${optionList(indicationStatuses, status)}</select>
          <button class="admin-button secondary" data-refresh-indications>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Indicação</th><th>Categoria</th><th>Responsável</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody id="indication-rows">${state.indicacoes.length ? state.indicacoes.map(indicationRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhuma indicação encontrada.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindSimpleSearch("indication", "indication-rows");
  } catch (error) {
    showError(error);
  }
}

function indicationRow(item) {
  return `<tr data-search="${escapeHtml(`${item.nome_indicado} ${item.justificativa || ""} ${item.nome_responsavel || ""} ${item.melhores_categorias?.nome || ""}`.toLowerCase())}" data-status="${escapeHtml(item.status)}">
    <td><strong>${escapeHtml(item.nome_indicado)}</strong><br><small>${escapeHtml((item.justificativa || "Sem justificativa").slice(0, 180))}</small>${item.contato_indicado ? `<br><small>Contato indicado: ${escapeHtml(item.contato_indicado)}</small>` : ""}</td>
    <td>${escapeHtml(item.melhores_categorias?.nome || "Categoria")}</td>
    <td>${escapeHtml(item.nome_responsavel || "Não informado")}<br><small>${escapeHtml(item.contato_responsavel || "Sem contato")} · ${fmtDate(item.criado_em)}</small></td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>${item.melhores_indicados?.nome ? `<br><small>Gerou: ${escapeHtml(item.melhores_indicados.nome)}</small>` : ""}</td>
    <td><div class="awards-actions">
      <button data-convert-indication="${item.id}">Converter</button>
      <button data-approve-indication="${item.id}">Aprovar</button>
      <button data-reject-indication="${item.id}">Rejeitar</button>
      <button data-duplicate-indication="${item.id}">Duplicada</button>
      <button class="danger" data-spam-indication="${item.id}">Spam</button>
      <button class="danger" data-delete-indication="${item.id}">Excluir</button>
    </div></td>
  </tr>`;
}

async function updateIndicationStatus(id, status) {
  const note = ["rejeitada", "duplicada", "spam"].includes(status)
    ? prompt("Observação interna da moderação:", status === "rejeitada" ? "Não atende aos critérios da edição." : "")
    : "";
  if (note === null) return;
  await moderarIndicacao(id, { status, observacao_interna: note || null });
  toast("Indicação atualizada.");
  state.indicacoes = [];
  await loadIndications();
}

async function convertIndication(id) {
  const item = state.indicacoes.find(indicacao => indicacao.id === id);
  if (!item) return toast("Indicação não encontrada.", "error");
  if (!confirm(`Converter "${item.nome_indicado}" em indicado oficial?`)) return;
  const slugBase = gerarSlug(item.nome_indicado || "indicado");
  const nominee = await salvarIndicado({
    edicao_id: item.edicao_id,
    categoria_id: item.categoria_id,
    nome: item.nome_indicado,
    slug: `${slugBase}-${String(Date.now()).slice(-5)}`,
    status: "rascunho",
    ordem: 0,
    descricao_curta: item.justificativa || null,
    observacao_interna: `Criado a partir da indicação pública ${item.id}. Responsável: ${item.nome_responsavel || "não informado"} (${item.contato_responsavel || "sem contato"}).`,
    aprovado: false,
    consentimento: false
  });
  await moderarIndicacao(item.id, {
    status: "convertida",
    indicado_gerado_id: nominee.id,
    observacao_interna: "Convertida em indicado oficial em rascunho. Revise consentimento, imagem e dados antes de publicar."
  });
  toast("Indicação convertida em indicado rascunho.");
  state.indicacoes = [];
  state.indicados = [];
  await loadIndications();
}

async function loadNominees() {
  setActiveTab("nominees");
  $("#nominees-view").innerHTML = '<div class="loading">Carregando indicados…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#nominee-edition-filter")?.value || state.edicoes[0]?.id || "";
    if (!state.categorias.length || !state.categorias.some(c => c.edicao_id === edicaoId)) state.categorias = await listarCategorias(edicaoId);
    const categoriaId = $("#nominee-category-filter")?.value || "";
    state.indicados = await listarIndicados({ edicaoId, categoriaId });
    $("#nominees-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Indicados</h3><p>Cadastre manualmente ou vincule a uma empresa já existente no Guia Comercial.</p></div>
          <button class="admin-button" data-new-nominee>Novo indicado</button>
        </div>
        <div class="awards-toolbar">
          <input id="nominee-search" type="search" placeholder="Pesquisar indicado…">
          <select id="nominee-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="nominee-category-filter"><option value="">Todas as categorias</option>${state.categorias.map(c => `<option value="${c.id}" ${c.id === categoriaId ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-nominees>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Indicado</th><th>Status</th><th>Categoria</th><th>Guia</th><th>Ações</th></tr></thead>
            <tbody id="nominee-rows">${state.indicados.length ? state.indicados.map(nomineeRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhum indicado cadastrado.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindFilter("nominee");
  } catch (error) {
    showError(error);
  }
}

function nomineeRow(item) {
  return `<tr data-search="${escapeHtml(`${item.nome} ${item.slug} ${item.melhores_categorias?.nome || ""}`.toLowerCase())}" data-status="${escapeHtml(item.status)}">
    <td><div class="awards-name">${item.imagem_url ? `<img class="awards-thumb" src="${escapeHtml(item.imagem_url)}" alt="">` : '<span class="awards-thumb"></span>'}<div><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.slug)} ${item.aprovado ? "· aprovado" : ""}</small></div></div></td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
    <td>${escapeHtml(item.melhores_categorias?.nome || "Sem categoria")}</td>
    <td>${item.guia_comercial?.nome ? escapeHtml(item.guia_comercial.nome) : "—"}</td>
    <td><div class="awards-actions"><button data-edit-nominee="${item.id}">Editar</button><button class="danger" data-delete-nominee="${item.id}">Excluir</button></div></td>
  </tr>`;
}

async function loadInstagram() {
  setActiveTab("instagram");
  $("#instagram-view").innerHTML = '<div class="loading">Carregando votos do Instagram…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#instagram-edition-filter")?.value || state.edicoes[0]?.id || "";
    if (!state.categorias.length || !state.categorias.some(c => c.edicao_id === edicaoId)) state.categorias = await listarCategorias(edicaoId);
    state.indicados = await listarIndicados({ edicaoId });
    state.instagram = await listarInstagramVotos(edicaoId);
    $("#instagram-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Votos do Instagram</h3><p>Lance manualmente os votos coletados nas enquetes. O sistema normaliza por percentual na apuração.</p></div>
          <button class="admin-button" data-new-instagram>Adicionar votos</button>
        </div>
        <div class="awards-toolbar">
          <input id="instagram-search" type="search" placeholder="Pesquisar indicado ou categoria…">
          <select id="instagram-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="instagram-category-filter"><option value="">Todas as categorias</option>${state.categorias.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-instagram>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Indicado</th><th>Categoria</th><th>Votos</th><th>Coleta</th><th>Ações</th></tr></thead>
            <tbody id="instagram-rows">${state.instagram.length ? state.instagram.map(instagramRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhum voto do Instagram lançado.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindSimpleSearch("instagram", "instagram-rows");
  } catch (error) {
    showError(error);
  }
}

function instagramRow(item) {
  return `<tr data-search="${escapeHtml(`${item.melhores_indicados?.nome || ""} ${item.melhores_categorias?.nome || ""}`.toLowerCase())}" data-category="${escapeHtml(item.categoria_id)}">
    <td><strong>${escapeHtml(item.melhores_indicados?.nome || "Indicado")}</strong>${item.comprovante_url ? `<br><small><a class="awards-link" href="${escapeHtml(item.comprovante_url)}" target="_blank" rel="noopener">Ver comprovante</a></small>` : ""}</td>
    <td>${escapeHtml(item.melhores_categorias?.nome || "Categoria")}</td>
    <td><strong>${Number(item.votos || 0).toLocaleString("pt-BR")}</strong></td>
    <td>${fmtDate(item.coletado_em)}</td>
    <td><div class="awards-actions"><button data-edit-instagram="${item.id}">Editar</button><button class="danger" data-delete-instagram="${item.id}">Excluir</button></div></td>
  </tr>`;
}

async function loadApuration() {
  setActiveTab("apuration");
  $("#apuration-view").innerHTML = '<div class="loading">Calculando apuração…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#apuration-edition-filter")?.value || state.edicoes[0]?.id || "";
    state.apuracao = edicaoId ? await obterApuracao(edicaoId) : [];
    const grouped = groupBy(state.apuracao, "categoria_id");
    $("#apuration-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Apuração</h3><p>Prévia ponderada por percentuais: site e Instagram são normalizados antes de aplicar os pesos.</p></div>
        </div>
        <div class="awards-toolbar">
          <input id="apuration-search" type="search" placeholder="Pesquisar categoria ou indicado…">
          <select id="apuration-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-apuration>Atualizar</button>
          <button class="admin-button" data-publish-results>Revisar e publicar resultado</button>
        </div>
        ${state.apuracao.length ? [...grouped.entries()].map(([categoriaId, rows]) => apurationGroup(categoriaId, rows)).join("") : '<div class="awards-empty">Sem dados suficientes para apuração.</div>'}
      </article>`;
    bindSimpleSearch("apuration", "apuration-view");
  } catch (error) {
    showError(error);
  }
}

function apurationGroup(_categoriaId, rows) {
  const title = rows[0]?.categoria_nome || "Categoria";
  return `<section class="awards-apuration-group" data-search="${escapeHtml(rows.map(r => `${r.categoria_nome} ${r.indicado_nome}`).join(" ").toLowerCase())}">
    <h4>${escapeHtml(title)}</h4>
    <div class="awards-table-wrap">
      <table class="awards-table">
        <thead><tr><th>Colocação</th><th>Indicado</th><th>Site</th><th>Instagram</th><th>Pontuação</th><th>Observação</th></tr></thead>
        <tbody>${rows.map(row => `<tr>
          <td><strong>${Number(row.colocacao || 0)}º</strong></td>
          <td>${escapeHtml(row.indicado_nome)}</td>
          <td>${Number(row.votos_site || 0).toLocaleString("pt-BR")} <small>(${Number(row.percentual_site || 0).toFixed(2)}%)</small></td>
          <td>${Number(row.votos_instagram || 0).toLocaleString("pt-BR")} <small>(${Number(row.percentual_instagram || 0).toFixed(2)}%)</small></td>
          <td><strong>${Number(row.pontuacao_final || 0).toFixed(4)}</strong></td>
          <td>${row.empate ? '<span class="awards-status planejamento">empate</span>' : row.colocacao === 1 ? '<span class="awards-status ativo">vencedor prévio</span>' : ""}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

async function loadResults() {
  setActiveTab("results");
  $("#results-view").innerHTML = '<div class="loading">Carregando resultados…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#results-edition-filter")?.value || state.edicoes[0]?.id || "";
    state.resultados = edicaoId ? await listarResultados(edicaoId) : [];
    const grouped = groupBy(state.resultados, "categoria_id");
    $("#results-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Resultados oficiais</h3><p>Snapshot publicado da edição. Estes dados não são recalculados automaticamente.</p></div>
        </div>
        <div class="awards-toolbar">
          <input id="results-search" type="search" placeholder="Pesquisar resultado…">
          <select id="results-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-results>Atualizar</button>
        </div>
        ${state.resultados.length ? [...grouped.entries()].map(([, rows]) => resultGroup(rows)).join("") : '<div class="awards-empty">Nenhum resultado oficial publicado ainda.</div>'}
      </article>`;
    bindSimpleSearch("results", "results-view");
  } catch (error) {
    showError(error);
  }
}

function resultGroup(rows) {
  const title = rows[0]?.melhores_categorias?.nome || "Categoria";
  return `<section class="awards-apuration-group" data-search="${escapeHtml(rows.map(r => `${title} ${r.melhores_indicados?.nome || ""}`).join(" ").toLowerCase())}">
    <h4>${escapeHtml(title)}</h4>
    <div class="awards-table-wrap">
      <table class="awards-table">
        <thead><tr><th>Colocação</th><th>Indicado</th><th>Selo</th><th>Pontuação</th><th>Publicado</th></tr></thead>
        <tbody>${rows.map(row => `<tr>
          <td><strong>${Number(row.colocacao || 0)}º</strong></td>
          <td>${escapeHtml(row.melhores_indicados?.nome || "Indicado")}</td>
          <td><span class="awards-status ${row.vencedor ? "ativo" : ""}">${escapeHtml(row.selo || "finalista")}</span></td>
          <td>${Number(row.pontuacao_final || 0).toFixed(4)}</td>
          <td>${fmtDate(row.publicado_em)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

function groupBy(rows, field) {
  const map = new Map();
  rows.forEach(row => {
    const key = row[field] || "sem-chave";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function bindSimpleSearch(prefix, rootId) {
  const input = $(`#${prefix}-search`);
  const category = $(`#${prefix}-category-filter`);
  const filter = () => {
    const term = (input?.value || "").toLowerCase();
    const cat = category?.value || "";
    document.querySelectorAll(`#${rootId} [data-search]`).forEach(row => {
      row.hidden = !row.dataset.search.includes(term) || (cat && row.dataset.category !== cat);
    });
  };
  input?.addEventListener("input", filter);
  category?.addEventListener("input", filter);
}

function bindFilter(type) {
  const input = $(`#${type}-search`);
  const status = $(`#${type}-status-filter`);
  const rowsId = type === "category" ? "category-rows" : "nominee-rows";
  const filter = () => {
    const term = (input?.value || "").toLowerCase();
    const selectedStatus = status?.value || "";
    document.querySelectorAll(`#${rowsId} tr[data-search]`).forEach(row => {
      row.hidden = !row.dataset.search.includes(term) || (selectedStatus && row.dataset.status !== selectedStatus);
    });
  };
  input?.addEventListener("input", filter);
  status?.addEventListener("input", filter);
}

function field(name, label, value = "", attrs = "") {
  return `<label class="awards-field"><span>${label}</span><input name="${name}" value="${escapeHtml(value ?? "")}" ${attrs}></label>`;
}

function textarea(name, label, value = "", attrs = "") {
  return `<label class="awards-field full"><span>${label}</span><textarea name="${name}" ${attrs}>${escapeHtml(value ?? "")}</textarea></label>`;
}

function selectField(name, label, html, className = "") {
  return `<label class="awards-field ${className}"><span>${label}</span><select name="${name}">${html}</select></label>`;
}

function showForm(title, html, onSubmit) {
  setActiveTab("form");
  $("#form-view").innerHTML = `<article class="awards-card"><div class="awards-panel-head"><div><h3>${escapeHtml(title)}</h3><p>Preencha com atenção. Slugs e pesos têm validação no banco.</p></div></div><form class="awards-form" id="awards-form">${html}<div class="awards-form-actions"><button type="button" class="admin-button secondary" data-cancel-form>Cancelar</button><button class="admin-button" type="submit">Salvar</button></div></form></article>`;
  $("#awards-form").addEventListener("submit", onSubmit);
}

function wireSlug(form, sourceName = "nome") {
  const source = form.elements[sourceName];
  const slug = form.elements.slug;
  source?.addEventListener("input", () => {
    if (slug && !slug.dataset.manual) slug.value = gerarSlug(source.value);
  });
  slug?.addEventListener("input", () => slug.dataset.manual = "1");
}

async function editionForm(id) {
  const item = id ? state.edicoes.find(x => x.id === id) || (await listarEdicoes()).find(x => x.id === id) : { ano: new Date().getFullYear(), peso_site: 50, peso_instagram: 50, status: "planejamento" };
  showForm(id ? "Editar edição" : "Nova edição", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    ${field("nome", "Nome *", item.nome || "", "required maxlength='140'")}
    ${field("ano", "Ano *", item.ano || "", "type='number' min='2024' max='2100' required")}
    ${field("slug", "Slug *", item.slug || "", "required")}
    ${selectField("status", "Status", optionList(editionStatuses, item.status || "planejamento"))}
    ${field("imagem_capa_url", "Imagem de capa", item.imagem_capa_url || "", "placeholder='https://... ou /assets/...'")}
    ${field("criterio_desempate", "Critério de desempate", item.criterio_desempate || "")}
    ${field("indicacoes_inicio", "Início das indicações", fmtDateInput(item.indicacoes_inicio), "type='datetime-local'")}
    ${field("indicacoes_fim", "Fim das indicações", fmtDateInput(item.indicacoes_fim), "type='datetime-local'")}
    ${field("votacao_inicio", "Início da votação", fmtDateInput(item.votacao_inicio), "type='datetime-local'")}
    ${field("votacao_fim", "Fim da votação", fmtDateInput(item.votacao_fim), "type='datetime-local'")}
    ${field("divulgacao_em", "Data de divulgação", fmtDateInput(item.divulgacao_em), "type='datetime-local'")}
    ${field("peso_site", "Peso do site (%)", item.peso_site ?? 50, "type='number' min='0' max='100' step='0.01' required")}
    ${field("peso_instagram", "Peso do Instagram (%)", item.peso_instagram ?? 50, "type='number' min='0' max='100' step='0.01' required")}
    ${textarea("descricao", "Descrição", item.descricao || "")}
    ${textarea("regulamento", "Regulamento", item.regulamento || "")}
    ${textarea("metodologia", "Metodologia resumida", item.metodologia || "")}
    <div class="awards-checks"><label><input name="mostrar_votos_publicamente" type="checkbox" ${item.mostrar_votos_publicamente ? "checked" : ""}> Mostrar votos publicamente após publicação</label></div>
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const pesoSite = Number(form.elements.peso_site.value || 0);
    const pesoInstagram = Number(form.elements.peso_instagram.value || 0);
    if (Math.round((pesoSite + pesoInstagram) * 100) / 100 !== 100) return toast("Os pesos do site e Instagram precisam somar 100%.", "error");
    if (!validReference(form.elements.imagem_capa_url.value)) return toast("Use URL válida ou caminho interno em imagem de capa.", "error");
    await salvarEdicao({
      id: form.elements.id.value || undefined,
      nome: form.elements.nome.value.trim(),
      ano: Number(form.elements.ano.value),
      slug: form.elements.slug.value.trim(),
      status: form.elements.status.value,
      imagem_capa_url: form.elements.imagem_capa_url.value.trim() || null,
      criterio_desempate: form.elements.criterio_desempate.value.trim() || null,
      indicacoes_inicio: toIso(form.elements.indicacoes_inicio.value),
      indicacoes_fim: toIso(form.elements.indicacoes_fim.value),
      votacao_inicio: toIso(form.elements.votacao_inicio.value),
      votacao_fim: toIso(form.elements.votacao_fim.value),
      divulgacao_em: toIso(form.elements.divulgacao_em.value),
      peso_site: pesoSite,
      peso_instagram: pesoInstagram,
      descricao: form.elements.descricao.value.trim() || null,
      regulamento: form.elements.regulamento.value.trim() || null,
      metodologia: form.elements.metodologia.value.trim() || null,
      mostrar_votos_publicamente: form.elements.mostrar_votos_publicamente.checked
    });
    toast("Edição salva.");
    state.edicoes = [];
    await loadEditions();
  });
  wireSlug($("#awards-form"));
}

async function categoryForm(id) {
  if (!state.edicoes.length) state.edicoes = await listarEdicoes();
  const item = id ? state.categorias.find(x => x.id === id) || {} : { status: "ativo", ordem: 0, max_escolhas: 1, permite_indicacao_publica: true };
  showForm(id ? "Editar categoria" : "Nova categoria", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    ${selectField("edicao_id", "Edição *", state.edicoes.map(e => `<option value="${e.id}" ${e.id === item.edicao_id ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join(""), "")}
    ${field("nome", "Nome *", item.nome || "", "required maxlength='140'")}
    ${field("slug", "Slug *", item.slug || "", "required")}
    ${selectField("status", "Status", optionList(categoryStatuses, item.status || "ativo"))}
    ${field("ordem", "Ordem", item.ordem || 0, "type='number' min='0'")}
    ${field("imagem_url", "Imagem", item.imagem_url || "", "placeholder='https://... ou /assets/...'")}
    ${field("icone", "Ícone opcional", item.icone || "")}
    ${field("limite_indicados", "Limite de indicados", item.limite_indicados || "", "type='number' min='1'")}
    ${field("max_escolhas", "Máximo de escolhas", item.max_escolhas || 1, "type='number' min='1'")}
    ${textarea("descricao", "Descrição", item.descricao || "")}
    ${textarea("criterios_especificos", "Critérios específicos", item.criterios_especificos || "")}
    ${field("regra_desempate", "Regra de desempate", item.regra_desempate || "")}
    <div class="awards-checks">
      <label><input name="permite_indicacao_publica" type="checkbox" ${item.permite_indicacao_publica !== false ? "checked" : ""}> Permitir indicação pública</label>
      <label><input name="permite_multiplos_votos" type="checkbox" ${item.permite_multiplos_votos ? "checked" : ""}> Permitir múltiplos votos</label>
      <label><input name="visibilidade_publica" type="checkbox" ${item.visibilidade_publica !== false ? "checked" : ""}> Visível publicamente</label>
    </div>
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validReference(form.elements.imagem_url.value)) return toast("Use URL válida ou caminho interno em imagem.", "error");
    await salvarCategoria({
      id: form.elements.id.value || undefined,
      edicao_id: form.elements.edicao_id.value,
      nome: form.elements.nome.value.trim(),
      slug: form.elements.slug.value.trim(),
      status: form.elements.status.value,
      ordem: Number(form.elements.ordem.value || 0),
      imagem_url: form.elements.imagem_url.value.trim() || null,
      icone: form.elements.icone.value.trim() || null,
      limite_indicados: form.elements.limite_indicados.value ? Number(form.elements.limite_indicados.value) : null,
      max_escolhas: Number(form.elements.max_escolhas.value || 1),
      descricao: form.elements.descricao.value.trim() || null,
      criterios_especificos: form.elements.criterios_especificos.value.trim() || null,
      regra_desempate: form.elements.regra_desempate.value.trim() || null,
      permite_indicacao_publica: form.elements.permite_indicacao_publica.checked,
      permite_multiplos_votos: form.elements.permite_multiplos_votos.checked,
      visibilidade_publica: form.elements.visibilidade_publica.checked
    });
    toast("Categoria salva.");
    state.categorias = [];
    await loadCategories();
  });
  wireSlug($("#awards-form"));
}

async function nomineeForm(id) {
  if (!state.edicoes.length) state.edicoes = await listarEdicoes();
  const edicaoId = state.edicoes[0]?.id || "";
  if (!state.categorias.length) state.categorias = await listarCategorias(edicaoId);
  if (!state.guia.length) state.guia = await listarGuiaComercial();
  const item = id ? state.indicados.find(x => x.id === id) || {} : { status: "rascunho", ordem: 0 };
  const categories = item.edicao_id ? await listarCategorias(item.edicao_id) : state.categorias;
  showForm(id ? "Editar indicado" : "Novo indicado", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    ${selectField("edicao_id", "Edição *", state.edicoes.map(e => `<option value="${e.id}" ${e.id === (item.edicao_id || edicaoId) ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join(""))}
    ${selectField("categoria_id", "Categoria *", categories.map(c => `<option value="${c.id}" ${c.id === item.categoria_id ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join(""))}
    ${selectField("guia_comercial_id", "Vincular ao Guia Comercial", `<option value="">Sem vínculo</option>${state.guia.map(g => `<option value="${g.id}" ${g.id === item.guia_comercial_id ? "selected" : ""}>${escapeHtml(g.nome)}</option>`).join("")}`)}
    ${field("nome", "Nome *", item.nome || "", "required maxlength='160'")}
    ${field("slug", "Slug *", item.slug || "", "required")}
    ${selectField("status", "Status", optionList(nomineeStatuses, item.status || "rascunho"))}
    ${field("ordem", "Ordem", item.ordem || 0, "type='number' min='0'")}
    ${field("imagem_url", "Imagem", item.imagem_url || "", "placeholder='https://... ou /assets/...'")}
    ${field("instagram", "Instagram", item.instagram || "")}
    ${field("whatsapp", "WhatsApp", item.whatsapp || "")}
    ${field("site", "Site", item.site || "")}
    ${field("endereco", "Endereço", item.endereco || "")}
    ${textarea("descricao_curta", "Descrição curta", item.descricao_curta || "", "maxlength='260'")}
    ${textarea("descricao_completa", "Descrição completa", item.descricao_completa || "")}
    ${textarea("motivo_reprovacao", "Motivo interno de reprovação", item.motivo_reprovacao || "")}
    ${textarea("observacao_interna", "Observação interna", item.observacao_interna || "")}
    <div class="awards-checks">
      <label><input name="aprovado" type="checkbox" ${item.aprovado ? "checked" : ""}> Aprovado para participar</label>
      <label><input name="consentimento" type="checkbox" ${item.consentimento ? "checked" : ""}> Consentimento/autorização registrado</label>
    </div>
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validReference(form.elements.imagem_url.value) || !validReference(form.elements.site.value)) return toast("Use URL válida ou caminho interno nos campos de link/imagem.", "error");
    await salvarIndicado({
      id: form.elements.id.value || undefined,
      edicao_id: form.elements.edicao_id.value,
      categoria_id: form.elements.categoria_id.value,
      guia_comercial_id: form.elements.guia_comercial_id.value || null,
      nome: form.elements.nome.value.trim(),
      slug: form.elements.slug.value.trim(),
      status: form.elements.status.value,
      ordem: Number(form.elements.ordem.value || 0),
      imagem_url: form.elements.imagem_url.value.trim() || null,
      instagram: form.elements.instagram.value.trim() || null,
      whatsapp: form.elements.whatsapp.value.trim() || null,
      site: form.elements.site.value.trim() || null,
      endereco: form.elements.endereco.value.trim() || null,
      descricao_curta: form.elements.descricao_curta.value.trim() || null,
      descricao_completa: form.elements.descricao_completa.value.trim() || null,
      motivo_reprovacao: form.elements.motivo_reprovacao.value.trim() || null,
      observacao_interna: form.elements.observacao_interna.value.trim() || null,
      aprovado: form.elements.aprovado.checked,
      consentimento: form.elements.consentimento.checked
    });
    toast("Indicado salvo.");
    state.indicados = [];
    await loadNominees();
  });
  const form = $("#awards-form");
  wireSlug(form);
  form.elements.edicao_id.addEventListener("change", async () => {
    const cats = await listarCategorias(form.elements.edicao_id.value);
    form.elements.categoria_id.innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("");
  });
  form.elements.guia_comercial_id.addEventListener("change", () => {
    const guide = state.guia.find(g => g.id === form.elements.guia_comercial_id.value);
    if (!guide) return;
    if (!form.elements.nome.value) form.elements.nome.value = guide.nome || "";
    if (!form.elements.slug.value) form.elements.slug.value = gerarSlug(guide.nome || "");
    if (!form.elements.imagem_url.value) form.elements.imagem_url.value = guide.imagem_url || "";
    if (!form.elements.whatsapp.value) form.elements.whatsapp.value = guide.whatsapp || "";
    if (!form.elements.instagram.value) form.elements.instagram.value = guide.instagram || "";
    if (!form.elements.site.value) form.elements.site.value = guide.site || "";
    if (!form.elements.endereco.value) form.elements.endereco.value = guide.endereco || "";
    if (!form.elements.descricao_curta.value) form.elements.descricao_curta.value = guide.descricao || "";
  });
}

async function instagramForm(id) {
  if (!state.edicoes.length) state.edicoes = await listarEdicoes();
  const selectedEdition = $("#instagram-edition-filter")?.value || state.edicoes[0]?.id || "";
  if (!state.categorias.length || !state.categorias.some(c => c.edicao_id === selectedEdition)) state.categorias = await listarCategorias(selectedEdition);
  if (!state.indicados.length || !state.indicados.some(i => i.edicao_id === selectedEdition)) state.indicados = await listarIndicados({ edicaoId: selectedEdition });
  const item = id ? state.instagram.find(x => x.id === id) || {} : { edicao_id: selectedEdition, votos: 0 };
  const categories = item.edicao_id ? await listarCategorias(item.edicao_id) : state.categorias;
  const nominees = item.edicao_id ? await listarIndicados({ edicaoId: item.edicao_id, categoriaId: item.categoria_id || categories[0]?.id }) : state.indicados;
  showForm(id ? "Editar votos do Instagram" : "Adicionar votos do Instagram", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    ${selectField("edicao_id", "Edição *", state.edicoes.map(e => `<option value="${e.id}" ${e.id === (item.edicao_id || selectedEdition) ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join(""))}
    ${selectField("categoria_id", "Categoria *", categories.map(c => `<option value="${c.id}" ${c.id === item.categoria_id ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join(""))}
    ${selectField("indicado_id", "Indicado *", nominees.map(n => `<option value="${n.id}" ${n.id === item.indicado_id ? "selected" : ""}>${escapeHtml(n.nome)}</option>`).join(""))}
    ${field("votos", "Votos no Instagram *", item.votos || 0, "type='number' min='0' required")}
    ${field("coletado_em", "Data da coleta", fmtDateInput(item.coletado_em), "type='datetime-local'")}
    ${field("comprovante_url", "Comprovante/print", item.comprovante_url || "", "placeholder='https://... ou /assets/...'")}
    ${textarea("observacao", "Observação", item.observacao || "")}
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validReference(form.elements.comprovante_url.value)) return toast("Use URL válida ou caminho interno no comprovante.", "error");
    await salvarInstagramVoto({
      edicao_id: form.elements.edicao_id.value,
      categoria_id: form.elements.categoria_id.value,
      indicado_id: form.elements.indicado_id.value,
      votos: Number(form.elements.votos.value || 0),
      coletado_em: toIso(form.elements.coletado_em.value),
      comprovante_url: form.elements.comprovante_url.value.trim() || null,
      observacao: form.elements.observacao.value.trim() || null
    });
    toast("Votos do Instagram salvos.");
    state.instagram = [];
    await loadInstagram();
  });
  const form = $("#awards-form");
  form.elements.edicao_id.addEventListener("change", async () => {
    const cats = await listarCategorias(form.elements.edicao_id.value);
    form.elements.categoria_id.innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("");
    const noms = await listarIndicados({ edicaoId: form.elements.edicao_id.value, categoriaId: cats[0]?.id });
    form.elements.indicado_id.innerHTML = noms.map(n => `<option value="${n.id}">${escapeHtml(n.nome)}</option>`).join("");
  });
  form.elements.categoria_id.addEventListener("change", async () => {
    const noms = await listarIndicados({ edicaoId: form.elements.edicao_id.value, categoriaId: form.elements.categoria_id.value });
    form.elements.indicado_id.innerHTML = noms.map(n => `<option value="${n.id}">${escapeHtml(n.nome)}</option>`).join("");
  });
}

async function init() {
  const access = await exigirPermissao("melhores", "acessar");
  if (!access) return;
  $("#admin-user").textContent = access.admin.nome || access.user.email;
  $("#logout").addEventListener("click", sair);
  $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  document.addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.tab) {
      if (button.dataset.tab === "dashboard") return loadDashboard();
      if (button.dataset.tab === "editions") return loadEditions();
      if (button.dataset.tab === "categories") return loadCategories();
      if (button.dataset.tab === "indications") return loadIndications();
      if (button.dataset.tab === "nominees") return loadNominees();
      if (button.dataset.tab === "instagram") return loadInstagram();
      if (button.dataset.tab === "apuration") return loadApuration();
      if (button.dataset.tab === "results") return loadResults();
    }
    if (button.id === "new-edition" || button.hasAttribute("data-new-edition")) return editionForm();
    if (button.dataset.editEdition) return editionForm(button.dataset.editEdition);
    if (button.dataset.deleteEdition && confirm("Excluir esta edição? Categorias e indicados vinculados também serão removidos.")) {
      await excluirEdicao(button.dataset.deleteEdition);
      toast("Edição excluída.");
      state.edicoes = [];
      return loadEditions();
    }
    if (button.hasAttribute("data-new-category")) return categoryForm();
    if (button.dataset.editCategory) return categoryForm(button.dataset.editCategory);
    if (button.dataset.deleteCategory && confirm("Excluir esta categoria? Indicados vinculados também serão removidos.")) {
      await excluirCategoria(button.dataset.deleteCategory);
      toast("Categoria excluída.");
      state.categorias = [];
      return loadCategories();
    }
    if (button.hasAttribute("data-new-nominee")) return nomineeForm();
    if (button.dataset.editNominee) return nomineeForm(button.dataset.editNominee);
    if (button.dataset.deleteNominee && confirm("Excluir este indicado?")) {
      await excluirIndicado(button.dataset.deleteNominee);
      toast("Indicado excluído.");
      state.indicados = [];
      return loadNominees();
    }
    if (button.hasAttribute("data-refresh-categories")) return loadCategories();
    if (button.hasAttribute("data-refresh-indications")) return loadIndications();
    if (button.dataset.convertIndication) return convertIndication(button.dataset.convertIndication);
    if (button.dataset.approveIndication) return updateIndicationStatus(button.dataset.approveIndication, "aprovada");
    if (button.dataset.rejectIndication) return updateIndicationStatus(button.dataset.rejectIndication, "rejeitada");
    if (button.dataset.duplicateIndication) return updateIndicationStatus(button.dataset.duplicateIndication, "duplicada");
    if (button.dataset.spamIndication) return updateIndicationStatus(button.dataset.spamIndication, "spam");
    if (button.dataset.deleteIndication && confirm("Excluir esta indicação?")) {
      await excluirIndicacao(button.dataset.deleteIndication);
      toast("Indicação excluída.");
      state.indicacoes = [];
      return loadIndications();
    }
    if (button.hasAttribute("data-refresh-nominees")) return loadNominees();
    if (button.hasAttribute("data-new-instagram")) return instagramForm();
    if (button.dataset.editInstagram) return instagramForm(button.dataset.editInstagram);
    if (button.dataset.deleteInstagram && confirm("Excluir este lançamento do Instagram?")) {
      await excluirInstagramVoto(button.dataset.deleteInstagram);
      toast("Lançamento excluído.");
      state.instagram = [];
      return loadInstagram();
    }
    if (button.hasAttribute("data-refresh-instagram")) return loadInstagram();
    if (button.hasAttribute("data-refresh-apuration")) return loadApuration();
    if (button.hasAttribute("data-refresh-results")) return loadResults();
    if (button.hasAttribute("data-publish-results")) {
      const edicaoId = $("#apuration-edition-filter")?.value || state.edicoes[0]?.id;
      if (!edicaoId) return toast("Selecione uma edição.", "error");
      const methodology = prompt("Descreva a metodologia resumida que ficará gravada no resultado oficial:", "Resultado calculado por percentual de votos no site e no Instagram, conforme pesos da edição.");
      if (methodology === null) return;
      if (!confirm("Publicar resultado oficial agora? Esta ação cria um snapshot histórico da edição.")) return;
      const total = await publicarResultado(edicaoId, methodology);
      toast(`${total || 0} resultado(s) publicado(s).`);
      state.resultados = [];
      return loadResults();
    }
    if (button.hasAttribute("data-cancel-form")) {
      if (state.tab === "form") return loadDashboard();
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "category-edition-filter") loadCategories();
    if (event.target.id === "indication-edition-filter" || event.target.id === "indication-status-filter") loadIndications();
    if (event.target.id === "nominee-edition-filter" || event.target.id === "nominee-category-filter") {
      if (event.target.id === "nominee-edition-filter") state.categorias = [];
      loadNominees();
    }
    if (event.target.id === "instagram-edition-filter" || event.target.id === "instagram-category-filter") {
      if (event.target.id === "instagram-edition-filter") state.categorias = [];
      loadInstagram();
    }
    if (event.target.id === "apuration-edition-filter") loadApuration();
    if (event.target.id === "results-edition-filter") loadResults();
  });

  await loadDashboard();
}

init();
