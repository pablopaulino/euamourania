export const vivaSubscriptionsView = `
<div class="viva-subscriptions-wrapper">
  <a class="admin-button secondary viva-back-link" id="subscription-back" href="/admin/viva-assinaturas" hidden>← Voltar para assinaturas</a>
  <!-- Topbar / Cabeçalho da Página -->
  <header class="viva-page-header">
    <div class="viva-header-content">
      <nav class="viva-breadcrumb" aria-label="Navegação estrutural">
        <span class="viva-crumb-item">Comercial</span>
        <span class="viva-crumb-separator" aria-hidden="true">/</span>
        <span class="viva-crumb-item current" aria-current="page">Assinaturas Viva</span>
      </nav>
      <div class="viva-title-group">
        <div class="viva-title-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 10h15" />
            <path d="m6 10 1-5h10l1 5" />
            <path d="M7 10v9h10v-9" />
            <path d="m9 15 2 2 4-5" />
          </svg>
        </div>
        <div>
          <div class="viva-badge-tag">Parceiros do Viva Urânia</div>
          <h1 class="viva-main-title">Assinaturas e Planos dos Parceiros</h1>
          <p class="viva-subtitle">Gerencie vigência, pagamentos, ativação do painel e renovações mensais dos comércios locais.</p>
        </div>
      </div>
    </div>
    <div class="viva-header-actions">
      <button type="button" class="admin-button secondary viva-btn-refresh" id="btn-refresh-list" title="Recarregar dados">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="viva-spin-icon">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 21h5v-5" />
        </svg>
        <span>Atualizar</span>
      </button>
    </div>
  </header>

  <!-- Métricas / Indicadores Rápidos -->
  <section class="viva-metrics-grid" aria-label="Resumo das assinaturas">
    <!-- Card Ativas -->
    <article class="viva-metric-card is-active" id="card-filter-active" role="button" tabindex="0" title="Clique para filtrar apenas assinaturas ativas">
      <div class="viva-metric-head">
        <span class="viva-metric-label">Assinaturas ativas</span>
        <div class="viva-metric-icon icon-success" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="m9 11 3 3L22 4" />
          </svg>
        </div>
      </div>
      <div class="viva-metric-body">
        <strong class="viva-metric-value" id="metric-active">—</strong>
        <span class="viva-metric-hint text-success">Vitrine e app ativos</span>
      </div>
    </article>

    <!-- Card Vencendo em 15 dias -->
    <article class="viva-metric-card is-expiring" id="card-filter-expiring" role="button" tabindex="0" title="Clique para filtrar empresas que vencem nos próximos 15 dias">
      <div class="viva-metric-head">
        <span class="viva-metric-label">Vencendo em até 15 dias</span>
        <div class="viva-metric-icon icon-warning" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
      </div>
      <div class="viva-metric-body">
        <strong class="viva-metric-value" id="metric-expiring">—</strong>
        <span class="viva-metric-hint text-warning">Priorizar contato p/ renovação</span>
      </div>
    </article>

    <!-- Card Aguardando Pagamento -->
    <article class="viva-metric-card is-pending" id="card-filter-pending" role="button" tabindex="0" title="Clique para filtrar empresas aguardando pagamento">
      <div class="viva-metric-head">
        <span class="viva-metric-label">Aguardando pagamento</span>
        <div class="viva-metric-icon icon-pending" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </div>
      </div>
      <div class="viva-metric-body">
        <strong class="viva-metric-value" id="metric-pending">—</strong>
        <span class="viva-metric-hint text-pending">Pendente de confirmação</span>
      </div>
    </article>

    <!-- Card Total Cadastros -->
    <article class="viva-metric-card is-total" id="card-filter-all" role="button" tabindex="0" title="Clique para exibir todos os estabelecimentos">
      <div class="viva-metric-head">
        <span class="viva-metric-label">Empresas no Guia</span>
        <div class="viva-metric-icon icon-neutral" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21h18" />
            <path d="M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7" />
            <path d="M19 7V4H5v3" />
            <path d="M19 21v-8a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v8" />
          </svg>
        </div>
      </div>
      <div class="viva-metric-body">
        <strong class="viva-metric-value" id="metric-total">—</strong>
        <span class="viva-metric-hint">Cadastros comerciais mapeados</span>
      </div>
    </article>
  </section>

  <!-- Lista de Assinaturas das Empresas -->
  <section class="viva-admin-panel viva-list-panel" aria-labelledby="subscription-list-title">
    <div class="viva-list-header">
      <div class="viva-list-header-info">
        <h2 id="subscription-list-title" class="viva-panel-title">Estabelecimentos Comerciais</h2>
        <p class="viva-panel-desc">Selecione uma empresa para conferir vigência, histórico ou aplicar a renovação do plano.</p>
      </div>

      <div class="viva-filters-toolbar">
        <div class="viva-search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="viva-search-icon" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input id="subscription-search" type="search" placeholder="Buscar por nome da empresa..." aria-label="Buscar por empresa" autocomplete="off">
          <button type="button" class="viva-clear-search" id="clear-search" aria-label="Limpar busca" hidden title="Limpar busca">✕</button>
        </div>

        <div class="viva-select-box">
          <select id="subscription-status" aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            <option value="ativa">Ativa</option>
            <option value="vencendo">Vencendo em 15 dias</option>
            <option value="pendente">Aguardando pagamento</option>
            <option value="pausada">Pausada</option>
            <option value="vencida">Vencida</option>
            <option value="cancelada">Cancelada</option>
            <option value="sem-plano">Sem plano cadastrado</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Tabela estilizada -->
    <div class="viva-table-container table-wrap">
      <table class="viva-data-table">
        <thead>
          <tr>
            <th scope="col" style="min-width: 240px;">Empresa</th>
            <th scope="col" style="width: 140px;">Período</th>
            <th scope="col" style="width: 120px;">Início</th>
            <th scope="col" style="width: 150px;">Validade</th>
            <th scope="col" style="width: 170px;">Status</th>
            <th scope="col" style="width: 140px; text-align: right;">Ação</th>
          </tr>
        </thead>
        <tbody id="subscription-rows">
          <tr>
            <td colspan="6" class="viva-table-loading">
              <div class="viva-loading-indicator">
                <span class="viva-loading-dot"></span>
                <span>Carregando assinaturas do Viva...</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="viva-table-footer">
      <p id="list-count" class="viva-list-count" role="status">Carregando...</p>
      <div class="viva-table-legend">
        <span class="viva-legend-item"><span class="viva-dot dot-ativa"></span> Ativa</span>
        <span class="viva-legend-item"><span class="viva-dot dot-vencendo"></span> Vencendo</span>
        <span class="viva-legend-item"><span class="viva-dot dot-vencida"></span> Vencida</span>
      </div>
    </div>
  </section>

  <!-- Área do Editor da Assinatura -->
  <div class="viva-admin-grid" id="subscription-editor">
    <form id="subscription-form" class="viva-admin-panel viva-editor-card" novalidate>

      <!-- Card informativo do Estabelecimento Selecionado -->
      <div class="viva-selected-bar" id="selected-company-bar">
        <div class="viva-selected-details">
          <div class="viva-selected-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div>
            <span class="viva-selected-kicker">Empresa em Gestão</span>
            <h3 class="viva-selected-name" id="selected-company-title">Nenhuma selecionada</h3>
            <p id="current-state" class="viva-current-state" role="status">Selecione uma empresa na tabela para começar.</p>
          </div>
        </div>
        <div class="viva-selected-status-badge" id="selected-status-badge-container"></div>
      </div>

      <!-- BOTÃO DE RENOVAÇÃO RÁPIDA (DESTAQUE PROFISSIONAL) -->
      <section class="viva-quick-renew-panel" id="quick-renew-box">
        <div class="viva-renew-head">
          <div class="viva-renew-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Renovar assinatura</span>
          </div>
          <span class="viva-renew-hint">Escolha o período, confirme o pagamento e salve. Os dias restantes são preservados.</span>
        </div>

        <div class="viva-renew-actions">
          <button type="button" class="viva-renew-btn-primary" id="quick-renew-month" title="Renovar por mais 1 mês a partir da validade atual ou de hoje">
            <span class="viva-renew-btn-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6" />
                <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
              </svg>
            </span>
            <span class="viva-renew-btn-text">
              <strong>Renovar por +1 Mês</strong>
              <small>Mensal · R$ 79,90</small>
            </span>
          </button>

          <div class="viva-renew-chips">
            <button type="button" class="viva-chip-btn" id="quick-renew-6m" title="Renovar por +6 Meses (R$ 419,90)">
              <span>+6 Meses</span>
            </button>
            <button type="button" class="viva-chip-btn" id="quick-renew-1y" title="Renovar por +1 Ano (R$ 759,90)">
              <span>+1 Ano</span>
            </button>
            <button type="button" class="viva-chip-btn secondary" id="calculate" title="Recalcula a validade pelo período selecionado no formulário">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Calcular pelo período</span>
            </button>
          </div>
        </div>
      </section>

      <!-- PASSO 01: Identificação e Período -->
      <section class="viva-form-section">
        <header class="viva-section-header">
          <span class="viva-step-badge">01</span>
          <div>
            <h2 class="viva-section-title">Empresa e Contratação</h2>
            <p class="viva-section-desc">Selecione o estabelecimento comercial e confirme o tipo de plano contratado.</p>
          </div>
        </header>

        <div class="viva-form-group">
          <label for="company" class="viva-field-label">
            <span>Estabelecimento Comercial</span>
            <span class="viva-required-mark">*</span>
          </label>
          <select id="company" required class="viva-field-control">
            <option value="">Selecione uma empresa...</option>
          </select>
        </div>

        <div class="viva-fields-grid">
          <div class="viva-form-group">
            <label for="plan-period" class="viva-field-label">Período Contratado</label>
            <select name="periodo" id="plan-period" class="viva-field-control">
              <option value="mensal">Mensal · 1 mês</option>
              <option value="semestral">Semestral · 6 meses</option>
              <option value="anual">Anual · 12 meses</option>
            </select>
          </div>

          <div class="viva-form-group">
            <label for="plan-status" class="viva-field-label">Situação do Plano</label>
            <select name="status" id="plan-status" class="viva-field-control">
              <option value="ativa">Ativa (Acesso e vitrine liberados)</option>
              <option value="pendente">Aguardando confirmação de pagamento</option>
              <option value="pausada">Pausada temporariamente</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>
      </section>

      <!-- PASSO 02: Vigência do Plano -->
      <section class="viva-form-section">
        <header class="viva-section-header">
          <span class="viva-step-badge">02</span>
          <div>
            <h2 class="viva-section-title">Vigência e Validade</h2>
            <p class="viva-section-desc">Datas de início e expiração da assinatura (fuso oficial de Brasília).</p>
          </div>
        </header>

        <div class="viva-fields-grid">
          <div class="viva-form-group">
            <label for="date-inicio" class="viva-field-label">
              <span>Data de Início</span>
              <span class="viva-required-mark">*</span>
            </label>
            <input type="date" name="inicio" id="date-inicio" required class="viva-field-control">
          </div>

          <div class="viva-form-group">
            <label for="date-validade" class="viva-field-label">
              <span>Válido até (inclusive)</span>
              <span class="viva-required-mark">*</span>
            </label>
            <input type="date" name="validade" id="date-validade" required class="viva-field-control">
          </div>
        </div>

        <div class="viva-validity-summary" id="validity-feedback" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span id="validity-feedback-text">Vigência configurada</span>
        </div>
      </section>

      <!-- PASSO 03: Confirmação de Pagamento -->
      <section class="viva-form-section">
        <header class="viva-section-header">
          <span class="viva-step-badge">03</span>
          <div>
            <h2 class="viva-section-title">Confirmação do Pagamento</h2>
            <p class="viva-section-desc">A segurança do sistema exige confirmação de recebimento para ativar o plano.</p>
          </div>
        </header>

        <label class="viva-payment-box">
          <input type="checkbox" name="pago" id="payment-confirm" class="viva-checkbox">
          <div class="viva-payment-text">
            <strong>Confirmo que o pagamento deste ciclo foi recebido</strong>
            <p>Obrigatório marcar para assinaturas no status "Ativa". O painel registra data e horário da confirmação.</p>
          </div>
        </label>
        <p class="viva-section-desc" id="metric-offer-annual">Consultando vagas da oferta anual…</p>
        <label class="viva-payment-box">
          <input type="checkbox" name="oferta_anual" class="viva-checkbox">
          <div class="viva-payment-text"><strong>Conceder oferta anual de R$ 199,90 no primeiro ano</strong><p id="offer-annual-status">Plano anual ativo com pagamento confirmado; renovação por R$ 459,00.</p></div>
        </label>
      </section>

      <section class="viva-form-section">
        <h2 class="viva-section-title">Oferta de lançamento</h2>
        <p class="viva-section-desc" id="metric-offer">Consultando vagas disponíveis…</p>
        <label class="viva-payment-box">
          <input type="checkbox" name="oferta" class="viva-checkbox">
          <div class="viva-payment-text"><strong>Conceder oferta de R$ 44,90/mês</strong><p id="offer-status">Disponível para plano mensal ativo com pagamento confirmado.</p></div>
        </label>
      </section>

      <!-- Barra de Salvamento -->
      <footer class="viva-save-footer">
        <div class="viva-save-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="viva-shield-icon">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>As alterações geram registro auditado no histórico da empresa.</span>
        </div>
        <button class="admin-button viva-save-submit" type="submit" disabled id="save-subscription-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Salvar assinatura</span>
        </button>
      </footer>
    </form>

    <!-- Barra Lateral: Histórico & Diretrizes -->
    <aside class="viva-sidebar-panels">
      <!-- Painel Histórico -->
      <section class="viva-admin-panel viva-side-card">
        <div class="viva-card-head">
          <div class="viva-card-head-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3>Histórico da Empresa</h3>
          </div>
        </div>
        <p class="viva-side-desc">Registro das últimas alterações de plano e status.</p>
        <ul id="subscription-history" class="viva-timeline-list"></ul>
      </section>

      <!-- Painel Como Funciona -->
      <section class="viva-admin-panel viva-side-card viva-info-card">
        <div class="viva-card-head">
          <div class="viva-card-head-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h3>Diretrizes do Plano Viva</h3>
          </div>
        </div>
        <ol class="viva-steps-list">
          <li><strong>Selecione o comerciante</strong> na tabela ou no formulário.</li>
          <li><strong>Clique em Renovar +1 Mês</strong> para renovação imediata ou ajuste a vigência.</li>
          <li><strong>Confirme o recebimento</strong> e clique em <em>Salvar assinatura</em>.</li>
        </ol>
        <div class="viva-note-banner">
          <small>A assinatura ativa concede acesso completo ao painel do parceiro, vitrine com selo verificado e presença no Aplicativo Viva Urânia.</small>
        </div>
      </section>
    </aside>
  </div>

  <!-- Alerta / Notificação do Rodapé -->
  <div id="notice" class="viva-form-notice" role="status" aria-live="polite"></div>
</div>
`;
