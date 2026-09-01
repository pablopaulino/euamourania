import { excluirMotorista, listarMotoristasAdmin, salvarMotorista } from '../assets/js/services/motoristasService.js';
import { gerarSlug } from '../assets/js/utils.js';

let app = null;
let style = null;
const state = { items: [], selected: null, creating: false, message: '' };

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const value = (data, name) => String(data.get(name) || '').trim() || null;
const arrayValue = (data, name) => String(data.get(name) || '').split(',').map(item => item.trim()).filter(Boolean);
const arrayText = value => Array.isArray(value) ? value.join(', ') : '';
const availability = { consulte: 'Disponibilidade: consulte', disponivel: 'Disponível', indisponivel: 'Indisponível', hoje: 'Disponível hoje', agendamento: 'Sob agendamento' };
const blank = () => ({ nome: '', slug: '', descricao: 'Motorista particular', telefone: '', whatsapp: '', cidade: 'Urânia - SP', regioes_atendidas: [], tipos_servico: [], observacao: '', disponibilidade: 'consulte', ativo: true, destaque: false, ordem: 100 });

function ensureStyle() {
  if (document.querySelector('[data-admin-module-style="motoristas"]')) return;
  style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = '/admin/motoristas.css'; style.dataset.adminModuleStyle = 'motoristas';
  document.head.append(style);
}

async function load() {
  state.items = await listarMotoristasAdmin();
  if (state.selected?.id) state.selected = state.items.find(item => item.id === state.selected.id) || null;
  render();
}

function render() {
  const root = app || document.querySelector('#app-content');
  if (!root) return;
  app = root;
  const item = state.creating ? blank() : state.selected;
  root.innerHTML = `
    <section class="admin-page drivers-admin-page">
      <header class="admin-page-header drivers-header"><div><p class="eyebrow">Mobilidade</p><h2>Motoristas</h2><p>Organize contatos de motoristas particulares para corridas locais e viagens.</p></div><button class="admin-button" type="button" data-new>Novo motorista</button></header>
      ${state.message ? `<p class="form-message">${esc(state.message)}</p>` : ''}
      <div class="drivers-layout">
        <aside class="drivers-list-card"><div class="drivers-list-head"><strong>Cadastros</strong><span>${state.items.length}</span></div><div class="drivers-list">${state.items.map(item => `<button type="button" class="driver-item ${state.selected?.id === item.id ? 'active' : ''}" data-select="${item.id}"><span class="driver-item-icon">🚗</span><span><strong>${esc(item.nome)}</strong><small>${esc(availability[item.disponibilidade] || availability.consulte)}${item.ativo ? '' : ' · oculto'}</small></span>${item.destaque ? '<em>Destaque</em>' : ''}</button>`).join('') || '<p class="drivers-empty">Nenhum motorista cadastrado.</p>'}</div></aside>
        <main class="drivers-editor">${item ? editor(item) : dashboard()}</main>
      </div>
    </section>`;
  bind(root);
}

function dashboard() {
  return `<section class="drivers-dashboard"><span class="drivers-dashboard-icon">🚗</span><h3>Contatos rápidos para a cidade.</h3><p>Cadastre motoristas particulares, defina a ordem de exibição e publique somente os contatos revisados.</p><button class="admin-button" type="button" data-new>Cadastrar primeiro motorista</button></section>`;
}

