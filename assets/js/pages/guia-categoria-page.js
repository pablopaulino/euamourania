const normalize = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const form = document.querySelector(".guide-category-search");
const input = document.getElementById("guide-category-search");
const cards = [...document.querySelectorAll(".guide-category-card")];
const empty = document.getElementById("guide-category-empty");

function applyFilter() {
  const term = normalize(input?.value);
  let visible = 0;
  cards.forEach(card => {
    const match = !term || normalize(card.textContent).includes(term);
    card.hidden = !match;
    if (match) visible += 1;
  });
  if (empty) empty.hidden = visible > 0;
}

form?.addEventListener("submit", event => event.preventDefault());
input?.addEventListener("input", applyFilter);
document.dispatchEvent(new CustomEvent("guia:renderizado"));
