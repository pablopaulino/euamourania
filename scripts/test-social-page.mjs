import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const handler = require('../lib/social-page.js');
const originalFetch = globalThis.fetch;

globalThis.fetch = async url => {
  const address = new URL(url);
  const table = address.pathname.split('/').at(-1);
  const data = {
    melhores_edicoes: [{ id: 'award-id', nome: 'Melhores de Urânia 2026', ano: 2026, descricao: 'Edição oficial', imagem_capa_url: 'https://example.com/award.jpg' }],
    melhores_categorias: [{ nome: 'Melhor Academia', descricao: 'Categoria oficial', imagem_url: 'https://example.com/category.jpg' }],
    eventos: [{ titulo: 'Feira Livre Noturna', descricao: 'Evento na cidade', imagem_url: 'https://example.com/event.jpg' }],
    eventos_principais: [{ id: 'event-id', nome: 'Festa do Peão', descricao_curta: 'Tradição local', imagem_capa_url: 'https://example.com/main.jpg' }],
    eventos_edicoes: [{ titulo: 'Festa do Peão 2026', subtitulo: 'Edição 2026', banner_url: 'https://example.com/edition.jpg' }]
  };
  return { ok: true, json: async () => data[table] || [] };
};

async function render(query) {
  let status;
  let html;
  await handler({ query }, {
    setHeader() {},
    status(code) { status = code; return { send(value) { html = value; } }; }
  });
  assert.equal(status, 200);
  const tag = name => [...html.matchAll(new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)">`, 'g'))].map(match => match[1]);
  assert.equal(tag('og:image').length, 1, 'og:image duplicada');
  assert.equal(tag('twitter:image')[0], tag('og:image')[0]);
  assert.equal(tag('og:url').length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1, 'canonical duplicada');
  assert.match(html, /id="awards-preview-app"|id="event-detail-root"|id="evento-detalhes"|id="conteudo"/);
  return { html, tag };
}

try {
  const award = await render({ mode: 'award-edition', ano: '2026' });
  assert.equal(award.tag('og:image')[0], 'https://example.com/award.jpg');
  assert.equal(award.tag('og:url')[0], 'https://euamourania.com.br/melhores-de-urania/2026/');
  const category = await render({ mode: 'award-category', ano: '2026', slug: 'melhor-academia' });
  assert.equal(category.tag('og:image')[0], 'https://example.com/category.jpg');
  const event = await render({ mode: 'event-detail', slug: 'feira-livre-noturna' });
  assert.equal(event.tag('og:image')[0], 'https://example.com/event.jpg');
  const edition = await render({ mode: 'event-edition', slug: 'festa-do-peao-de-urania', ano: '2026' });
  assert.equal(edition.tag('og:image')[0], 'https://example.com/edition.jpg');
  const staticPages = [
    'index.html', 'news/index.html', 'guia.html', 'turismo.html', 'eventos/index.html',
    'urania/index.html', 'iniciativas/index.html', 'links/index.html',
    'melhores-de-urania/index.html', 'melhores-de-urania/edicao.html',
    'app.html', 'app/parceiros.html', 'app/seja-parceiro.html',
    'divulgue.html', 'colabore/index.html', 'quem-somos.html', 'buscar.html',
    'cadastrar-evento.html', 'cadastrar-empresa.html', 'descadastrar.html',
    'termos-de-servico.html', 'politica-de-privacidade.html',
    'news/sobre-publicacoes/index.html', 'news/politica-editorial/index.html',
    'news/correcoes-transparencia-contato/index.html', 'categorias/index.html'
  ];
  for (const file of staticPages) {
    const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.equal((html.match(/property="og:image"/g) || []).length, 1, `${file}: og:image ausente ou duplicada`);
    assert.equal((html.match(/name="twitter:image"/g) || []).length, 1, `${file}: twitter:image ausente ou duplicada`);
    assert.match(html, /<meta property="og:image" content="https:\/\//, `${file}: og:image não usa HTTPS público`);
  }
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const route of ['/melhores-de-urania/:ano/', '/eventos/agenda/:slug', '/eventos/:slug/:ano']) {
    assert.ok(vercel.rewrites.some(item => item.source === route && item.destination.startsWith('/api/noticia?tipo=social&')),
      `${route}: metadados server-side não ligados à URL pública`);
  }
  console.log('Metadados sociais server-side validados para prêmio e eventos.');
} finally {
  globalThis.fetch = originalFetch;
}
