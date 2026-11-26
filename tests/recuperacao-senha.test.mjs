import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const script = read('assets/js/redefinir-senha.js').replace(/^import .*?;\r?\n/, '');

function openLink(hash, responses = []) {
  let submit;
  const calls = [];
  const button = {};
  const elements = {
    '#recovery': {
      hidden: true, reset() {}, querySelector: () => button,
      addEventListener: (_, callback) => { submit = callback; },
    },
    '#password': { value: 'senha-de-teste' },
    '#confirmation': { value: 'senha-de-teste', focus() {} },
    '#instructions': {}, '#feedback': {},
  };
  const location = { hash, pathname: '/app/redefinir-senha' };
  vm.runInNewContext(script, {
    document: { querySelector: selector => elements[selector] },
    history: { replaceState: (_, __, path) => { assert.equal(path, location.pathname); location.hash = ''; } },
    location, URLSearchParams, SUPABASE_URL: 'https://auth.example', SUPABASE_PUBLISHABLE_KEY: 'public',
    fetch: async (url, options) => {
      calls.push({ url, ...options, body: JSON.parse(options.body) });
      const [status, data] = responses.shift();
      return { ok: status === 200, status, json: async () => data };
    },
  });
  return { elements, location, calls, save: () => submit({ preventDefault() {} }) };
}

test('o link do e-mail corresponde à página publicada e preserva o destino de parceiros', () => {
  const template = read('supabase/templates/recovery.gohtml');
  assert.match(template, /https:\/\/euamourania\.com\.br\/app\/redefinir-senha#token_hash={{ .TokenHash }}/);
  assert.match(template, /if eq .RedirectTo "https:\/\/parceiros\.euamourania\.com\.br\/login"/);
  const route = JSON.parse(read('vercel.json')).rewrites.find(row => row.source === '/app/redefinir-senha');
  assert.match(read(route.destination.slice(1)), /src="\/assets\/js\/redefinir-senha.js"/);
});

test('abrir a página não consome o link e salvar usa somente a sessão de recuperação', async () => {
  const { calls, elements, location, save } = openLink('#token_hash=teste', [[200, { access_token: 'teste' }], [200, {}]]);
  assert.equal(calls.length, 0);
  assert.equal(location.hash, '');
  assert.equal(elements['#recovery'].hidden, false);
  await save();
  assert.equal(calls[0].url, 'https://auth.example/auth/v1/verify');
  assert.deepEqual(calls[0].body, { token_hash: 'teste', type: 'recovery' });
  assert.equal(calls[1].url, 'https://auth.example/auth/v1/user');
  assert.equal(calls[1].headers.Authorization, 'Bearer teste');
  assert.deepEqual(calls[1].body, { password: 'senha-de-teste' });
  assert.equal(elements['#recovery'].hidden, true);
  assert.match(elements['#feedback'].textContent, /Senha alterada/);
});

test('link ausente, ambíguo ou expirado não permite trocar a senha', async () => {
  for (const hash of ['', '#access_token=teste', '#token_hash=a&token_hash=b']) {
    const page = openLink(hash);
    await page.save();
    assert.equal(page.calls.length, 0);
  }
  const page = openLink('#token_hash=antigo', [[403, {}]]);
  await page.save();
  assert.equal(page.calls.length, 1);
  assert.equal(page.elements['#recovery'].hidden, true);
  assert.match(page.elements['#feedback'].textContent, /expirou/);
});

test('confirmação divergente e senha recusada permitem correção sem consumir o link duas vezes', async () => {
  const page = openLink('#token_hash=teste', [[200, { access_token: 'teste' }], [422, { code: 'same_password' }], [200, {}]]);
  page.elements['#confirmation'].value = 'divergente';
  await page.save();
  assert.equal(page.calls.length, 0);
  page.elements['#confirmation'].value = page.elements['#password'].value;
  await page.save();
  assert.match(page.elements['#feedback'].textContent, /diferente/);
  page.elements['#password'].value = page.elements['#confirmation'].value = 'outra-senha-de-teste';
  await page.save();
  assert.deepEqual(page.calls.map(call => call.method), ['POST', 'PUT', 'PUT']);
});
