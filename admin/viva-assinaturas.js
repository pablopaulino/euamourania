import { exigirPermissao } from './auth.js';
import { getSupabase } from '../assets/js/services/supabaseClient.js';
import { vivaSubscriptionsView } from './viva-assinaturas-view.js';

let currentMount = null;
let mountVersion = 0;

export async function mount(container, context = {}) {
  unmount();
  const version = ++mountVersion;
  const access = await exigirPermissao('guia_comercial', 'editar');
  if (!access || version !== mountVersion) return;

  const module = { container, active: true, request: 0, context, guides: [], plans: new Map(), selected: new URLSearchParams(location.search).get('guia_id') || '' };
  currentMount = module;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/admin/viva-assinaturas.css?v=20261018-shell';
  style.dataset.adminModuleStyle = 'viva-assinaturas';
  document.head.append(style);
  module.style = style;
  container.dataset.module = 'viva_assinaturas';
  container.innerHTML = vivaSubscriptionsView;

  const $ = selector => container.querySelector(selector);
  const db = context.db || getSupabase();
  const form = $('#subscription-form');
  const company = $('#company');
  const save = form.querySelector('[type=submit]');
  const notice = $('#notice');
  const historyList = $('#subscription-history');
  const rows = $('#subscription-rows');
  const search = $('#subscription-search');
  const filter = $('#subscription-status');
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const state = plan => !plan ? 'sem-plano' : plan.status === 'ativa' && plan.validade < today() ? 'vencida' : plan.status;
  const labels = { ativa: 'Ativa', pendente: 'Aguardando pagamento', pausada: 'Pausada', cancelada: 'Cancelada', vencida: 'Vencida', 'sem-plano': 'Sem plano' };
  const periods = { mensal: 'Mensal', semestral: 'Semestral', anual: 'Anual' };
  const dateLabel = value => value ? value.split('-').reverse().join('/') : '—';

  function toast(message, type = 'success') {
    if (!module.active) return;
    if (typeof context.toast === 'function') return context.toast(message, type);
    const stack = document.querySelector('#subscription-toasts') || document.createElement('div');
    if (!stack.isConnected) { stack.id = 'subscription-toasts'; stack.className = 'viva-toast-stack'; document.body.append(stack); }
    const item = document.createElement('div');
    item.className = `viva-toast ${type}`;
    item.textContent = message;
    stack.append(item);
    setTimeout(() => item.remove(), 5000);
  }

  function render() {
    if (!module.active) return;
    const now = today();
    const end = new Date(`${now}T12:00:00`);
    end.setDate(end.getDate() + 15);
    const until = [end.getFullYear(), String(end.getMonth() + 1).padStart(2, '0'), String(end.getDate()).padStart(2, '0')].join('-');
    const all = [...module.plans.values()];
    $('#metric-active').textContent = all.filter(plan => state(plan) === 'ativa').length;
    $('#metric-expiring').textContent = all.filter(plan => state(plan) === 'ativa' && plan.validade >= now && plan.validade <= until).length;
    $('#metric-pending').textContent = all.filter(plan => plan.status === 'pendente' || plan.status === 'ativa' && !plan.pagamento_confirmado_em).length;

    const query = search.value.trim().toLocaleLowerCase('pt-BR');
    const visible = module.guides.filter(guide => guide.nome.toLocaleLowerCase('pt-BR').includes(query) && (!filter.value || state(module.plans.get(guide.id)) === filter.value));
    rows.replaceChildren();
    for (const guide of visible) {
      const plan = module.plans.get(guide.id);
      const row = rows.insertRow();
      if (guide.id === module.selected) row.className = 'is-selected';
      for (const value of [guide.nome, periods[plan?.periodo] || '—', dateLabel(plan?.inicio), dateLabel(plan?.validade)]) row.insertCell().textContent = value;
      const badge = document.createElement('span');
      badge.className = `viva-status ${state(plan)}`;
      badge.textContent = labels[state(plan)] || plan?.status || '—';
      row.insertCell().append(badge);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-button secondary';
      button.textContent = plan ? 'Editar' : 'Cadastrar';
      button.onclick = () => {
        module.selected = guide.id;
        company.value = guide.id;
        load();
        $('#subscription-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      row.insertCell().append(button);
      row.onclick = event => { if (!event.target.closest('button')) button.click(); };
    }
    if (!visible.length) { const cell = rows.insertRow().insertCell(); cell.colSpan = 6; cell.textContent = 'Nenhuma empresa encontrada.'; }
    $('#list-count').textContent = `${visible.length} empresa${visible.length === 1 ? '' : 's'} exibida${visible.length === 1 ? '' : 's'}`;
  }

  async function refresh() {
    const [{ data: guides, error: guidesError }, { data: plans, error: plansError }] = await Promise.all([
      db.from('guia_comercial').select('id,nome').order('nome').limit(5000),
      db.from('viva_assinaturas').select('guia_id,periodo,status,inicio,validade,pagamento_confirmado_em').limit(5000)
    ]);
    if (!module.active) return false;
    if (guidesError || plansError) {
      notice.textContent = `Não foi possível carregar as assinaturas: ${(guidesError || plansError).message}`;
      toast(notice.textContent, 'error');
      return false;
    }
    module.guides = guides || [];
    module.plans = new Map((plans || []).map(plan => [plan.guia_id, plan]));
    company.replaceChildren(new Option('Selecione uma empresa', ''));
    for (const guide of module.guides) company.add(new Option(guide.nome, guide.id));
    if (!module.guides.some(guide => guide.id === module.selected)) module.selected = '';
    company.value = module.selected;
    render();
    return true;
  }

  async function load() {
    const request = ++module.request;
    save.disabled = true;
    form.reset();
    company.value = module.selected;
    historyList.replaceChildren();
    notice.textContent = '';
    render();
    if (!module.selected) { $('#current-state').textContent = 'Selecione uma empresa para começar.'; return; }
    const [{ data: plan, error }, { data: history, error: historyError }] = await Promise.all([
      db.from('viva_assinaturas').select('*').eq('guia_id', module.selected).maybeSingle(),
      db.from('viva_assinaturas_historico').select('criado_em,novo').eq('guia_id', module.selected).order('criado_em', { ascending: false }).limit(20)
    ]);
    if (!module.active || request !== module.request) return;
    if (error) { notice.textContent = `Consulta indisponível: ${error.message}`; toast(notice.textContent, 'error'); return; }
    $('#current-state').textContent = plan ? `Registro: ${labels[state(plan)] || plan.status} · ${periods[plan.periodo] || plan.periodo} · validade ${dateLabel(plan.validade)}` : 'Sem assinatura Viva vinculada.';
    if (plan) {
      for (const key of ['periodo', 'status', 'inicio', 'validade']) form.elements[key].value = plan[key];
      form.elements.pago.checked = Boolean(plan.pagamento_confirmado_em);
    } else form.elements.inicio.value = today();
    if (historyError) toast('Assinatura carregada; histórico indisponível.', 'error');
    if (!historyError && !history?.length) { const item = document.createElement('li'); item.textContent = 'Nenhuma alteração registrada para esta empresa.'; historyList.append(item); }
    for (const entry of history || []) {
      const item = document.createElement('li');
      item.textContent = `${new Date(entry.criado_em).toLocaleString('pt-BR')} · ${entry.novo?.status || '—'} · ${entry.novo?.periodo || '—'} · até ${dateLabel(entry.novo?.validade)}`;
      historyList.append(item);
    }
    save.disabled = false;
  }

  search.oninput = render;
  filter.onchange = render;
  company.onchange = () => { module.selected = company.value; load(); };
  for (const key of ['inicio', 'validade', 'periodo']) form.elements[key].onchange = () => { form.elements.pago.checked = false; };
  $('#calculate').onclick = () => {
    const value = form.elements.inicio.value;
    if (!value) { toast('Selecione a data de início.', 'error'); return; }
    const [year, month, day] = value.split('-').map(Number);
    const months = { mensal: 1, semestral: 6, anual: 12 }[form.elements.periodo.value];
    const last = new Date(year, month - 1 + months + 1, 0).getDate();
    const end = new Date(year, month - 1 + months, Math.min(day, last));
    end.setDate(end.getDate() - 1);
    form.elements.validade.value = [end.getFullYear(), String(end.getMonth() + 1).padStart(2, '0'), String(end.getDate()).padStart(2, '0')].join('-');
    form.elements.pago.checked = false;
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (!module.selected) { toast('Selecione uma empresa.', 'error'); return; }
    save.disabled = true;
    try {
      const { error } = await db.rpc('admin_salvar_assinatura_viva', {
        p_guia_id: module.selected,
        p_periodo: form.elements.periodo.value,
        p_status: form.elements.status.value,
        p_inicio: form.elements.inicio.value,
        p_validade: form.elements.validade.value,
        p_pago: form.elements.pago.checked
      });
      if (error) throw error;
      if (await refresh()) { await load(); toast('Assinatura salva com sucesso.'); }
    } catch (error) { notice.textContent = error.message; toast(`Erro ao salvar: ${error.message}`, 'error'); }
    finally { if (module.active) save.disabled = !module.selected; }
  };

  if (await refresh()) await load();
}

export function unmount() {
  mountVersion++;
  if (!currentMount) return;
  currentMount.active = false;
  currentMount.request++;
  currentMount.style?.remove();
  if (currentMount.container?.dataset.module === 'viva_assinaturas') delete currentMount.container.dataset.module;
  currentMount = null;
}

if (document.body.classList.contains('viva-subscriptions-admin')) {
  mount(document.querySelector('.viva-admin-content') || document.body);
}
