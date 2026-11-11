import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../admin/viva-assinaturas.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../admin/viva-assinaturas-view.js', import.meta.url), 'utf8');
const start = source.indexOf('  function computeEndDate(');
const end = source.indexOf('  function updateValidityFeedback(');
const fields = Object.fromEntries(['periodo','status','inicio','validade','pago'].map(name => [name, { value: '', checked: true }]));
const module = { selected: 'empresa', plans: new Map() };
const context = vm.createContext({ module, form: { elements: fields }, today: () => '2026-11-11',
  formatLocalDate: d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'),
  updateValidityFeedback() {}, save: { scrollIntoView() {} }, toast() {}, dateLabel: x => x,
  $: () => ({ scrollIntoView() {} }), company: { focus() {} }
});
vm.runInContext(source.slice(start, end), context);
module.plans.set('empresa', { inicio: '2026-10-01', validade: '2026-11-30' });
context.aplicarRenovacao(1,'mensal');
assert.equal(fields.inicio.value,'2026-10-01');
assert.equal(fields.validade.value,'2026-12-30');
assert.equal(fields.pago.checked,false,'Renovar não deve confirmar recebimento automaticamente');
module.plans.set('empresa', { inicio: '2026-09-01', validade: '2026-10-01' });
context.aplicarRenovacao(6,'semestral');
assert.equal(fields.inicio.value,'2026-11-11');
assert.equal(fields.validade.value,'2027-05-10');
context.aplicarRenovacao(12,'anual');
assert.equal(fields.validade.value,'2027-11-10');
for (const id of ['quick-renew-month','quick-renew-6m','quick-renew-1y','subscription-editor','metric-offer','offer-status']) assert.ok(view.includes(`id="${id}"`),id);
assert.ok(source.includes("admin_salvar_assinatura_viva_oferta"));
assert.ok(source.includes("p_oferta: form.elements.oferta.checked"));
assert.ok(source.includes("viva_oferta_lancamento"));
console.log('Assinaturas: renovação preserva vigência, exige confirmação de pagamento e mantém oferta — OK');
