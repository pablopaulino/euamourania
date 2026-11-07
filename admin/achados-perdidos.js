import { temPermissao } from "./auth.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date = value => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parsed);
};
let root, db, access, items = [], mounted = false, busy = false, run = 0, errorMessage = "";

function photo(item) {
  const path = item.imagem_url;
  if (!path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(path) || !path.startsWith(`${item.id}/`)) return "";
  const url = db.storage.from("achados-perdidos").getPublicUrl(path).data.publicUrl;
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(url)}" alt="Foto do anúncio ${esc(item.titulo)}" loading="lazy" class="lost-photo"></a>`;
}
function render() {
  if (!mounted) return;
  const canModerate = temPermissao(access.admin, "achados_perdidos", "moderar");
  root.innerHTML = `<section class="lost-shell"><header class="lost-header"><div><h2>Anúncios pendentes</h2><p>Confira os dados e a foto antes de decidir. A aprovação publica o anúncio no app.</p></div><button class="admin-button secondary" type="button" data-refresh ${busy ? "disabled" : ""}>Atualizar</button></header>
  ${errorMessage ? `<p class="lost-message" role="alert">${esc(errorMessage)}</p>` : ""}
  <div class="lost-list">${busy && !items.length ? '<p class="lost-empty" role="status">Carregando anúncios…</p>' : ""}${items.map(item => `<article class="lost-card">
    ${photo(item)}<div class="lost-body"><span class="lost-badge">${item.tipo === "perdido" ? "Perdido" : "Encontrado"} · ${esc(item.categoria)}</span><h3>${esc(item.titulo)}</h3><p class="lost-description">${esc(item.descricao || "Sem descrição")}</p><dl><div><dt>Local</dt><dd>${esc(item.local)}</dd></div><div><dt>Contato</dt><dd>${esc(item.contato_nome || "Não informado")}</dd></div><div><dt>WhatsApp</dt><dd>${esc(item.whatsapp)}</dd></div><div><dt>Ocorrência</dt><dd>${esc(date(item.ocorrido_em))}</dd></div><div><dt>Enviado</dt><dd>${esc(date(item.criado_em))}</dd></div></dl>
    ${canModerate ? `<div class="lost-actions"><button class="admin-button" type="button" data-action="aprovar" data-id="${esc(item.id)}" ${busy ? "disabled" : ""}>Aprovar</button><button class="admin-button secondary" type="button" data-action="rejeitar" data-id="${esc(item.id)}" ${busy ? "disabled" : ""}>Rejeitar</button></div>` : ""}</div></article>`).join("") || (!busy && !errorMessage ? '<p class="lost-empty">Nenhum anúncio pendente.</p>' : "")}</div></section>`;
}
async function load() {
  const request = ++run;
  busy = true; errorMessage = ""; render();
  const { data, error } = await db.rpc("admin_listar_achados_pendentes");
  if (!mounted || request !== run) return;
  busy = false;
  if (error) { items = []; errorMessage = "Não foi possível carregar os anúncios. Verifique a sessão e as migrações do Supabase."; }
  else items = data || [];
  render();
}
async function onClick(event) {
  if (event.target.closest("[data-refresh]")) { if (!busy) await load(); return; }
  const button = event.target.closest("button[data-action]");
  if (!button || busy || !temPermissao(access.admin, "achados_perdidos", "moderar")) return;
  const item = items.find(row => row.id === button.dataset.id);
  if (!item) return;
  const action = button.dataset.action;
  if (!['aprovar', 'rejeitar'].includes(action)) return;
  if (!window.confirm(action === 'aprovar'
    ? `Aprovar “${item.titulo}” e publicar no aplicativo?`
    : `Rejeitar “${item.titulo}”? O anúncio não será publicado.`)) return;
  busy = true; errorMessage = ""; render();
  const request = run;
  const { data, error } = await db.rpc("admin_moderar_achado", { p_id: item.id, p_acao: action, p_atualizado_em: item.atualizado_em });
  if (!mounted || request !== run) return;
  busy = false;
  if (error) { errorMessage = "Não foi possível moderar o anúncio. Verifique suas permissões e tente novamente."; render(); return; }
  if (!data) { await load(); if (mounted) { errorMessage = "O anúncio foi alterado ou já moderado. A lista foi atualizada; confira os dados antes de decidir."; render(); } return; }
  await load();
}
export async function mount(container, context) {
  access = context.access; db = context.db;
  if (!access?.admin || !temPermissao(access.admin, "achados_perdidos", "acessar") || !temPermissao(access.admin, "achados_perdidos", "ler")) throw new Error("Sem permissão para acessar Achados e Perdidos.");
  root = container; mounted = true; items = []; errorMessage = "";
  const style = document.createElement("link"); style.rel = "stylesheet"; style.href = "/admin/achados-perdidos.css"; style.dataset.lostStyle = "true"; document.head.append(style);
  root.addEventListener("click", onClick);
  await load();
}
export function unmount() {
  mounted = false; run++; root?.removeEventListener("click", onClick); document.querySelector('link[data-lost-style="true"]')?.remove(); root = null; db = null; access = null; items = [];
}
