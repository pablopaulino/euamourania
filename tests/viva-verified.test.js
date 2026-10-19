const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { verifiedBadge, verifiedName } = require('../lib/viva-verified.js');
const { guideCard } = require('../lib/guide-tourism-list-ssr.js');
const { renderGuide } = require('../lib/site-2026-detail-ssr.js');

test('only the boolean true grants the badge; browser and SSR agree', async () => {
  const browser = await import('data:text/javascript;base64,' + Buffer.from(readFileSync('assets/js/viva-verified.js')).toString('base64'));
  for (const value of [false, undefined, null, 'true', 1, true]) {
    assert.equal(browser.verifiedBadge(value), verifiedBadge(value));
    assert.equal(verifiedBadge(value).includes('viva-verified.svg'), value === true);
  }
  assert.match(verifiedBadge(true), /tabindex="0"/);
  assert.match(verifiedBadge(true), /aria-label="Empresa Verificada · Parceiro Oficial Viva Urânia"/);
  for (const name of ['Empresa de Urânia', 'Urânia']) {
    assert.equal(browser.verifiedName(name, true), verifiedName(name, true));
    assert.match(verifiedName(name, true), /<span class="viva-verified-keep">\S+<span class="viva-verified"/);
    assert.equal(verifiedName(name, false), name);
  }
});

test('published cards and detail titles show verification independently of editorial recommendation', () => {
  for (const render of [guideCard, renderGuide]) {
    const base = { id:'fixture', slug:'fixture', nome:'Empresa <teste>', recomendado:true };
    assert.equal(render(base).includes('viva-verified.svg'), false);
    const html = render({ ...base, recomendado:false, verificado:true });
    assert.equal(html.includes('viva-verified.svg'), true);
    assert.ok(html.includes('Empresa &lt;teste&gt;'));
    assert.match(html, /<span class="viva-verified-keep">&lt;teste&gt;<span class="viva-verified"/);
    assert.equal(render({ ...base, verificado:false }).includes('viva-verified.svg'), false);
  }
});
