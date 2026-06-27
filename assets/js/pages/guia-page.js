import { listarGuia } from "../services/guiaService.js";
import { supabaseConfigurado } from "../services/supabaseClient.js";

const container = document.getElementById("guia-container");
const status = document.getElementById("guia-status");
let itens = [];

function renderizar(dados) {
  if (!dados.length) { container.innerHTML = ""; status.hidden = false; status.textContent = "Nenhum item cadastrado no guia."; return; }
  status.hidden = true;
  container.innerHTML = dados.map(item => `<article class="card-guia">
    ${item.recomendado ? '<span class="badge-destaque">Recomendado</span>' : ''}
    <img src="${item.imagem_url || 'assets/Design sem nome (9).png'}" class="card-img-top" alt="${item.nome}" loading="lazy">
    <div class="card-body"><h2 class="card-title">${item.nome}</h2><p class="card-text">${item.descricao || ''}</p><p class="card-address">${item.endereco || ''}${item.horario ? `<br>${item.horario}` : ''}</p>${item.whatsapp ? `<a href="https://wa.me/${item.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener" class="btn-whatsapp">Chamar no WhatsApp</a>` : ''}</div>
  </article>`).join("");
}

window.filtrarGuia = (categoria, botao) => {
  document.querySelectorAll(".btn-filtro").forEach(item => item.classList.remove("ativo"));
  botao.classList.add("ativo");
  renderizar(categoria === "todos" ? itens : itens.filter(item => item.categoria_nome === categoria));
};

async function carregar() {
  if (!supabaseConfigurado()) { status.textContent = "Configure o Supabase para carregar o guia."; return; }
  status.textContent = "Carregando guia…";
  try { itens = await listarGuia(); renderizar(itens); }
  catch (error) { console.error(error); status.textContent = "Não foi possível carregar o guia."; }
}
carregar();
