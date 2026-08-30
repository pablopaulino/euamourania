import { getSupabase } from "../services/supabaseClient.js";
import { definirMeta } from "../utils.js";

const params = new URLSearchParams(location.search);
const pathSlug = location.pathname.split("/").filter(Boolean).pop()?.replace(/\.html$/, "");
const slug = params.get("slug") || pathSlug;
const root = document.querySelector("#iniciativa-detalhe");
const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[char]));

function hrefFor(entry) {
  if (!entry.valor_publico) return "";
  if (entry.tipo === "telefone") return `tel:${String(entry.valor_publico).replace(/\D/g, "")}`;
  if (entry.tipo === "whatsapp") return `https://wa.me/${String(entry.valor_publico).replace(/\D/g, "")}`;
  return entry.valor_publico;
}

function renderHelp(help) {
  if (!help.length) return "";
  return `
    <section>
      <h2>Como ajudar</h2>
      <div class="initiative-help-list">
        ${help.map(entry => `
          <article class="initiative-help-card">
            <h3>${esc(entry.titulo)}</h3>
            ${entry.descricao ? `<p>${esc(entry.descricao)}</p>` : ""}
            ${entry.tipo === "pix"
              ? `<p><strong>Recebedor: ${esc(entry.recebedor_nome || "")}</strong></p><button type="button" data-pix="${esc(entry.valor_publico || "")}">Copiar chave Pix</button>`
              : entry.valor_publico ? `<a href="${esc(hrefFor(entry))}" target="_blank" rel="noopener">Acessar</a>` : ""}
          </article>
        `).join("")}
      </div>
      <p><small>O Eu Amo Urânia apenas divulga esta iniciativa e não processa transferências. Confira os dados antes de pagar.</small></p>
    </section>
  `;
}

async function init() {
  if (!root) return;
  try {
    const { data: item, error } = await getSupabase()
      .from("iniciativas_comunitarias")
      .select("*")
      .eq("slug", slug)
      .eq("status", "publicado")
      .maybeSingle();
    if (error) throw error;
    if (!item) throw new Error("not-found");

    const { data: help = [] } = await getSupabase()
      .from("iniciativas_formas_ajuda")
      .select("*")
      .eq("iniciativa_id", item.id)
      .eq("ativo", true)
      .order("ordem");

    definirMeta({
      titulo: `${item.titulo} | Eu Amo Urânia`,
      descricao: item.resumo || "Iniciativa da comunidade de Urânia.",
      imagem: item.imagem_capa_url,
      url: location.href
    });

    const image = item.imagem_capa_url || "/assets/compartilhamento-logo.png";
    root.className = "";
    root.innerHTML = `
      <section class="initiative-detail-hero">
        <div class="container">
          <a class="initiative-back-link" href="/iniciativas/">← Iniciativas da Comunidade</a>
          <div class="initiative-detail-grid">
            <div class="initiative-detail-copy">
              <span class="initiative-detail-type">${item.tipo === "projeto" ? "Projeto permanente" : "Ação da comunidade"}</span>
              <h1>${esc(item.titulo)}</h1>
              <p>${esc(item.resumo || "Iniciativa divulgada pelo Eu Amo Urânia para aproximar a comunidade.")}</p>
            </div>
            <figure class="initiative-detail-image">
              <img src="${esc(image)}" alt="${esc(item.titulo)}" width="960" height="540" decoding="async" fetchpriority="high">
            </figure>
          </div>
        </div>
      </section>
      <section class="container initiative-detail-content">
        <article class="initiative-detail-section">
          <p class="eyebrow">História e propósito</p>
          <h2>Sobre esta iniciativa</h2>
          <p>${esc(item.descricao || item.resumo || "Mais informações serão atualizadas em breve.")}</p>
        </article>
        <aside class="initiative-detail-aside">
          ${renderHelp(help)}
        </aside>
      </section>
    `;
    root.addEventListener("click", async event => {
      const button = event.target.closest("[data-pix]");
      if (!button) return;
      await navigator.clipboard.writeText(button.dataset.pix);
      button.textContent = "Chave Pix copiada";
    });
  } catch {
    root.innerHTML = '<a class="initiative-back-link" href="/iniciativas/">← Iniciativas</a><h1>Iniciativa não encontrada</h1>';
  }
}

init();
