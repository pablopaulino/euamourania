import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("turismo-container");
const status = document.getElementById("turismo-status");
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeImage = value => /^https?:\/\//i.test(value || "") || /^assets\//.test(value || "") ? escapeHtml(value) : "assets/Design sem nome (9).png";

async function carregarTurismo() {
  if (!publicSupabaseConfigured()) { status.textContent = "Configure o Supabase para carregar os pontos turísticos."; return; }
  try {
    const itens = await fetchPublicRows("turismo", {
      select: "id,nome,slug,descricao,imagem_url,endereco,horario,destaque",
      status: "eq.publicado",
      order: "destaque.desc,nome.asc"
    });
    if (!itens.length) { status.textContent = "Nenhum ponto turístico publicado."; return; }
    status.hidden = true;
    container.innerHTML = itens.map(item => {
      const url = `turismo-details.html?slug=${encodeURIComponent(item.slug)}`;
      return `<article class="card-guia" data-tourism-id="${item.id}">
        ${item.destaque ? '<span class="badge-destaque">Destaque</span>' : ""}
        <img src="${safeImage(item.imagem_url)}" class="card-img-top" alt="${escapeHtml(item.nome)}" loading="lazy">
        <div class="card-body"><h2 class="card-title"><a href="${url}">${escapeHtml(item.nome)}</a></h2><p class="card-text">${escapeHtml(item.descricao)}</p><p class="card-address">${escapeHtml(item.endereco)}${item.horario ? `<br>${escapeHtml(item.horario)}` : ""}</p><a href="${url}" class="read-more">Conhecer este lugar →</a></div>
      </article>`;
    }).join("");
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar os pontos turísticos.";
  }
}
carregarTurismo();
