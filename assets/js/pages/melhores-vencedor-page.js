import { obterEdicaoPorAno, listarHistoricoVencedoresPublicos, listarResultadosPublicos } from "../services/melhoresPublicService.js";
import { categoryName, esc, formatDate, hallUrl, nomineeData, resultsArePublished, resultsPageUrl, winnerKey, winnerProfileUrl } from "./melhores-resultados-page.js";

function target() {
  const match = location.pathname.match(/melhores-de-urania\/(\d{4})\/vencedores\/([^/]+)/);
  const params = new URLSearchParams(location.search);
  return {
    year: Number(match?.[1] || params.get("ano")),
    id: match?.[2] || params.get("id") || ""
  };
}

function setMeta(edition, row) {
  const { name, description, img } = nomineeData(row);
  const title = `${name} — vencedor ${edition.ano} | Melhores de Urânia`;
  const summary = `${name} venceu ${categoryName(row)} no Melhores de Urânia ${edition.ano}. ${description}`.slice(0, 155);
  const imageUrl = new URL(img || edition.imagem_capa_url || "/assets/compartilhamento-logo.png", location.origin).href;
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", summary);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", summary);
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", imageUrl);
  document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", imageUrl);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", `${location.origin}/melhores-de-urania/${edition.ano}/vencedores/${encodeURIComponent(row.indicado_id)}/`);
}

async function init() {
  const copy = document.getElementById("winner-copy");
  const panel = document.getElementById("winner-panel");
  const content = document.getElementById("winner-content");
  if (!copy || !panel || !content) return;
  const { year, id } = target();
  if (!year || !id) {
    content.innerHTML = '<div class="awards-empty">Vencedor não encontrado.</div>';
    return;
  }

  try {
    const edition = await obterEdicaoPorAno(year);
    if (!edition) {
      content.innerHTML = '<div class="awards-empty">Edição não encontrada.</div>';
      return;
    }
    const results = await listarResultadosPublicos(edition.id);
    const winner = resultsArePublished(edition, results)
      ? results.find(row => row.vencedor && row.indicado_id === id)
      : null;
    if (!winner) {
      copy.innerHTML = `<span class="awards-public-badge">Melhores de Urânia ${esc(String(year))}</span><h1>Vencedor ainda não disponível</h1><p>Este perfil será exibido somente após a divulgação oficial do resultado.</p>`;
      panel.innerHTML = `<h2>Edição ${esc(String(year))}</h2><p>Acompanhe a premiação e suas etapas na página oficial da edição.</p><a href="/melhores-de-urania/${year}/">Ver edição →</a>`;
      content.innerHTML = '<div class="awards-empty">Nenhum perfil de vencedor publicado neste endereço.</div>';
      return;
    }

    const data = nomineeData(winner);
    const initial = esc(data.name.trim().charAt(0).toLocaleUpperCase("pt-BR") || "U");
    setMeta(edition, winner);
    copy.innerHTML = `<span class="awards-public-badge">Vencedor ${esc(String(year))}</span><h1>${esc(data.name)}</h1><p>${esc(categoryName(winner))} · Melhores de Urânia ${esc(String(year))}</p><div class="hero-actions"><a class="button button-secondary" href="${resultsPageUrl(edition)}">Ver resultado da edição</a></div>`;
    panel.innerHTML = `<h2>Reconhecimento oficial</h2><p>Um registro permanente da conquista nesta edição da premiação.</p><div class="awards-status-line"><span class="awards-chip">${esc(categoryName(winner))}</span>${winner.publicado_em ? `<span class="awards-chip">Publicado em ${esc(formatDate(winner.publicado_em))}</span>` : ""}</div>`;

    let otherWins = [];
    const key = winnerKey(winner);
    if (key) {
      const history = await listarHistoricoVencedoresPublicos().catch(error => {
        console.warn("Histórico do vencedor indisponível:", error);
        return [];
      });
      otherWins = history.filter(row => winnerKey(row) === key && row.indicado_id !== id && Number(row.melhores_edicoes?.ano) !== year);
    }

    content.addEventListener("error", event => {
      if (event.target.matches?.(".awards-winner-photo img")) event.target.remove();
    }, true);
    content.innerHTML = `<article class="awards-winner-profile">
      <div class="awards-winner-photo"><span class="awards-winner-initial" aria-hidden="true">${initial}</span>${data.img ? `<img src="${data.img}" alt="${esc(data.name)}" loading="eager" decoding="async" width="640" height="640">` : ""}</div>
      <div class="awards-winner-profile-body">
        <p class="eyebrow">Vencedor da edição ${esc(String(year))}</p>
        <h2>${esc(data.name)}</h2>
        <p>${esc(data.description)}</p>
        <div class="awards-winner-profile-links">
          ${data.guideUrl ? `<a class="button button-primary" href="${esc(data.guideUrl)}">Ver no Guia Comercial</a>` : ""}
          <a class="button button-secondary" href="${hallUrl()}">Hall dos vencedores</a>
        </div>
      </div>
    </article>
    ${otherWins.length ? `<section class="awards-winner-other"><h2>Outras conquistas</h2><ul>${otherWins.map(row => `<li><a href="${winnerProfileUrl({ ano: Number(row.melhores_edicoes.ano) }, row)}">${esc(categoryName(row))} · ${esc(String(row.melhores_edicoes.ano))} →</a></li>`).join("")}</ul></section>` : ""}`;
  } catch (error) {
    console.error("Perfil do vencedor:", error);
    content.innerHTML = '<div class="awards-empty">Não foi possível carregar este perfil agora.</div>';
  }
}

init();
