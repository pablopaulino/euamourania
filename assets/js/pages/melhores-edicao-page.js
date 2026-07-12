import { obterEdicaoPorAno, listarCategoriasPublicas, listarIndicadosPublicos, enviarVotoMelhores, enviarIndicacaoMelhores } from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const key = editionId => `euamourania:melhores:votos:${editionId}`;
function getYear() {
  const match = location.pathname.match(/melhores-de-urania\/(\d{4})/);
  const query = new URLSearchParams(location.search).get("ano");
  return Number(match?.[1] || query || new Date().getFullYear());
}

function readVotes(editionId) {
  try { return JSON.parse(localStorage.getItem(key(editionId)) || "{}"); } catch { return {}; }
}

function votesFor(votes, categoryId) {
  const value = votes[categoryId];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function saveVote(editionId, categoryId, nomineeId) {
  const votes = readVotes(editionId);
  const current = votesFor(votes, categoryId);
  if (!current.includes(nomineeId)) current.push(nomineeId);
  votes[categoryId] = current;
  localStorage.setItem(key(editionId), JSON.stringify(votes));
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "A confirmar";
}

function isVotingOpen(edition) {
  const now = Date.now();
  return edition?.status === "votacao_aberta"
    && (!edition.votacao_inicio || new Date(edition.votacao_inicio).getTime() <= now)
    && (!edition.votacao_fim || new Date(edition.votacao_fim).getTime() >= now);
}

function isIndicationOpen(edition) {
  const now = Date.now();
  return edition?.status === "indicacoes_abertas"
    && (!edition.indicacoes_inicio || new Date(edition.indicacoes_inicio).getTime() <= now)
    && (!edition.indicacoes_fim || new Date(edition.indicacoes_fim).getTime() >= now);
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "awards-toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 4200);
}

function setMeta(edition) {
  const title = `${edition.nome} | Melhores de Urânia`;
  const description = (edition.descricao || "Participe da votação popular do Eu Amo Urânia.").slice(0, 155);
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  const canonical = `${location.origin}/melhores-de-urania/${edition.ano}/`;
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", new URL(edition.imagem_capa_url || "/assets/AD3A1763-min%20(1).jpg", location.origin).href);
}

function renderHero(edition, open) {
  const copy = document.getElementById("edition-copy");
  const panel = document.getElementById("edition-panel");
  if (copy) {
    copy.innerHTML = `<span class="awards-public-badge">Uma realização Eu Amo Urânia</span>
      <h1>${esc(edition.nome)}</h1>
      <p>${esc(edition.descricao || "Escolha seus favoritos nas categorias da premiação.")}</p>
      <div class="hero-actions"><a class="button button-primary" href="#vote-area" data-awards-edition-cta data-edition-id="${edition.id}">${open ? "Votar agora" : "Ver indicados"}</a><a class="button button-secondary" href="/melhores-de-urania/${edition.ano}/regulamento/" data-awards-edition-cta data-edition-id="${edition.id}">Regulamento</a><a class="button button-secondary" href="/melhores-de-urania/${edition.ano}/metodologia/" data-awards-edition-cta data-edition-id="${edition.id}">Metodologia</a></div>`;
  }
  if (panel) {
    const cover = image(edition.imagem_capa_url);
    panel.innerHTML = `${cover ? `<img src="${cover}" alt="${esc(edition.nome)}">` : ""}
      <h2>Status da edição</h2>
      <div class="awards-status-line">
        <span class="awards-chip ${open ? "open" : "closed"}">${esc(edition.status.replaceAll("_", " "))}</span>
        <span class="awards-chip">Votação: ${esc(formatDate(edition.votacao_inicio))}</span>
      </div>
      <p><strong>Encerramento:</strong> ${esc(formatDate(edition.votacao_fim || edition.encerramento_em))}</p>
      <p><strong>Pesos:</strong> Site ${Number(edition.peso_site || 0)}% · Instagram ${Number(edition.peso_instagram || 0)}%</p>`;
  }
}

function enrichHeroStats(edition, categories, nominees) {
  const panel = document.getElementById("edition-panel");
  if (!panel) return;
  const stats = document.createElement("div");
  stats.className = "awards-mini-stats";
  stats.innerHTML = `
    <span><strong>${esc(edition.ano)}</strong><small>Edição</small></span>
    <span><strong>${categories.length}</strong><small>Categorias</small></span>
    <span><strong>${nominees.length}</strong><small>Indicados</small></span>
  `;
  panel.append(stats);
}

function nomineeCard(edition, category, nominee, open, votedId) {
  const votedList = Array.isArray(votedId) ? votedId : (votedId ? [votedId] : []);
  const voted = votedList.includes(nominee.id);
  const maxChoices = category.permite_multiplos_votos ? Math.max(1, Number(category.max_escolhas || 1)) : 1;
  const reachedLimit = votedList.length >= maxChoices;
  const img = image(nominee.imagem_url);
  return `<article class="awards-nominee-card ${voted ? "awards-voted" : ""}">
    ${img ? `<img src="${img}" alt="${esc(nominee.nome)}" loading="lazy">` : ""}
    <div class="awards-card-body">
      <h3>${esc(nominee.nome)}</h3>
      <button class="button button-primary awards-vote-button" data-vote data-edition="${edition.id}" data-category="${category.id}" data-nominee="${nominee.id}" data-max-choices="${maxChoices}" data-multiple="${category.permite_multiplos_votos ? "true" : "false"}" ${open && !voted && !reachedLimit ? "" : "disabled"}>
        ${voted ? "Voto registrado" : open ? "Votar" : "Votação fechada"}
      </button>
    </div>
  </article>`;
}

function renderVoting(edition, categories, nominees) {
  const area = document.getElementById("vote-area");
  const open = isVotingOpen(edition);
  const votes = readVotes(edition.id);
  document.getElementById("vote-status-copy").textContent = open
    ? "Escolha um indicado por categoria. O sistema registra seu voto com validação segura."
    : "A votação não está aberta agora. Você pode conferir as categorias e indicados publicados.";
  if (!categories.length) {
    area.innerHTML = '<div class="awards-empty">Nenhuma categoria pública nesta edição.</div>';
    return;
  }
  const grouped = new Map(categories.map(category => [category.id, nominees.filter(n => n.categoria_id === category.id)]));
  area.innerHTML = `<aside class="awards-category-nav" aria-label="Categorias">${categories.map((category, index) => {
    const total = grouped.get(category.id)?.length || 0;
    return `<button type="button" data-scroll-category="${category.id}" class="${index === 0 ? "active" : ""}"><span>${esc(category.nome)}</span><small>${total} indicado${total === 1 ? "" : "s"}</small></button>`;
  }).join("")}</aside>
    <div class="awards-nominees">
      ${categories.map(category => {
        const items = grouped.get(category.id) || [];
        return `<section class="awards-nominee-group" id="categoria-${category.id}">
          <header><h3><a class="awards-link" href="/melhores-de-urania/${edition.ano}/categorias/${encodeURIComponent(category.slug)}/">${esc(category.nome)}</a></h3><p>${esc(category.descricao || "Escolha seu indicado favorito.")}</p></header>
          ${items.length ? `<div class="awards-nominee-grid">${items.map(nominee => nomineeCard(edition, category, nominee, open, votesFor(votes, category.id))).join("")}</div>` : '<div class="awards-empty">Nenhum indicado publicado nesta categoria.</div>'}
        </section>`;
      }).join("")}
    </div>`;
}

function renderIndications(edition, categories) {
  const area = document.getElementById("indication-area");
  const copy = document.getElementById("indication-status-copy");
  if (!area) return;
  const open = isIndicationOpen(edition);
  const allowed = categories.filter(category => category.permite_indicacao_publica !== false);
  if (copy) {
    copy.textContent = open
      ? "Envie uma indicação com nome, categoria e justificativa. A equipe analisa antes de virar indicado oficial."
      : "As indicações públicas não estão abertas agora. Acompanhe as datas da edição.";
  }
  if (!open) {
    area.innerHTML = `<div class="awards-alert"><strong>Indicações fechadas.</strong><br>Período: ${esc(formatDate(edition.indicacoes_inicio))} até ${esc(formatDate(edition.indicacoes_fim))}.</div>`;
    return;
  }
  if (!allowed.length) {
    area.innerHTML = '<div class="awards-empty">Nenhuma categoria está recebendo indicações públicas nesta edição.</div>';
    return;
  }
  area.innerHTML = `<form class="awards-indication-form" id="awards-indication-form" data-edition-id="${edition.id}">
    <div>
      <label for="indication-category">Categoria *</label>
      <select id="indication-category" name="categoria_id" required>
        ${allowed.map(category => `<option value="${category.id}">${esc(category.nome)}</option>`).join("")}
      </select>
    </div>
    <div>
      <label for="indication-name">Nome indicado *</label>
      <input id="indication-name" name="nome_indicado" type="text" maxlength="160" placeholder="Nome da empresa, pessoa ou projeto" required>
    </div>
    <div>
      <label for="indication-contact">Contato do indicado</label>
      <input id="indication-contact" name="contato_indicado" type="text" maxlength="160" placeholder="WhatsApp, Instagram ou e-mail">
    </div>
    <div>
      <label for="responsible-name">Seu nome *</label>
      <input id="responsible-name" name="nome_responsavel" type="text" maxlength="160" required>
    </div>
    <div>
      <label for="responsible-contact">Seu contato *</label>
      <input id="responsible-contact" name="contato_responsavel" type="text" maxlength="160" placeholder="WhatsApp ou e-mail" required>
    </div>
    <div class="full">
      <label for="indication-reason">Por que merece participar? *</label>
      <textarea id="indication-reason" name="justificativa" rows="4" maxlength="1200" required></textarea>
    </div>
    <label class="full awards-consent"><input name="aceite_regulamento" type="checkbox" required> Confirmo que li o regulamento da edição e autorizo a análise desta indicação.</label>
    <div class="full awards-form-actions"><button class="button button-primary" type="submit">Enviar indicação</button></div>
  </form>`;
}

async function init() {
  try {
    const year = getYear();
    const edition = await obterEdicaoPorAno(year);
    if (!edition) {
      document.getElementById("vote-area").innerHTML = '<div class="awards-empty">Edição não encontrada ou ainda não publicada.</div>';
      return;
    }
    const open = isVotingOpen(edition);
    registrarEventoMelhores("melhores_edition_view", {
      edicaoId: edition.id,
      metadados: { ano: edition.ano, status: edition.status, votacao_aberta: open }
    });
    setMeta(edition);
    renderHero(edition, open);
    const [categories, nominees] = await Promise.all([
      listarCategoriasPublicas(edition.id),
      listarIndicadosPublicos(edition.id)
    ]);
    enrichHeroStats(edition, categories, nominees);
    renderVoting(edition, categories, nominees);
    renderIndications(edition, categories);
  } catch (error) {
    console.error("Melhores de Urânia:", error);
    document.getElementById("vote-area").innerHTML = '<div class="awards-empty">Não foi possível carregar esta edição agora.</div>';
  }
}

document.addEventListener("click", async event => {
  const scroll = event.target.closest("[data-scroll-category]");
  if (scroll) {
    document.querySelectorAll("[data-scroll-category]").forEach(button => button.classList.toggle("active", button === scroll));
    document.getElementById(`categoria-${scroll.dataset.scrollCategory}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const vote = event.target.closest("[data-vote]");
  if (!vote || vote.disabled) return;
  vote.disabled = true;
  vote.textContent = "Registrando…";
  registrarEventoMelhores("melhores_vote_start", {
    edicaoId: vote.dataset.edition,
    metadados: { categoria_id: vote.dataset.category, indicado_id: vote.dataset.nominee }
  });
  try {
    await enviarVotoMelhores({
      edicao_id: vote.dataset.edition,
      categoria_id: vote.dataset.category,
      indicado_id: vote.dataset.nominee,
      origem: "site",
      pagina: location.pathname
    });
    saveVote(vote.dataset.edition, vote.dataset.category, vote.dataset.nominee);
    const storedVotes = votesFor(readVotes(vote.dataset.edition), vote.dataset.category);
    const reachedLimit = storedVotes.length >= Number(vote.dataset.maxChoices || 1);
    document.querySelectorAll(`[data-category="${vote.dataset.category}"]`).forEach(button => {
      const isAlreadyVoted = storedVotes.includes(button.dataset.nominee);
      button.disabled = isAlreadyVoted || reachedLimit;
      button.textContent = button === vote ? "Voto registrado" : "Voto já registrado";
      button.closest(".awards-nominee-card")?.classList.toggle("awards-voted", button === vote);
    });
    document.querySelectorAll(`[data-category="${vote.dataset.category}"]`).forEach(button => {
      const isAlreadyVoted = storedVotes.includes(button.dataset.nominee);
      button.disabled = isAlreadyVoted || reachedLimit;
      button.textContent = isAlreadyVoted ? "Voto registrado" : reachedLimit ? "Limite atingido" : "Votar";
      button.closest(".awards-nominee-card")?.classList.toggle("awards-voted", isAlreadyVoted);
    });
    registrarEventoMelhores("melhores_vote_complete", {
      edicaoId: vote.dataset.edition,
      metadados: { categoria_id: vote.dataset.category, indicado_id: vote.dataset.nominee }
    });
    toast("Voto registrado com sucesso. Obrigado por participar!");
  } catch (error) {
    vote.disabled = false;
    vote.textContent = "Votar";
    registrarEventoMelhores("melhores_vote_error", {
      edicaoId: vote.dataset.edition,
      metadados: { categoria_id: vote.dataset.category, indicado_id: vote.dataset.nominee, erro: error.message }
    });
    toast(error.message);
  }
});

document.addEventListener("submit", async event => {
  const form = event.target.closest("#awards-indication-form");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Enviando…";
  const edicaoId = form.dataset.editionId;
  registrarEventoMelhores("melhores_indication_start", {
    edicaoId,
    metadados: { categoria_id: form.elements.categoria_id.value }
  });
  try {
    const data = await enviarIndicacaoMelhores({
      edicao_id: edicaoId,
      categoria_id: form.elements.categoria_id.value,
      nome_indicado: form.elements.nome_indicado.value,
      justificativa: form.elements.justificativa.value,
      contato_indicado: form.elements.contato_indicado.value,
      nome_responsavel: form.elements.nome_responsavel.value,
      contato_responsavel: form.elements.contato_responsavel.value,
      aceite_regulamento: form.elements.aceite_regulamento.checked,
      pagina: location.pathname
    });
    registrarEventoMelhores("melhores_indication_complete", {
      edicaoId,
      metadados: { categoria_id: form.elements.categoria_id.value, indicacao_id: data.indicacao_id }
    });
    form.reset();
    toast(data.message || "Indicação enviada com sucesso.");
  } catch (error) {
    registrarEventoMelhores("melhores_indication_error", {
      edicaoId,
      metadados: { categoria_id: form.elements.categoria_id.value, erro: error.message }
    });
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Enviar indicação";
  }
});

document.addEventListener("click", event => {
  const cta = event.target.closest("[data-awards-edition-cta]");
  if (!cta) return;
  registrarEventoMelhores("melhores_cta_click", {
    edicaoId: cta.dataset.editionId || null,
    destino: cta.href,
    metadados: { origem_cta: "hero_edicao" }
  });
});

init();
