// Filter, sort and paginate the same row set without fetching it again.
export function bindResourceTable(panel) {
  const tbody = panel.querySelector("tbody");
  if (!tbody) return;
  const rows = [...tbody.rows];
  const search = panel.querySelector("#resource-search");
  const status = panel.querySelector("#resource-status");
  const empty = panel.querySelector("[data-filter-empty]");
  const count = panel.querySelector("#resource-count");
  const pager = document.createElement("div");
  pager.className = "admin-pagination";
  pager.innerHTML = '<button type="button" class="admin-button secondary">Anterior</button><span aria-live="polite"></span><button type="button" class="admin-button secondary">Próxima</button>';
  panel.append(pager);
  const [previous, next] = pager.querySelectorAll("button");
  const collator = new Intl.Collator("pt-BR", {numeric:true, sensitivity:"base"});
  let page = 0;
  function render() {
    const term = search.value.trim().toLocaleLowerCase("pt-BR");
    const matches = rows.filter(row => row.dataset.search.includes(term) && (!status.value || row.dataset.status === status.value));
    const pages = Math.max(1, Math.ceil(matches.length / 25));
    page = Math.min(page, pages - 1);
    const visible = new Set(matches.slice(page * 25, (page + 1) * 25));
    for (const row of rows) row.hidden = !visible.has(row);
    previous.disabled = page === 0;
    next.disabled = page >= pages - 1;
    pager.hidden = pages === 1;
    empty.hidden = matches.length !== 0;
    count.textContent = matches.length + " de " + rows.length + " registro(s)";
    pager.querySelector("span").textContent = "Página " + (page + 1) + " de " + pages;
  }
  panel.querySelectorAll("th").forEach((th, index, headers) => {
    if (index === headers.length - 1) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = th.textContent;
    th.replaceChildren(button);
    button.addEventListener("click", () => {
      const asc = th.getAttribute("aria-sort") !== "ascending";
      headers.forEach(header => header.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", asc ? "ascending" : "descending");
      rows.sort((a,b) => {
        const key = row => row.cells[index].dataset.sort || row.cells[index].textContent.trim();
        return (asc ? 1 : -1) * collator.compare(key(a), key(b));
      });
      for (const row of rows) tbody.append(row);
      page = 0;
      render();
    });
  });
  previous.addEventListener("click", () => { page--; render(); });
  next.addEventListener("click", () => { page++; render(); });
  for (const control of [search,status]) control.addEventListener("input", () => { page = 0; render(); });
  render();
}
