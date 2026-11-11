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

  // Extrai guia_id de search params ou do hash (caso venha de #viva_assinaturas?guia_id=xxx)
  let initialGuiaId = new URLSearchParams(location.search).get('guia_id') || '';
  if (!initialGuiaId && location.hash.includes('?')) {
    const hashQuery = location.hash.split('?')[1];
    if (hashQuery) {
      initialGuiaId = new URLSearchParams(hashQuery).get('guia_id') || '';
    }
  }

  const module = {
    container,
    active: true,
    request: 0,
    context,
    guides: [],
    plans: new Map(),
    offers: new Map(),
    selected: initialGuiaId
  };
  currentMount = module;

  // Injeta a folha de estilos do módulo com cache-busting
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/admin/viva-assinaturas.css?v=20261111-minimal';
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
  const clearSearch = $('#clear-search');
  const btnRefresh = $('#btn-refresh-list');
  const validityFeedback = $('#validity-feedback');
  const validityFeedbackText = $('#validity-feedback-text');

  // Helpers de Data no fuso de Brasília
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  const parseLocalDate = dateStr => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  };

  const formatLocalDate = dateObj => {
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const dateLabel = value => {
    if (!value) return '—';
    const parts = value.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };

  const getDaysDiff = (dateStr1, dateStr2) => {
    const d1 = parseLocalDate(dateStr1);
    const d2 = parseLocalDate(dateStr2);
    if (!d1 || !d2) return 0;
    const diffTime = d1.getTime() - d2.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const state = plan => {
    if (!plan) return 'sem-plano';
    if (plan.status === 'ativa' && plan.validade < today()) return 'vencida';
    return plan.status;
  };

  const labels = {
    ativa: 'Ativa',
    pendente: 'Aguardando confirmação',
    pausada: 'Pausada',
    cancelada: 'Cancelada',
    vencida: 'Vencida',
    'sem-plano': 'Sem plano'
  };

  const periods = {
    mensal: 'Mensal · R$ 79,90',
    semestral: 'Semestral · R$ 419,90',
    anual: 'Anual · R$ 759,90'
  };

  function toast(message, type = 'success') {
    if (!module.active) return;
    if (typeof context.toast === 'function') return context.toast(message, type);
    let stack = document.querySelector('#subscription-toasts');
    if (!stack || !stack.isConnected) {
      stack = document.createElement('div');
      stack.id = 'subscription-toasts';
      stack.className = 'viva-toast-stack';
      document.body.append(stack);
    }
    const item = document.createElement('div');
    item.className = `viva-toast ${type}`;
    item.textContent = message;
    stack.append(item);
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(10px)';
      setTimeout(() => item.remove(), 250);
    }, 4500);
  }

  // Calcula validade a partir de uma data inicial e quantidade de meses
  function computeEndDate(startDateStr, monthsToAdd = 1) {
    if (!startDateStr) return '';
    const [year, month, day] = startDateStr.split('-').map(Number);
    const lastDayOfTargetMonth = new Date(year, month - 1 + monthsToAdd + 1, 0).getDate();
    const targetEnd = new Date(year, month - 1 + monthsToAdd, Math.min(day, lastDayOfTargetMonth));
    targetEnd.setDate(targetEnd.getDate() - 1);
    return formatLocalDate(targetEnd);
  }

  // Função central de renovação (usada pelo botão de +1 Mês e atalhos)
  function aplicarRenovacao(meses = 1, periodoKey = 'mensal') {
    if (!module.selected) {
      toast('Selecione primeiro uma empresa para renovar a assinatura.', 'error');
      $('#subscription-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
      company.focus();
      return;
    }

    const now = today();
    const currentPlan = module.plans.get(module.selected);
    let novoInicio = now;
    let novaValidade = '';

    // Se já existe um plano cadastrado com validade
    if (currentPlan && currentPlan.validade) {
      if (currentPlan.validade >= now) {
        // Ainda está em vigor: adiciona meses diretamente à validade atual para não perder os dias já pagos!
        novoInicio = currentPlan.inicio || now;
        const [vYear, vMonth, vDay] = currentPlan.validade.split('-').map(Number);
        const lastDayOfTargetMonth = new Date(vYear, vMonth - 1 + meses + 1, 0).getDate();
        const extendedDate = new Date(vYear, vMonth - 1 + meses, Math.min(vDay, lastDayOfTargetMonth));
        novaValidade = formatLocalDate(extendedDate);
      } else {
        // Já venceu no passado: o novo ciclo inicia hoje
        novoInicio = now;
        novaValidade = computeEndDate(now, meses);
      }
    } else {
      // Sem plano anterior: inicia hoje
      novoInicio = now;
      novaValidade = computeEndDate(now, meses);
    }

    // Preenche os campos do formulário
    form.elements.periodo.value = periodoKey;
    form.elements.status.value = 'ativa';
    form.elements.inicio.value = novoInicio;
    form.elements.validade.value = novaValidade;
    form.elements.pago.checked = false;

    // Atualiza o feedback visual
    updateValidityFeedback();
    save.disabled = false;

    const mesesTexto = meses === 1 ? '+1 mês' : `${meses} meses`;
    toast(`✨ Renovação de ${mesesTexto} aplicada! Vigência até ${dateLabel(novaValidade)}. Clique em "Salvar assinatura" para confirmar.`);

    // Destaca a caixa do botão de salvar
    save.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateValidityFeedback() {
    const ini = form.elements.inicio.value;
    const val = form.elements.validade.value;
    if (ini && val) {
      const days = getDaysDiff(val, ini) + 1;
      validityFeedback.hidden = false;
      validityFeedbackText.textContent = `Vigência configurada: de ${dateLabel(ini)} até ${dateLabel(val)} (${days} dia${days === 1 ? '' : 's'} de acesso).`;
    } else {
      validityFeedback.hidden = true;
    }
  }

  function renderMetrics() {
    const now = today();
    const end = new Date(`${now}T12:00:00`);
    end.setDate(end.getDate() + 15);
    const until = formatLocalDate(end);
    const all = [...module.plans.values()];

    const activeCount = all.filter(plan => state(plan) === 'ativa').length;
    const expiringCount = all.filter(plan => state(plan) === 'ativa' && plan.validade >= now && plan.validade <= until).length;
    const pendingCount = all.filter(plan => plan.status === 'pendente' || (plan.status === 'ativa' && !plan.pagamento_confirmado_em)).length;
    const totalCount = module.guides.length;

    $('#metric-active').textContent = activeCount;
    $('#metric-expiring').textContent = expiringCount;
    $('#metric-pending').textContent = pendingCount;
    const metricTotal = $('#metric-total');
    if (metricTotal) metricTotal.textContent = totalCount;

    // Destaca visualmente o card de filtro se ativo
    const cards = [
      { id: '#card-filter-active', val: 'ativa' },
      { id: '#card-filter-expiring', val: 'vencendo' },
      { id: '#card-filter-pending', val: 'pendente' },
      { id: '#card-filter-all', val: '' }
    ];
    cards.forEach(c => {
      const el = $(c.id);
      if (el) el.classList.toggle('selected-filter', filter.value === c.val);
    });
  }

  function render() {
    if (!module.active) return;
    renderMetrics();

    const now = today();
    const end = new Date(`${now}T12:00:00`);
    end.setDate(end.getDate() + 15);
    const until = formatLocalDate(end);

    const query = search.value.trim().toLocaleLowerCase('pt-BR');
    if (clearSearch) clearSearch.hidden = !query;

    const visible = module.guides.filter(guide => {
      const matchesSearch = guide.nome.toLocaleLowerCase('pt-BR').includes(query);
      if (!matchesSearch) return false;

      const plan = module.plans.get(guide.id);
      const st = state(plan);

      if (!filter.value) return true;
      if (filter.value === 'vencendo') {
        return st === 'ativa' && plan.validade >= now && plan.validade <= until;
      }
      return st === filter.value;
    });

    rows.replaceChildren();

    for (const guide of visible) {
      const plan = module.plans.get(guide.id);
      const st = state(plan);
      const row = rows.insertRow();
      const isSelected = guide.id === module.selected;
      if (isSelected) row.className = 'is-selected';

      // Coluna 1: Empresa com Avatar
      const cellCompany = row.insertCell();
      const companyDiv = document.createElement('div');
      companyDiv.className = 'viva-company-cell';

      const avatar = document.createElement('div');
      avatar.className = 'viva-company-avatar';
      avatar.textContent = guide.nome.trim().charAt(0).toUpperCase() || 'E';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'viva-company-info';
      const nameStrong = document.createElement('span');
      nameStrong.className = 'viva-company-title';
      nameStrong.textContent = guide.nome;

      const subSpan = document.createElement('span');
      subSpan.className = 'viva-company-sub';
      if (plan && plan.validade) {
        const diff = getDaysDiff(plan.validade, now);
        if (st === 'ativa') {
          if (diff <= 15) subSpan.textContent = `⚠️ Vence em ${diff} dia${diff === 1 ? '' : 's'}`;
          else subSpan.textContent = `Válida por mais ${diff} dias`;
        } else if (st === 'vencida') {
          const pastDiff = Math.abs(diff);
          subSpan.textContent = `Vencida há ${pastDiff} dia${pastDiff === 1 ? '' : 's'}`;
        } else {
          subSpan.textContent = 'Assinatura registrada';
        }
      } else {
        subSpan.textContent = 'Sem assinatura ativa';
      }

      infoDiv.append(nameStrong, subSpan);
      companyDiv.append(avatar, infoDiv);
      cellCompany.append(companyDiv);

      // Coluna 2: Período
      const cellPeriod = row.insertCell();
      cellPeriod.textContent = plan?.periodo ? (periods[plan.periodo]?.split('·')[0].trim() || plan.periodo) : '—';
      cellPeriod.className = 'viva-period-cell';

      // Coluna 3: Início
      const cellInicio = row.insertCell();
      cellInicio.textContent = dateLabel(plan?.inicio);
      cellInicio.className = 'viva-date-cell';

      // Coluna 4: Validade
      const cellValidade = row.insertCell();
      cellValidade.textContent = dateLabel(plan?.validade);
      cellValidade.className = 'viva-date-cell';
      if (st === 'ativa' && plan.validade <= until) cellValidade.classList.add('is-expiring');
      if (st === 'vencida') cellValidade.classList.add('is-expired');

      // Coluna 5: Status Badge
      const cellStatus = row.insertCell();
      const badge = document.createElement('span');
      let badgeClass = st;
      if (st === 'ativa' && plan.validade <= until) badgeClass = 'vencendo';
      badge.className = `viva-status-pill ${badgeClass}`;

      const dot = document.createElement('span');
      dot.className = 'viva-status-dot';

      const labelText = document.createTextNode(
        st === 'ativa' && plan.validade <= until ? 'Vence em breve' : (labels[st] || plan?.status || 'Sem plano')
      );
      badge.append(dot, labelText);
      cellStatus.append(badge);

      // Coluna 6: Ação
      const cellAction = row.insertCell();
      cellAction.style.textAlign = 'right';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'viva-btn-manage';
      button.innerHTML = plan ? '<span>Gerenciar</span>' : '<span>Cadastrar</span>';

      button.onclick = e => {
        e.stopPropagation();
        module.selected = guide.id;
        company.value = guide.id;
        load();
        $('#subscription-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      cellAction.append(button);

      row.onclick = event => {
        if (!event.target.closest('button')) button.click();
      };
    }

    if (!visible.length) {
      const cell = rows.insertRow().insertCell();
      cell.colSpan = 6;
      cell.className = 'viva-table-empty';
      cell.innerHTML = `
        <div style="padding: 24px 0;">
          <p style="font-size: 15px; font-weight: 700; margin: 0 0 6px; color: var(--viva-text);">Nenhum estabelecimento encontrado</p>
          <p style="font-size: 13px; margin: 0; color: var(--viva-text-muted);">Tente alterar o termo de busca ou limpar os filtros de status.</p>
        </div>
      `;
    }

    $('#list-count').textContent = `${visible.length} empresa${visible.length === 1 ? '' : 's'} exibida${visible.length === 1 ? '' : 's'}`;
  }

  async function refresh() {
    if (btnRefresh) btnRefresh.classList.add('is-spinning');
    const [{ data: guides, error: guidesError }, { data: plans, error: plansError }, { data: offers, error: offersError }] = await Promise.all([
      db.from('guia_comercial').select('id,nome').order('nome').limit(5000),
      db.from('viva_assinaturas').select('guia_id,periodo,status,inicio,validade,pagamento_confirmado_em').limit(5000),
      db.from('viva_oferta_lancamento').select('vaga,guia_id,encerrada_em').limit(15)
    ]);
    if (btnRefresh) btnRefresh.classList.remove('is-spinning');

    if (!module.active) return false;
    if (guidesError || plansError || offersError) {
      notice.textContent = `Não foi possível carregar as assinaturas: ${(guidesError || plansError || offersError).message}`;
      toast(notice.textContent, 'error');
      return false;
    }

    module.guides = guides || [];
    module.plans = new Map((plans || []).map(plan => [plan.guia_id, plan]));
    module.offers = new Map((offers || []).map(offer => [offer.vaga, offer]));
    $('#metric-offer').textContent = `${Math.max(0, 15 - module.offers.size)} de 15 vagas disponíveis`;

    company.replaceChildren(new Option('Selecione uma empresa...', ''));
    for (const guide of module.guides) {
      company.add(new Option(guide.nome, guide.id));
    }

    if (!module.guides.some(guide => guide.id === module.selected)) {
      module.selected = '';
    }
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
    validityFeedback.hidden = true;

    const titleEl = $('#selected-company-title');
    const badgeContainer = $('#selected-status-badge-container');
    const quickRenewMonthBtn = $('#quick-renew-month');

    if (!module.selected) {
      if (titleEl) titleEl.textContent = 'Nenhuma empresa selecionada';
      if (badgeContainer) badgeContainer.replaceChildren();
      $('#current-state').textContent = 'Selecione uma empresa na tabela ou lista acima para começar.';
      if (quickRenewMonthBtn) quickRenewMonthBtn.disabled = true;
      render();
      return;
    }

    if (quickRenewMonthBtn) quickRenewMonthBtn.disabled = false;
    const selectedGuide = module.guides.find(g => g.id === module.selected);
    if (titleEl) titleEl.textContent = selectedGuide ? selectedGuide.nome : 'Empresa selecionada';

    render();

    const [{ data: plan, error }, { data: history, error: historyError }] = await Promise.all([
      db.from('viva_assinaturas').select('*').eq('guia_id', module.selected).maybeSingle(),
      db.from('viva_assinaturas_historico').select('criado_em,novo').eq('guia_id', module.selected).order('criado_em', { ascending: false }).limit(20)
    ]);

    if (!module.active || request !== module.request) return;
    if (error) {
      notice.textContent = `Consulta indisponível: ${error.message}`;
      toast(notice.textContent, 'error');
      return;
    }

    // Atualiza o estado da empresa no cabeçalho do editor
    const currentState = $('#current-state');
    if (badgeContainer) badgeContainer.replaceChildren();

    if (plan) {
      const st = state(plan);
      const diff = getDaysDiff(plan.validade, today());
      let diffMsg = '';
      if (st === 'ativa') {
        diffMsg = diff >= 0 ? ` · Válida por mais ${diff} dia${diff === 1 ? '' : 's'}` : ' · Vencida';
      } else if (st === 'vencida') {
        diffMsg = ` · Vencida há ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? '' : 's'}`;
      }

      currentState.textContent = `${periods[plan.periodo] || plan.periodo} · Validade até ${dateLabel(plan.validade)}${diffMsg}`;

      if (badgeContainer) {
        const badge = document.createElement('span');
        badge.className = `viva-status-pill ${st}`;
        badge.textContent = labels[st] || plan.status;
        badgeContainer.append(badge);
      }

      for (const key of ['periodo', 'status', 'inicio', 'validade']) {
        if (form.elements[key]) form.elements[key].value = plan[key];
      }
      form.elements.pago.checked = Boolean(plan.pagamento_confirmado_em);
      updateValidityFeedback();
    } else {
      currentState.textContent = 'Sem assinatura Viva vinculada. Preencha os campos abaixo ou clique em Renovar +1 Mês para ativar.';
      if (badgeContainer) {
        const badge = document.createElement('span');
        badge.className = 'viva-status-pill sem-plano';
        badge.textContent = 'Sem plano';
        badgeContainer.append(badge);
      }
      form.elements.inicio.value = today();
      form.elements.validade.value = computeEndDate(today(), 1);
      form.elements.periodo.value = 'mensal';
      form.elements.status.value = 'ativa';
      form.elements.pago.checked = false;
      updateValidityFeedback();
    }

    const offer = [...module.offers.values()].find(item => item.guia_id === module.selected);
    form.elements.oferta.checked = Boolean(offer && !offer.encerrada_em);
    form.elements.oferta.disabled = Boolean(offer);
    $('#offer-status').textContent = offer?.encerrada_em
      ? 'Oferta encerrada após cancelamento; a vaga continua ocupada e o desconto não pode ser reativado.'
      : offer ? 'Oferta já concedida. Cancelamento encerra o desconto sem liberar vaga.'
      : 'Exclusiva do plano mensal ativo com pagamento confirmado. Ao cancelar, a empresa perde o desconto e a vaga continua ocupada.';
    if (historyError) toast('Assinatura carregada; histórico indisponível.', 'error');
    if (!historyError && !history?.length) {
      const item = document.createElement('li');
      item.className = 'viva-timeline-empty';
      item.textContent = 'Nenhuma alteração registrada até o momento.';
      historyList.append(item);
    }

    for (const entry of history || []) {
      const item = document.createElement('li');
      item.className = 'viva-timeline-item';

      const dot = document.createElement('span');
      dot.className = 'viva-timeline-dot';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'viva-timeline-date';
      dateSpan.textContent = new Date(entry.criado_em).toLocaleString('pt-BR');

      const content = document.createElement('div');
      content.className = 'viva-timeline-content';
      const statusText = labels[entry.novo?.status] || entry.novo?.status || '—';
      const periodoText = periods[entry.novo?.periodo]?.split('·')[0].trim() || entry.novo?.periodo || '—';
      const validadeText = dateLabel(entry.novo?.validade);

      content.innerHTML = `<strong>${statusText}</strong> (${periodoText}) · Válido até ${validadeText}`;

      item.append(dot, dateSpan, content);
      historyList.append(item);
    }

    save.disabled = false;
  }

  // Ações de Busca e Filtros
  search.oninput = render;
  filter.onchange = render;

  if (clearSearch) {
    clearSearch.onclick = () => {
      search.value = '';
      render();
      search.focus();
    };
  }

  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      if (await refresh()) {
        if (module.selected) await load();
        toast('Dados atualizados com sucesso.');
      }
    };
  }

  // Filtros rápidos nos Cards de Métricas
  const setupCardFilter = (selector, filterValue) => {
    const card = $(selector);
    if (!card) return;
    const trigger = () => {
      filter.value = filter.value === filterValue ? '' : filterValue;
      render();
      $('.viva-list-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    card.onclick = trigger;
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); } };
  };

  setupCardFilter('#card-filter-active', 'ativa');
  setupCardFilter('#card-filter-expiring', 'vencendo');
  setupCardFilter('#card-filter-pending', 'pendente');
  setupCardFilter('#card-filter-all', '');

  // Troca de empresa no select do formulário
  company.onchange = () => {
    module.selected = company.value;
    load();
  };

  // Botões de Renovação Rápida
  const quickRenewMonthBtn = $('#quick-renew-month');
  if (quickRenewMonthBtn) {
    quickRenewMonthBtn.onclick = () => aplicarRenovacao(1, 'mensal');
  }

  const quickRenew6mBtn = $('#quick-renew-6m');
  if (quickRenew6mBtn) {
    quickRenew6mBtn.onclick = () => aplicarRenovacao(6, 'semestral');
  }

  const quickRenew1yBtn = $('#quick-renew-1y');
  if (quickRenew1yBtn) {
    quickRenew1yBtn.onclick = () => aplicarRenovacao(12, 'anual');
  }

  // Recalcular período clássico (#calculate)
  $('#calculate').onclick = () => {
    const value = form.elements.inicio.value;
    if (!value) {
      toast('Selecione primeiro a data de início.', 'error');
      form.elements.inicio.focus();
      return;
    }
    const months = { mensal: 1, semestral: 6, anual: 12 }[form.elements.periodo.value] || 1;
    form.elements.validade.value = computeEndDate(value, months);
    form.elements.pago.checked = false;
    updateValidityFeedback();
    toast(`Validade recalculada para ${dateLabel(form.elements.validade.value)} (${form.elements.periodo.value}).`);
  };

  // Observa mudanças nas datas e período
  for (const key of ['inicio', 'validade']) {
    form.elements[key].onchange = () => {
      form.elements.pago.checked = false;
      updateValidityFeedback();
    };
  }

  form.elements.periodo.onchange = () => {
    form.elements.pago.checked = false;
  };

  // Submissão do Formulário
  form.onsubmit = async event => {
    event.preventDefault();
    if (!module.selected) {
      toast('Selecione uma empresa antes de salvar.', 'error');
      company.focus();
      return;
    }

    const st = form.elements.status.value;
    const pago = form.elements.pago.checked;

    if (st === 'ativa' && !pago) {
      toast('Atenção: Para manter o status "Ativa", é obrigatório confirmar que o pagamento foi recebido.', 'error');
      form.elements.pago.focus();
      return;
    }

    save.disabled = true;
    notice.textContent = '';

    try {
      const { error } = await db.rpc('admin_salvar_assinatura_viva_oferta', {
        p_guia_id: module.selected,
        p_periodo: form.elements.periodo.value,
        p_status: form.elements.status.value,
        p_inicio: form.elements.inicio.value,
        p_validade: form.elements.validade.value,
        p_pago: pago,
        p_oferta: form.elements.oferta.checked && form.elements.status.value === 'ativa'
      });

      if (error) throw error;

      if (await refresh()) {
        await load();
        toast('✅ Assinatura e vigência salvas com sucesso!');
      }
    } catch (error) {
      notice.textContent = error.message;
      toast(`Erro ao salvar: ${error.message}`, 'error');
    } finally {
      if (module.active) save.disabled = !module.selected;
    }
  };

  if (await refresh()) await load();
}

export function unmount() {
  mountVersion++;
  if (!currentMount) return;
  currentMount.active = false;
  currentMount.request++;
  currentMount.style?.remove();
  if (currentMount.container?.dataset.module === 'viva_assinaturas') {
    delete currentMount.container.dataset.module;
  }
  currentMount = null;
}

if (document.body.classList.contains('viva-subscriptions-admin')) {
  mount(document.querySelector('.viva-admin-content') || document.body);
}
