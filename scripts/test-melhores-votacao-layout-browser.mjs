import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from '../outputs/catalogos-tools/node_modules/playwright/index.mjs';
const nav=Array.from({length:21},(_,i)=>`<button type="button" data-scroll-category="${i}"><span>${i===2?'Melhor Atendimento':`Categoria ${i+1}`}</span><small>4 indicados</small></button>`).join('');
const svg=encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180"><rect width="400" height="180" fill="#e6efe7"/><text x="200" y="100" text-anchor="middle" fill="#155035" font-size="32">MARCA COMPLETA</text></svg>');
const cards=Array.from({length:4},(_,i)=>`<article class="awards-nominee-card"><img src="data:image/svg+xml,${svg}" alt="Marca ${i+1}"><div class="awards-card-body"><h3>Indicado ${i+1}</h3><button disabled class="button button-primary awards-vote-button">Votação fechada</button></div></article>`).join('');
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/melhores-public.css"></head><body class="awards-preview-page"><main><section class="awards-section"><div class="award-shell"><h2>Votação</h2><div id="vote-area"><article class="awards-edition-vote-callout"><div><h3>Conheça os indicados</h3><p>Confira as categorias e indicados publicados.</p></div><div class="awards-edition-vote-stats"><span><strong>21</strong><small>categorias</small></span><span><strong>78</strong><small>indicados</small></span><span><strong>0</strong><small>votadas neste aparelho</small></span></div></article><aside class="awards-category-nav">${nav}</aside><div class="awards-nominees"><section class="awards-nominee-group" id="categoria-2"><header><h3>Melhor Atendimento</h3><p>Escolha seu indicado favorito.</p></header><div class="awards-nominee-grid">${cards}</div></section></div></div></div></section></main></body></html>`;
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html)}const body=await readFile('.'+path);res.writeHead(200,{'Content-Type':'text/css'});res.end(body)}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const state = await page.evaluate(() => {
      const box = el => el.getBoundingClientRect().toJSON();
      const nav = document.querySelector(".awards-category-nav");
      const grid = document.querySelector(".awards-nominee-grid");
      const cards = [...grid.querySelectorAll("article")];
      const image = cards[0].querySelector("img");
      return {
        nav: box(nav), group: box(document.querySelector(".awards-nominee-group")),
        cards: cards.map(box), image: box(image), fit: getComputedStyle(image).objectFit,
        overflow: document.documentElement.scrollWidth - innerWidth,
        gridScrollable: grid.scrollWidth > grid.clientWidth,
        navScrollableX: nav.scrollWidth > nav.clientWidth,
        navScrollableY: nav.scrollHeight > nav.clientHeight
      };
    });
    const mobile = width === 375;
    assert.ok(mobile ? state.nav.bottom <= state.group.top + 1 : state.nav.right <= state.group.left + 1,
      `posição da navegação de categorias em ${width}px`);
    if (width > 768) assert.ok(state.cards.every(card => Math.abs(card.top - state.cards[0].top) < 1), "indicados na mesma linha");
    assert.ok(Math.abs(state.image.width - state.image.height) < 1, "moldura quadrada");
    assert.equal(state.fit, "contain", "logo completo dentro da moldura");
    assert.ok(state.overflow <= 1, "sem rolagem horizontal na página");
    assert.ok(mobile ? state.navScrollableX : state.navScrollableY, "categorias com rolagem própria");
    if (mobile) {
      assert.equal(state.gridScrollable, false, "todos os indicados cabem na largura disponível");
      assert.ok(state.cards.at(-1).top > state.cards[0].top, "indicados distribuídos em linhas");
    }
  }
  console.log("Layout: categorias responsivas, molduras neutras e rolagem validada em computador, tablet e celular.");
} finally {
  await browser.close();
  server.close();
}
