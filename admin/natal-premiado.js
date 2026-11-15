import { getSupabase } from '../assets/js/services/supabaseClient.js';

let root;
let stylesheet;
const state = { year: 2026, prizes: [], supporters: [], results: [], companies: [], edit: null, message: '' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const checked = value => value ? 'checked' : '';
const companyName = id => state.companies.find(company => company.id === id)?.nome || 'Empresa indisponível';
const prizeName = id => state.prizes.find(prize => prize.id === id)?.name || 'Prêmio indisponível';

async function fetchRows(table, year) {
  let query = getSupabase().from(table).select('*');
  if (year) query = query.eq('year', year);
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function load() {
  const [prizes, supporters, results, companies] = await Promise.all([
    fetchRows('natal_premiado_prizes', state.year), fetchRows('natal_premiado_supporters', state.year), fetchRows('natal_premiado_results'),
    getSupabase().from('guia_comercial').select('id,nome,status').order('nome')
  ]);
  if (companies.error) throw companies.error;
  state.prizes = prizes; state.supporters = supporters; state.results = results.filter(result => prizes.some(prize => prize.id === result.prize_id)); state.companies = companies.data || [];
  render();
}
function companyOptions(selected = '') {
  return '<option value="">Selecione uma empresa</option>' + state.companies.filter(company => company.status === 'publicado' || company.id === selected).map(company => `<option value="${esc(company.id)}" ${company.id === selected ? 'selected' : ''}>${esc(company.nome)}${company.status === 'publicado' ? '' : ' (não publicada)'}</option>`).join('');
}
function prizeOptions(selected = '') {
  return '<option value="">Selecione um prêmio</option>' + state.prizes.map(prize => `<option value="${esc(prize.id)}" ${prize.id === selected ? 'selected' : ''}>${esc(prize.name)} · ${esc(companyName(prize.company_id))}</option>`).join('');
}
function form() {
  if (!state.edit) return '';
  const { type, item = {} } = state.edit;
  const fields = type === 'prizes' ? `<label>Nome do prêmio<input name="name" required maxlength="160" value="${esc(item.name)}"></label><label>Empresa responsável<select name="company_id" required>${companyOptions(item.company_id)}</select></label><label>Descrição<textarea name="description">${esc(item.description)}</textarea></label><label>URL da imagem<input name="image_url" type="url" value="${esc(item.image_url)}"></label><label>Ordem<input name="display_order" type="number" value="${Number(item.display_order || 0)}"></label>` : type === 'supporters' ? `<label>Empresa apoiadora<select name="company_id" required>${companyOptions(item.company_id)}</select></label><label>Ordem<input name="display_order" type="number" value="${Number(item.display_order || 0)}"></label>` : `<label>Prêmio<select name="prize_id" required>${prizeOptions(item.prize_id)}</select></label><label>Número sorteado<input name="ticket_number" required inputmode="numeric" pattern="[0-9]{5}" maxlength="5" value="${esc(item.ticket_number)}" placeholder="00001"><small>Informe exatamente os cinco dígitos.</small></label><label>Nome público do ganhador<input name="winner_name" required maxlength="160" value="${esc(item.winner_name)}"><small>Publique apenas o nome autorizado para divulgação.</small></label><p class="natal-note">Confira o número ativo, a elegibilidade e o nome antes de publicar. Os bilhetes atuais não identificam a edição anual; este registro não valida o sorteio automaticamente.</p>`;
  const label = { prizes: 'prêmio', supporters: 'apoiador', results: 'resultado' }[type];
  return `<section class="panel natal-editor"><h3>${item.id ? 'Editar' : 'Novo'} ${label} · ${state.year}</h3><form id="natal-form">${fields}<label class="natal-check"><input type="checkbox" name="published" ${checked(item.published)}> Publicar no aplicativo</label><div class="natal-actions"><button class="admin-button" type="submit">Salvar ${label}</button><button class="admin-button secondary" type="button" data-cancel>Cancelar</button></div></form></section>`;
}
function renderList(type, title, description, rows, itemMarkup) {
  return `<section class="panel natal-list"><div class="natal-list-head"><div><h3>${title}</h3><p>${description}</p></div><button class="admin-button secondary" data-new="${type}">Adicionar</button></div><div>${rows.map(item => `<div class="natal-row"><div>${itemMarkup(item)}<small>${item.published ? 'Publicado' : 'Rascunho'}</small></div><div class="natal-actions"><button type="button" class="admin-button secondary" data-edit="${type}" data-id="${esc(item.id)}">Editar</button><button type="button" class="admin-button secondary" data-delete="${type}" data-id="${esc(item.id)}">Excluir</button></div></div>`).join('') || '<p class="natal-empty">Nenhum cadastro nesta edição.</p>'}</div></section>`;
}
function render() {
  if (!root) return;
  root.innerHTML = `<section class="admin-page natal-admin"><header class="admin-page-header"><div><p class="eyebrow">Viva Urânia</p><h2>Natal Premiado</h2><p>Organize os prêmios, os apoiadores e a divulgação dos resultados de cada edição.</p></div><label>Ano da edição<input id="natal-year" type="number" min="2026" max="2100" value="${state.year}"></label></header>${state.message ? `<p class="form-message" role="status">${esc(state.message)}</p>` : ''}${form()}${renderList('prizes', 'Prêmios', 'Cadastre cada presente e a empresa responsável.', state.prizes, item => `<strong>${esc(item.name)}</strong><span>${esc(companyName(item.company_id))}</span>`)}${renderList('supporters', 'Lojas apoiadoras', 'Apoios são independentes dos prêmios.', state.supporters, item => `<strong>${esc(companyName(item.company_id))}</strong>`)}${renderList('results', 'Resultados do sorteio', 'Divulgue um ganhador por prêmio após conferir o sorteio.', state.results, item => `<strong>${esc(prizeName(item.prize_id))}</strong><span>#${esc(item.ticket_number)} · ${esc(item.winner_name)}</span>`)}</section>`;
  bind();
}
function bind() {
  root.querySelector('#natal-year').addEventListener('change', async event => { const year = Number(event.target.value); if (!Number.isInteger(year) || year < 2026 || year > 2100) { event.target.value = state.year; return; } state.year = year; state.edit = null; state.message = ''; await safeLoad(); });
  root.querySelectorAll('[data-new]').forEach(button => button.addEventListener('click', () => { state.edit = { type: button.dataset.new }; state.message = ''; render(); root.querySelector('.natal-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  root.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => { state.edit = { type: button.dataset.edit, item: state[button.dataset.edit].find(item => item.id === button.dataset.id) }; state.message = ''; render(); root.querySelector('.natal-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  root.querySelector('[data-cancel]')?.addEventListener('click', () => { state.edit = null; render(); });
  root.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('Excluir este registro?')) return;
    button.disabled = true;
    const { error } = await getSupabase().from(tableName(button.dataset.delete)).delete().eq('id', button.dataset.id);
    state.message = error ? `Não foi possível excluir: ${error.message}` : 'Registro excluído.';
    if (!error) state.edit = null;
    await safeLoad();
  }));
  root.querySelector('#natal-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true;
    const data = new FormData(event.currentTarget), type = state.edit.type, item = state.edit.item || {};
    const val = name => String(data.get(name) || '').trim();
    const payload = type === 'prizes' ? { year: state.year, name: val('name'), company_id: val('company_id'), description: val('description') || null, image_url: val('image_url') || null, display_order: Number(val('display_order') || 0), published: data.has('published') } : type === 'supporters' ? { year: state.year, company_id: val('company_id'), display_order: Number(val('display_order') || 0), published: data.has('published') } : { prize_id: val('prize_id'), ticket_number: val('ticket_number'), winner_name: val('winner_name'), published: data.has('published') };
    const table = getSupabase().from(tableName(type));
    const { error } = await (item.id ? table.update(payload).eq('id', item.id) : table.insert(payload));
    if (error) { state.message = `Não foi possível salvar: ${error.message}`; button.disabled = false; render(); return; }
    state.edit = null; state.message = 'Registro salvo.'; await safeLoad();
  });
}
function tableName(type) { return ({ prizes: 'natal_premiado_prizes', supporters: 'natal_premiado_supporters', results: 'natal_premiado_results' })[type]; }
async function safeLoad() { try { await load(); } catch (error) { state.message = `Não foi possível carregar o módulo: ${error.message || 'verifique sua conexão.'}`; render(); } }
export async function mount(container) {
  root = container;
  stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/admin/natal-premiado.css'; document.head.append(stylesheet);
  await safeLoad();
}
export function unmount() { stylesheet?.remove(); stylesheet = null; root = null; }
