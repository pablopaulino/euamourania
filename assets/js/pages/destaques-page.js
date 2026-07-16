import { fetchPublicRows } from "../services/publicDataService.js";

const esc = (v = "") => String(v ?? "").replace(/[&<>'"]/g, (c) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
})[c]);

const newsUrl = (slug) => `/noticias/${encodeURIComponent(slug)}`;
const safeImage = (value = "") => {
  if (!value) return "";
  try {
    return new URL(value, location.origin).href;
  } catch {
    return "";
  }
};
const text = (item = {}, size = 150) => {
  const raw = item.resumo || String(item.conteudo_html || "").replace(/<[^>]+>/g, " ");
  const clean = raw.replace(/\s+/g, " ").trim();
  return clean.length > size ? `${clean.slice(0, size).trim()}…` : clean;
};
const date = (value) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
  } catch {
    return "";
  }
};

function leadCard(item) {
  const image = safeImage(item.imagem_url);
  return `<article class="home-news-lead">
    <a class="home-news-lead-media" href="${newsUrl(item.slug)}" aria-label="${esc(item.titulo)}">
      ${image ? `<img src="${esc(image)}" alt="${esc(item.titulo)}" loading="lazy" decoding="async">` : '<span>Eu Amo Urânia</span>'}
    </a>
    <div class="home-news-lead-copy">
      <span class="home-news-label">Manchete local</span>
      <p class="eyebrow">${esc(item.categoria_nome || "Notícias")}</p>
      <h3><a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a></h3>
      ${text(item, 210) ? `<p>${esc(text(item, 210))}</p>` : ""}
      <a class="home-news-action" href="${newsUrl(item.slug)}">Ler notícia completa <span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function latestCard(item) {
  const image = safeImage(item.imagem_url);
  return `<a class="home-news-latest-card" href="${newsUrl(item.slug)}">
    ${image ? `<img src="${esc(image)}" alt="${esc(item.titulo)}" loading="lazy" decoding="async">` : '<span class="home-news-placeholder">Eu Amo Urânia</span>'}
    <div>
      <small>${esc(item.categoria_nome || "Urânia")} · ${esc(date(item.publicado_em))}</small>
      <strong>${esc(item.titulo)}</strong>
    </div>
  </a>`;
}

function popularItem(item, index) {
  return `<a class="home-popular-item" href="${newsUrl(item.slug)}">
    <span>${index + 1}</span>
    <div>
      <strong>${esc(item.titulo)}</strong>
      <small>${Number(item.visualizacoes || 0).toLocaleString("pt-BR")} leitura${Number(item.visualizacoes || 0) === 1 ? "" : "s"}</small>
    </div>
  </a>`;
}

function addStyle() {
  if (document.getElementById("home-editorial-style")) return;
  const style = document.createElement("style");
  style.id = "home-editorial-style";
  style.textContent = `
    .home-editorial{padding:clamp(3.2rem,6.5vw,5.6rem) 0;background:linear-gradient(180deg,#fff,#f7f9f9)}
    .home-editorial-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1.2rem;margin-bottom:1.25rem}
    .home-editorial-head h2{margin:.2rem 0;color:var(--navy);font-size:clamp(2rem,4.2vw,3.2rem)}
    .home-editorial-head p:not(.eyebrow){max-width:560px;margin:0;color:var(--muted);line-height:1.65}
    .home-editorial-link{color:var(--blue);font-weight:850;text-decoration:none}
    .home-editorial-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(290px,.75fr);gap:1.15rem;align-items:start}
    .home-news-lead,.home-news-side{overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:26px;box-shadow:0 16px 42px rgba(7,59,76,.08)}
    .home-news-lead{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(300px,.98fr);min-height:430px}
    .home-news-lead-media{display:grid;overflow:hidden;place-items:center;color:var(--blue);background:var(--pale);font-weight:850;text-decoration:none}
    .home-news-lead-media img{width:100%;height:100%;object-fit:cover;transition:transform .3s ease}
    .home-news-lead:hover img{transform:scale(1.03)}
    .home-news-lead-copy{display:flex;flex-direction:column;padding:clamp(1.35rem,3vw,2.25rem)}
    .home-news-label{align-self:flex-start;margin-bottom:.9rem;padding:.38rem .68rem;color:var(--navy);background:var(--yellow);border-radius:999px;font-size:.68rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
    .home-news-lead h3{margin:.1rem 0 .75rem;font-size:clamp(1.65rem,3.2vw,2.45rem);line-height:1.08}
    .home-news-lead h3 a{text-decoration:none}
    .home-news-lead-copy>p:not(.eyebrow){color:#526872;line-height:1.65}
    .home-news-action{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:auto;padding-top:1rem;color:var(--blue);border-top:1px solid var(--line);font-weight:850;text-decoration:none}
    .home-news-side{display:grid;gap:1rem;padding:1rem}
    .home-news-side h3{margin:.1rem 0 .45rem;font-size:1.3rem}
    .home-news-latest{display:grid;gap:.75rem}
    .home-news-latest-card{display:grid;grid-template-columns:92px minmax(0,1fr);gap:.8rem;align-items:center;padding:.55rem;color:inherit;background:#f8fbfb;border:1px solid #e3edef;border-radius:16px;text-decoration:none;transition:.18s ease}
    .home-news-latest-card:hover,.home-popular-item:hover{background:#eef7f9;transform:translateY(-2px)}
    .home-news-latest-card img,.home-news-placeholder{width:92px;height:76px;object-fit:cover;border-radius:12px;background:linear-gradient(135deg,var(--pale),#fff4cf)}
    .home-news-placeholder{display:grid;place-items:center;color:var(--blue);font-size:.62rem;font-weight:850;text-align:center}
    .home-news-latest-card small{display:block;margin-bottom:.2rem;color:var(--blue);font-size:.68rem;font-weight:850;text-transform:uppercase}
    .home-news-latest-card strong{display:-webkit-box;overflow:hidden;color:var(--navy);font-size:.95rem;line-height:1.22;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .home-popular{padding-top:.9rem;border-top:1px solid var(--line)}
    .home-popular-list{display:grid;gap:.55rem}
    .home-popular-item{display:grid;grid-template-columns:34px minmax(0,1fr);gap:.75rem;align-items:start;padding:.55rem;color:inherit;border-radius:14px;text-decoration:none;transition:.18s ease}
    .home-popular-item>span{display:grid;width:30px;height:30px;place-items:center;color:var(--navy);background:var(--yellow);border-radius:50%;font-size:.82rem;font-weight:900}
    .home-popular-item strong{display:block;color:var(--navy);font-size:.92rem;line-height:1.24}
    .home-popular-item small{color:var(--muted);font-size:.72rem}
    @media(max-width:980px){.home-editorial-grid,.home-news-lead{grid-template-columns:1fr}.home-news-lead{min-height:0}.home-news-lead-media{aspect-ratio:16/9}.home-news-side{grid-template-columns:1fr 1fr}.home-popular{padding-top:0;border-top:0}}
    @media(max-width:700px){.home-editorial{padding:2.7rem 0}.home-editorial-head{display:grid}.home-editorial-head h2{font-size:2rem}.home-editorial-link{justify-self:start}.home-news-lead,.home-news-side{border-radius:20px}.home-news-lead-media{aspect-ratio:16/10}.home-news-lead-copy{padding:1.15rem}.home-news-lead h3{font-size:1.55rem}.home-news-side{grid-template-columns:1fr;padding:.75rem}.home-news-latest-card{grid-template-columns:82px minmax(0,1fr)}.home-news-latest-card img,.home-news-placeholder{width:82px;height:70px}.home-popular{padding-top:.8rem;border-top:1px solid var(--line)}}
  `;
  document.head.append(style);
}

function render(news = []) {
  const target = document.querySelector(".quick-access");
  if (!target || document.querySelector(".home-editorial") || !news.length) return;

  const lead = news.find((item) => item.destaque) || news[0];
  const latest = news.filter((item) => item.id !== lead.id).slice(0, 4);
  const popular = [...news]
    .filter((item) => Number(item.visualizacoes || 0) > 0)
    .sort((a, b) => Number(b.visualizacoes || 0) - Number(a.visualizacoes || 0))
    .slice(0, 5);
  const popularList = popular.length ? popular : news.filter((item) => item.id !== lead.id).slice(0, 5);

  target.insertAdjacentHTML("afterend", `<section class="home-editorial" aria-labelledby="home-editorial-title">
    <div class="container">
      <div class="home-editorial-head">
        <div>
          <p class="eyebrow">Notícias de Urânia</p>
          <h2 id="home-editorial-title">O que está acontecendo agora</h2>
          <p>Um resumo visual para acompanhar as principais informações da cidade sem perder tempo.</p>
        </div>
        <a class="home-editorial-link" href="/news/">Ver todas as notícias →</a>
      </div>
      <div class="home-editorial-grid">
        ${leadCard(lead)}
        <aside class="home-news-side" aria-label="Últimas e mais lidas">
          <div>
            <h3>Últimas notícias</h3>
            <div class="home-news-latest">${latest.map(latestCard).join("")}</div>
          </div>
          <div class="home-popular">
            <h3>Mais lidas</h3>
            <div class="home-popular-list">${popularList.map(popularItem).join("")}</div>
          </div>
        </aside>
      </div>
    </div>
  </section>`);
}

async function init() {
  const home = location.pathname === "/" || location.pathname === "/index.html";
  if (!home) return;
  addStyle();
  const now = new Date().toISOString();
  const news = await fetchPublicRows("noticias", {
    select: "id,titulo,slug,resumo,conteudo_html,imagem_url,categoria_nome,publicado_em,destaque,visualizacoes",
    status: "eq.publicado",
    publicado_em: `lte.${now}`,
    order: "publicado_em.desc",
    limit: "12",
  }, { ttl: 120000 }).catch(() => []);
  render(news || []);
}

init();
