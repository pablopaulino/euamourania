export async function mount(container, { db }) {
  const panel = document.createElement("section");
  panel.className = "admin-panel";
  panel.innerHTML = '<p role="status"></p><table class="admin-table"><thead><tr><th>Data</th><th>Cadastro</th><th>Campos</th></tr></thead><tbody></tbody></table>';
  container.replaceChildren(panel);
  const id = new URLSearchParams(location.search).get("guia_id");
  let query = db.from("parceiro_alteracoes_log").select("guia_id,campos_alterados,criado_em").order("criado_em", {ascending:false}).limit(100);
  if (id) query = query.eq("guia_id", id);
  const {data, error} = await query;
  if (error) throw error;
  if (!data.length) panel.querySelector("p").textContent = "Nenhuma alteração registrada.";
  for (const row of data) {
    const tr = panel.querySelector("tbody").insertRow();
    for (const value of [new Date(row.criado_em).toLocaleString("pt-BR"), row.guia_id, row.campos_alterados.join(", ")]) tr.insertCell().textContent = value;
  }
}
export function unmount(container) { container?.replaceChildren(); }
