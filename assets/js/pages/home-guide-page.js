import { fetchPublicRows } from "../services/publicDataService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
})[char]);

const guideUrl = slug => `/guia/${encodeURIComponent(slug)}`;

const safeImage = value => {
  if (!value) return "";
  try {
    return new URL(value, location.origin).href;
  } catch {
    return "";
  }
};

const shortText = (value = "", size = 92) => {
  const clean = String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > size ? `${clean.slice(0, size).trim()}…` : clean;
};

function addStyle() {
  if (document.getElementById("home-guide-style")) return;
  const style = document.createElement("style");
  style.id = "home-guide-style";
  style.textContent = `
    .home-guide{padding:clamp(2.8rem,6vw,5rem) 0;background:linear-gradient(180deg,#f7f9f9 0%,#fff 100%)}
    .home-guide-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1.25rem;margin-bottom:1.25rem}
    .home-guide-head h2{margin:.18rem 0;color:var(--navy);font-size:clamp(2rem,4.2vw,3.15rem);line-height:1;letter-spacing:-.055em}
    .home-guide-head p:not(.eyebrow){max-width:600px;margin:0;color:#536b75;line-height:1.62}
    .home-guide-link{color:var(--blue);font-weight:900;text-decoration:none}
    .home-guide-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}
    .home-guide-card{display:grid;grid-template-columns:96px minmax(0,1fr);gap:.9rem;align-items:center;min-height:132px;padding:.78rem;color:inherit;background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:0 14px 36px rgba(7,59,76,.07);text-decoration:none;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .home-guide-card:hover{transform:translateY(-3px);border-color:rgba(11,79,108,.2);box-shadow:0 18px 44px rgba(7,59,76,.1)}
    .home-guide-media{display:grid;width:96px;height:96px;place-items:center;overflow:hidden;color:var(--blue);background:linear-gradient(135deg,#eef8fa,#fff4cf);border-radius:18px;font-size:.7rem;font-weight:900;text-align:center}
    .home-guide-media img{width:100%;height:100%;object-fit:cover}
    .home-guide-card small{display:block;margin-bottom:.28rem;color:var(--blue);font-size:.68rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
    .home-guide-card h3{display:-webkit-box;overflow:hidden;margin:0 0 .35rem;color:var(--navy);font-size:1.05rem;line-height:1.15;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .home-guide-card p{display:-webkit-box;overflow:hidden;margin:0;color:#607781;font-size:.88rem;line-height:1.4;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .home-guide-bottom{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1rem;align-items:center;margin-top:1.1rem;padding:1rem 1.1rem;border:1px solid rgba(220,232,236,.95);border-radius:24px;background:#fff;box-shadow:0 14px 36px rgba(7,59,76,.06)}
    .home-guide-bottom h3{margin:0 0 .25rem;color:var(--navy);font-size:1.25rem;letter-spacing:-.03em}
    .home-guide-bottom p{margin:0;color:#536b75;line-height:1.5}
    .home-guide-bottom .button{border:0;text-decoration:none;white-space:nowrap}
    @media(max-width:1040px){.home-guide-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:720px){.home-guide{padding:2.25rem 0}.home-guide-head{display:grid;margin-bottom:1rem}.home-guide-head h2{font-size:1.9rem}.home-guide-link{justify-self:start}.home-guide-grid{grid-template-columns:1fr;gap:.75rem}.home-guide-card{grid-template-columns:78px minmax(0,1fr);min-height:104px;border-radius:18px}.home-guide-media{width:78px;height:78px;border-radius:14px}.home-guide-card h3{font-size:1rem}.home-guide-card p{font-size:.82rem;-webkit-line-clamp:1}.home-guide-bottom{grid-template-columns:1fr;padding:.95rem;border-radius:20px}.home-guide-bottom .button{width:100%;justify-content:center}}
  `;
  document.head.append(style);
}

function card(item) {
  const image = safeImage(item.imagem_url);
  return `<a class="home-guide-card" href="${guideUrl(item.slug)}">
    <span class="home-guide-media">${image ? `<img src="${esc(image)}" alt="${esc(item.nome)}" loading="lazy" decoding="async">` : "Eu Amo Urânia"}</span>
    <span>
      <small>${esc(item.categoria_nome || "Guia")}</small>
      <h3>${esc(item.nome)}</h3>
      ${item.descricao ? `<p>${esc(shortText(item.descricao))}</p>` : ""}
    </span>
  </a>`;
}

function findAnchor() {
  return document.querySelector(".home-editorial") || document.querySelector(".quick-access");
}

async function waitForAnchor() {
  const existing = findAnchor();
  if (existing?.classList.contains("home-editorial")) return existing;
  await new Promise(resolve => setTimeout(resolve, 650));
  return findAnchor();
}

function render(items = []) {
  const anchor = findAnchor();
  if (!anchor || document.querySelector(".home-guide")) return;
  const visible = items.slice(0, 6);
  if (!visible.length) return;
  anchor.insertAdjacentHTML("afterend", `<section class="home-guide" aria-labelledby="home-guide-title">
    <div class="container">
      <div class="home-guide-head">
        <div>
          <p class="eyebrow">Guia da cidade</p>
          <h2 id="home-guide-title">Empresas e serviços de Urânia</h2>
          <p>Conheça comércios, profissionais e lugares cadastrados no Guia do Eu Amo Urânia.</p>
        </div>
        <a class="home-guide-link" href="/guia.html">Ver guia completo →</a>
      </div>
      <div class="home-guide-grid">${visible.map(card).join("")}</div>
      <div class="home-guide-bottom">
        <div>
          <h3>Tem uma pauta, foto ou história da cidade?</h3>
          <p>Cadastre-se como colaborador voluntário e envie informações quando tiver algo relevante para compartilhar.</p>
        </div>
        <a class="button button-secondary" href="/colabore/">Quero colaborar</a>
      </div>
    </div>
  </section>`);
}

async function init() {
  const home = location.pathname === "/" || location.pathname === "/index.html";
  if (!home) return;
  addStyle();
  await waitForAnchor();
  const items = await fetchPublicRows("guia_comercial", {
    select: "id,nome,slug,categoria_nome,descricao,imagem_url,recomendado",
    status: "eq.publicado",
    order: "recomendado.desc,nome.asc",
    limit: "6"
  }, { ttl: 180000 }).catch(error => {
    console.warn("Guia na home:", error);
    return [];
  });
  render(items || []);
}

init();
