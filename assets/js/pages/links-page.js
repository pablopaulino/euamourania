import { listarLinks } from "../services/linksService.js";
import { supabaseConfigurado } from "../services/supabaseClient.js";

const container = document.getElementById("links-list");
const status = document.getElementById("links-status");
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeUrl = value => /^https?:\/\//i.test(value || "") ? escapeHtml(value) : "#";

async function carregarLinks() {
  if (!supabaseConfigurado()) { status.textContent = "Configure o Supabase para carregar os links."; return; }
  status.textContent = "Carregando canais…";
  try {
    const links = await listarLinks();
    if (!links.length) { status.textContent = "Nenhum link publicado."; return; }
    status.hidden = true;
    container.innerHTML = links.map(link => `<a href="${safeUrl(link.url)}" class="link-button" data-link-id="${link.id}" target="_blank" rel="noopener noreferrer"><span>${link.icone ? `${escapeHtml(link.icone)} ` : ""}${escapeHtml(link.titulo)}</span><span aria-hidden="true">↗</span></a>`).join("");
  } catch (error) { console.error(error); status.textContent = "Não foi possível carregar os links."; }
}
carregarLinks();