function editor(item) {
  return `<form id="driver-form" class="drivers-form">
    <div class="drivers-editor-head"><div><p class="eyebrow">${item.id ? 'Editando contato' : 'Novo contato'}</p><h3>${esc(item.nome || 'Novo motorista')}</h3><p>O WhatsApp é o contato principal exibido no aplicativo.</p></div>${item.id ? '<button type="button" class="admin-button secondary" data-delete>Excluir</button>' : '<button type="button" class="admin-button secondary" data-cancel>Cancelar</button>'}</div>
    <section><h4>Informações públicas</h4><div class="drivers-grid"><label>Nome<input required name="nome" value="${esc(item.nome)}"></label><label>Slug<input required name="slug" value="${esc(item.slug)}"></label><label class="wide">Descrição curta<input name="descricao" value="${esc(item.descricao)}" placeholder="Motorista particular"></label><label>Cidade<input name="cidade" value="${esc(item.cidade)}"></label><label>Regiões atendidas<input name="regioes_atendidas" value="${esc(arrayText(item.regioes_atendidas))}" placeholder="Urânia, Jales, Região"><small>Separe por vírgulas.</small></label><label>Tipos de serviço<input name="tipos_servico" value="${esc(arrayText(item.tipos_servico))}" placeholder="Corridas locais, Viagens"><small>Separe por vírgulas.</small></label><label>Disponibilidade<select name="disponibilidade">${Object.entries(availability).map(([key,label]) => `<option value="${key}" ${item.disponibilidade === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="wide">Observação<textarea name="observacao" rows="3" placeholder="Informação opcional que ajuda na consulta de corrida.">${esc(item.observacao)}</textarea></label></div></section>
    <section><h4>Contato</h4><div class="drivers-grid"><label>WhatsApp<input required name="whatsapp" value="${esc(item.whatsapp)}" placeholder="(17) 99999-9999"><small>Obrigatório. O app abre uma conversa direta.</small></label><label>Telefone<input name="telefone" value="${esc(item.telefone)}" placeholder="Opcional"></label></div></section>
    <section><h4>Publicação</h4><div class="drivers-grid"><label>Ordem<input type="number" name="ordem" value="${Number(item.ordem ?? 100)}"></label><div class="drivers-checks"><label><input type="checkbox" name="ativo" ${item.ativo ? 'checked' : ''}> Exibir no aplicativo</label><label><input type="checkbox" name="destaque" ${item.destaque ? 'checked' : ''}> Destacar</label></div></div></section>
    <div class="drivers-actions"><button class="admin-button" type="submit">Salvar motorista</button></div>
  </form>`;
}

function bind(root) {
  root.querySelectorAll('[data-new]').forEach(button => button.addEventListener('click', () => { state.selected = null; state.creating = true; state.message = ''; render(); }));
  root.querySelectorAll('[data-select]').forEach(button => button.addEventListener('click', () => { state.selected = state.items.find(item => item.id === button.dataset.select) || null; state.creating = false; state.message = ''; render(); }));
  root.querySelector('[data-cancel]')?.addEventListener('click', () => { state.creating = false; render(); });
  root.querySelector('[data-delete]')?.addEventListener('click', async () => { if (!state.selected?.id || !confirm(`Excluir ${state.selected.nome}?`)) return; await excluirMotorista(state.selected.id); state.selected = null; state.message = 'Motorista excluído.'; await load(); });
  root.querySelector('#driver-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); button.disabled = true;
    const data = new FormData(form); const nome = value(data, 'nome'); const previous = state.selected || {};
    try { await salvarMotorista({ ...previous, id: state.selected?.id, nome, slug: value(data, 'slug') || gerarSlug(nome), descricao: value(data, 'descricao'), telefone: value(data, 'telefone'), whatsapp: value(data, 'whatsapp'), cidade: value(data, 'cidade') || 'Urânia - SP', regioes_atendidas: arrayValue(data, 'regioes_atendidas'), tipos_servico: arrayValue(data, 'tipos_servico'), observacao: value(data, 'observacao'), disponibilidade: value(data, 'disponibilidade') || 'consulte', ativo: data.get('ativo') === 'on', destaque: data.get('destaque') === 'on', ordem: Number(data.get('ordem') || 100) }); state.creating = false; state.message = 'Motorista salvo.'; await load(); }
    catch (error) { state.message = `Não foi possível salvar: ${error.message || 'verifique os campos.'}`; render(); }
    finally { button?.removeAttribute('disabled'); }
  });
}

export async function mount(container) { app = container || document.querySelector('#app-content'); ensureStyle(); await load(); }
export function unmount() { style?.remove(); style = null; app = null; }
