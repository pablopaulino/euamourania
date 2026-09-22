const assert = require('node:assert/strict');
const handler = require('../api/noticia.js');
const originalFetch = global.fetch;
const slug = '1-festival-gastronomico-e-de-musica-urania';
const main = 'https://example.com/main.jpg';
const logo = 'https://example.com/logo.png';

async function render() {
  let html;
  const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, send(body) { html = body; } };
  await handler({ query: { slug } }, res);
  assert.equal(res.statusCode, 200);
  return html;
}
function tags(html, key) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]).filter(tag => tag.includes(`="${key}"`));
}
function verify(html, image) {
  for (const key of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:image:alt', 'twitter:image']) {
    assert.equal(tags(html, key).length, 1, `${key}: exactly one tag in initial HTML`);
  }
  assert.ok(tags(html, 'og:type')[0].includes('content="article"'));
  for (const key of ['og:image', 'twitter:image']) assert.ok(tags(html, key)[0].includes(`content="${image}"`));
  assert.ok(image.startsWith('https://'));
}
(async () => {
  let image = main;
  global.fetch = async url => new Response(JSON.stringify(String(url).includes('/noticias?')
    ? [{ slug, titulo: 'Notícia de teste', resumo: 'Resumo específico', publicado_em: '2026-01-01', imagem_url: image, seo_imagem: logo }]
    : [{ chave: 'seo_logo', valor: logo }]), { status: 200 });
  verify(await render(), main);
  image = '';
  verify(await render(), logo);
  image = 'http://example.com/main.jpg';
  verify(await render(), main);
  global.fetch = originalFetch;
  console.log('Metadados SSR: foto principal, fallback, HTTPS e ausência de duplicatas aprovados.');
  if (process.argv.includes('--live')) {
    const html = await render();
    const image = tags(html, 'og:image')[0].match(/content="([^"]+)"/)[1];
    verify(html, image);
    const response = await fetch(image, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^image\//);
    console.log('Imagem pública:', response.status, response.headers.get('content-type'), image);
    console.log(html.match(/<meta[^>]+(?:og:|twitter:)[^>]*>/g).join('\n'));
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
