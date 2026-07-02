import { callPublicRpc } from "../services/publicDataService.js";

const interests = [
  ["noticias", "Notícias"], ["eventos", "Eventos"], ["turismo", "Turismo"],
  ["comercio", "Comércio"], ["promocoes", "Promoções"], ["esportes", "Esportes"],
  ["politica", "Política"], ["tudo", "Tudo"]
];

function init() {
  const footer = document.querySelector(".site-footer");
  if (!footer || document.querySelector(".newsletter-signup")) return;
  footer.insertAdjacentHTML("beforebegin", `<section class="newsletter-signup" aria-labelledby="newsletter-title"><div class="container newsletter-box"><div><p class="eyebrow">Fique por dentro</p><h2 id="newsletter-title">Receba as novidades de Urânia no seu e-mail</h2><p>Notícias, eventos e histórias da cidade, direto e sem excesso.</p></div><form id="newsletter-form"><div class="newsletter-fields"><input name="nome" autocomplete="name" placeholder="Seu nome (opcional)"><input name="email" type="email" autocomplete="email" placeholder="Seu melhor e-mail" required><button class="button button-primary">Quero receber</button></div><details><summary>Escolher interesses</summary><div class="newsletter-interests">${interests.map(([value, label]) => `<label><input type="checkbox" name="interesses" value="${value}" ${value === "tudo" ? "checked" : ""}> ${label}</label>`).join("")}</div></details><p class="newsletter-message" aria-live="polite"></p></form></div></section>`);
  if (!document.getElementById("newsletter-style")) {
    const style = document.createElement("style");
    style.id = "newsletter-style";
    style.textContent = '.newsletter-signup{padding:2.5rem 0;background:#eef5f6}.newsletter-box{display:grid;grid-template-columns:.9fr 1.1fr;gap:2rem;align-items:center}.newsletter-box h2{margin:.2rem 0 .55rem;font-size:clamp(1.5rem,3vw,2.15rem)}.newsletter-box p{margin:0;color:var(--muted)}.newsletter-fields{display:grid;grid-template-columns:1fr 1.25fr auto;gap:.65rem}.newsletter-fields input{min-width:0;padding:.85rem 1rem;border:1px solid #bdd0d7;border-radius:999px;font:inherit}.newsletter-fields button{white-space:nowrap;border:0}.newsletter-signup details{margin-top:.7rem}.newsletter-signup summary{color:var(--blue);font-size:.8rem;cursor:pointer}.newsletter-interests{display:flex;flex-wrap:wrap;gap:.5rem 1rem;margin-top:.7rem;font-size:.78rem}.newsletter-message{min-height:1.3em;margin-top:.6rem!important;font-size:.82rem}@media(max-width:800px){.newsletter-box{grid-template-columns:1fr;gap:1.2rem}.newsletter-fields{grid-template-columns:1fr}.newsletter-fields button{width:100%}}';
    document.head.append(style);
  }
  const form = document.getElementById("newsletter-form");
  const message = form.querySelector(".newsletter-message");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector("button");
    const data = new FormData(form);
    const selected = data.getAll("interesses");
    button.disabled = true;
    button.textContent = "Cadastrando…";
    message.textContent = "";
    try {
      const result = await callPublicRpc("assinar_newsletter", {
        p_email: data.get("email"),
        p_nome: data.get("nome") || null,
        p_cidade: null,
        p_origem: "site",
        p_interesses: selected.length ? selected : ["tudo"]
      }, { timeout: 8000 });
      message.textContent = result?.mensagem || "Cadastro realizado!";
      message.style.color = "#16845b";
      form.reset();
    } catch (error) {
      message.textContent = error.message;
      message.style.color = "#b93838";
    } finally {
      button.disabled = false;
      button.textContent = "Quero receber";
    }
  });
}

init();
