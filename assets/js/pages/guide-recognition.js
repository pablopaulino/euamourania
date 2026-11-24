import { resultsPageUrl } from "../services/melhoresPublicService.js";
import { currentGuideRecognitions } from "../services/guideRecognition.js";

const trophy = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0zM7 5H3v2a4 4 0 0 0 5 4m9-6h4v2a4 4 0 0 1-5 4M12 13v5m-4 3h8m-7 0 1-3h4l1 3"/></svg>';
const seals = { 2026: "/assets/melhores/selo-vencedor-2026.png" };

export function awardLink(award, profile, winnerUrl) {
  const category = award.categories.join(" · ");
  const description = `${category} no Melhores de Urânia ${award.year}`;
  const link = document.createElement("a");
  link.href = winnerUrl || resultsPageUrl({ ano: award.year });
  link.setAttribute("aria-label", `${description}. ${winnerUrl ? "Ver perfil do vencedor." : "Ver resultados da edição."}`);
  if (profile) {
    link.className = "guide-recognition";
    link.innerHTML = '<span class="guide-seal"></span><span class="guide-recognition-copy"><small>Reconhecimento oficial</small><strong></strong></span><span aria-hidden="true">→</span>';
    const seal = link.querySelector(".guide-seal");
    if (seals[award.year]) {
      const image = new Image(48, 48);
      image.src = seals[award.year];
      image.alt = "";
      seal.append(image);
    } else {
      seal.innerHTML = trophy;
    }
    link.querySelector("strong").textContent = description;
  } else {
    link.className = "guide-award-pill";
    link.innerHTML = trophy + "<span></span>";
    link.lastElementChild.textContent = category;
    link.title = description;
  }
  return link;
}

function fitRow(row) {
  if (!row.clientWidth) return;
  delete row.dataset.fit;
  if (row.scrollWidth <= row.clientWidth) return;
  row.dataset.fit = "pills";
  if (row.scrollWidth > row.clientWidth) row.dataset.fit = "icon";
}

export function watchGuideRecognitions(root) {
  if (!root) return;
  let awards = new Map();
  let loading = false;
  const observer = new ResizeObserver(entries => entries.forEach(({ target }) => fitRow(target)));
  function render() {
    observer.disconnect();
    for (const card of root.querySelectorAll("[data-guide-id]")) {
      const award = awards.get(card.dataset.guideId);
      const row = card.querySelector(".guide-award-meta");
      const heading = card.querySelector(".business-intro h1");
      if (!row && !heading) continue;
      const key = award ? JSON.stringify(award) : "";
      if (key !== (card.dataset.recognition || "")) {
        card.dataset.recognition = key;
        card.querySelector(".guide-recognition, .guide-award-pill")?.remove();
        row?.querySelector(".guide-hours-pill")?.remove();
        if (award && row) {
          if (row.dataset.hours) {
            const hours = document.createElement("span");
            hours.className = "guide-hours-pill";
            hours.textContent = row.dataset.hours;
            row.append(hours);
          }
          row.append(awardLink(award, false));
        } else if (award && heading) {
          heading.after(awardLink(award, true));
        }
        if (row) {
          row.classList.toggle("has-award", Boolean(award));
          delete row.dataset.fit;
        }
      }
      if (award && row) {
        fitRow(row);
        observer.observe(row);
      }
    }
  }
  async function refresh() {
    if (loading || document.hidden) return;
    loading = true;
    try {
      awards = await currentGuideRecognitions();
      render();
    } catch (error) {
      console.warn("Reconhecimentos do Guia indisponíveis.", error.message);
    } finally {
      loading = false;
    }
  }
  document.addEventListener("guia:renderizado", render);
  document.addEventListener("visibilitychange", refresh);
  document.fonts?.ready.then(render);
  window.setInterval(refresh, 60000);
  refresh();
}
