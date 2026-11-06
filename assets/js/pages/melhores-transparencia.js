const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => new Intl.NumberFormat('pt-BR').format(n);
const percent = n => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 6}).format(Number(n)) + '%';
const available = row => ['votos_site','votos_instagram','percentual_site','percentual_instagram','pontuacao_final'].every(k => row[k] !== null && row[k] !== undefined && Number.isFinite(Number(row[k])));

export function agruparResultados(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.categoria_id)) groups.set(row.categoria_id, []);
    groups.get(row.categoria_id).push(row);
  }
  for (const group of groups.values()) group.sort ( (a,b) => Number(a.colocacao) - Number(b.colocacao));
  return groups;
}

function categoria(rows, edition) {
  const complete = rows.every(available);
  const digital = complete ? rows.reduce((sum,r) => sum + Number(r.votos_site), 0) : null;
  const instagram = complete ? rows.reduce((sum,r) => sum + Number(r.votos_instagram), 0) : null;
  return `<section class="trans-category" data-category="${esc(rows[0].categoria_id)}"><h3>${esc(rows[0].melhores_categorias?.nome || 'Categoria')}</h3>${complete ? `<p>${num(digital + instagram)} votos contabilizados · ${num(digital)} aplicativo + site · ${num(instagram)} Instagram</p>` : '<p>Os números da apuração não foram disponibilizados publicamente.</p>'}<ol class="trans-ranking">${rows.map(r => {
    const nome = esc(r.melhores_indicados?.nome || 'Indicado');
    const score = available(r) ? Number(r.pontuacao_final) : null;
    const description = score === null ? 'Pontuação não disponível' : `${percent(score)} de pontuação ponderada; ${num(Number(r.votos_site))} votos no aplicativo e site; ${num(Number(r.votos_instagram))} no Instagram`;
    const previous = rows[rows.indexOf(r) - 1];
    const gap = previous && available(previous) && score !== null ? Number(previous.pontuacao_final) - score : null;
    return `<li class="${r.vencedor ? 'trans-winner' : ''}"><div class="trans-row"><strong>${esc(r.colocacao)}º · ${nome}${r.vencedor ? ' <span>Vencedor</span>' : ''}</strong><b>${score === null ? '—' : percent(score)}</b></div>${score === null ? '' : `<div class="trans-track" tabindex="0" role="img" aria-label="${esc(description)}" title="${esc(description)}"><i style="width:${Math.max(0,Math.min(100,score))}%"></i></div><small>${num(Number(r.votos_site))} aplicativo + site (${percent(r.percentual_site)}) · ${num(Number(r.votos_instagram))} Instagram (${percent(r.percentual_instagram)}) · ${num(Number(r.votos_site)+Number(r.votos_instagram))} no total${gap !== null ? ` · Diferença para a posição anterior: ${percent(gap).replace('%', '')} p.p.` : ''}</small><details class="trans-memory"><summary>Memória de cálculo</summary><dl><div><dt>Classificação oficial</dt><dd>${esc(r.colocacao)}º</dd></div><div><dt>Participação no aplicativo + site</dt><dd>${percent(r.percentual_site)}</dd></div><div><dt>Participação no Instagram</dt><dd>${percent(r.percentual_instagram)}</dd></div><div><dt>Peso do bloco aplicativo + site</dt><dd>${edition.peso_site == null ? 'Indisponível' : esc(edition.peso_site) + '%'}</dd></div><div><dt>Peso do Instagram</dt><dd>${edition.peso_instagram == null ? 'Indisponível' : esc(edition.peso_instagram) + '%'}</dd></div><div><dt>Pontuação oficial</dt><dd>${percent(score)}</dd></div></dl><p>A fonte pública não fornece participações separadas de aplicativo e site nem contribuições ponderadas por bloco. A pontuação vem do resultado oficial.</p></details>`}</li>`;
  }).join('')}</ol></section>`;
}

export function montarCentralTransparencia(container, edition, rows) {
  if (!document.getElementById('trans-styles')) {
    const link = document.createElement('link'); link.id = 'trans-styles'; link.rel = 'stylesheet'; link.href = '/assets/css/melhores-transparencia.css'; document.head.append(link);
  }
  const groups = agruparResultados(rows);
  const complete = rows.length > 0 && rows.every(available);
  const digital = complete ? rows.reduce((sum,r) => sum + Number(r.votos_site), 0) : null;
  const insta = complete ? rows.reduce((sum,r) => sum + Number(r.votos_instagram), 0) : null;
  const total = complete ? digital + insta : null;
  const date = rows.length ? (rows.find(r => r.publicado_em)?.publicado_em || edition.resultado_publicado_em) : null;
  const root = document.createElement('section'); root.className = 'trans-central'; root.id = 'transparencia';
  root.innerHTML = `<header><p class="trans-kicker">Melhores de Urânia 2026</p><h2>Central de Resultados e Transparência</h2><p>Entenda a apuração e consulte os dados disponibilizados na publicação oficial.</p></header>
  <div class="trans-cards"><div><span>Votos contabilizados</span><strong>${total === null ? 'Indisponível' : num(total)}</strong></div><div><span>Categorias publicadas</span><strong>${rows.length ? num(groups.size) : '—'}</strong></div><div><span>Indicados no resultado</span><strong>${rows.length ? num(rows.length) : '—'}</strong></div><div><span>Publicação oficial</span><strong>${date ? esc(new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(date))) : 'Aguardando'}</strong></div></div>
  ${rows.length ? `<div class="trans-tools"><label for="trans-select">Categoria</label><select id="trans-select">${[...groups].map(([id,g]) => `<option value="${esc(id)}">${esc(g[0].melhores_categorias?.nome || 'Categoria')}</option>`).join('')}</select><button type="button" data-share>Compartilhar categoria</button><button type="button" data-print="category">Imprimir categoria / PDF</button><button type="button" data-print="all">Imprimir relatório completo / PDF</button><span role="status" data-status></span></div><div class="trans-categories">${[...groups.values()].map(group => categoria(group, edition)).join('')}</div>` : '<p class="trans-note">A apuração será apresentada após a publicação oficial dos resultados.</p>'}
  <section><h3>Comparativo dos canais</h3>${complete ? `<p>Do total de ${num(total)} votos contabilizados, ${num(digital)} vieram do aplicativo e site (${total ? percent(digital/total*100) : '0%'}) e ${num(insta)} do Instagram (${total ? percent(insta/total*100) : '0%'}).</p><p>A fonte oficial reúne aplicativo e site no mesmo bloco; a separação entre eles não está disponível aqui.</p>` : '<p>Os totais por canal ainda não estão disponíveis publicamente.</p>'}</section>
  <section><h3>Metodologia oficial de apuração</h3><p>Em cada categoria, os votos válidos do aplicativo e do site formam o bloco digital. A participação de cada indicado nesse bloco tem peso de ${edition.peso_site == null ? 'valor não informado' : esc(edition.peso_site) + '%'}; sua participação no Instagram tem peso de ${edition.peso_instagram == null ? 'valor não informado' : esc(edition.peso_instagram) + '%'}. A soma é a pontuação final. A quantidade de votos e a pontuação ponderada são medidas diferentes.</p><p>As contribuições ponderadas por bloco não são disponibilizadas na fonte pública. Os percentuais e a pontuação final exibidos vêm do banco.</p><p>Quando um bloco não tem votos, sua contribuição é zero. A classificação segue a pontuação oficial. Em empate na liderança, a publicação exige decisão e regra registradas; em seguida, a rotina usa votos do bloco digital, votos do Instagram e nome para ordenação. Uma categoria sem votos não pode ser publicada pela rotina atual.</p></section>
  <details class="trans-panel"><summary>Integridade e relatório de apuração</summary><p>Os totais contabilizados representam votos válidos do bloco aplicativo + site e os totais registrados para o Instagram nos resultados publicados. Os demais indicadores não são fornecidos pela fonte pública; indisponível não significa zero.</p><dl class="trans-integrity"><div><dt>Votos contabilizados nos resultados</dt><dd>${total === null ? 'Indisponível' : num(total)}</dd></div><div><dt>Total recebido, incluindo descartes</dt><dd>Indisponível</dd></div><div><dt>Votos desconsiderados</dt><dd>Indisponível</dd></div><div><dt>Duplicados identificados</dt><dd>Indisponível</dd></div><div><dt>Registros rejeitados</dt><dd>Indisponível</dd></div><div><dt>Correções administrativas</dt><dd>Indisponível</dd></div></dl><p>A data apresentada é a da publicação oficial, não uma atualização em tempo real.</p></details>
  <details class="trans-panel"><summary>Histórico de publicações e correções</summary><p>${date ? `Publicação oficial informada: ${esc(new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(date)))} (horário de Brasília).` : 'Nenhuma publicação oficial disponível.'}</p><p>A fonte pública não fornece versões, justificativas, responsáveis institucionais ou histórico de correções. A ausência dessas informações não comprova que não houve alterações.</p></details>
  <section><h3>Como funcionam as indicações</h3><p>Há um período próprio para indicações. Os participantes são definidos conforme as regras e critérios de elegibilidade da edição. Indicação e votação são etapas diferentes: a votação popular determina os resultados entre os indicados habilitados. A ausência de um estabelecimento não significa falta de reconhecimento ou qualidade.</p><a href="/melhores-de-urania/2026/regulamento/">Consultar o regulamento</a></section><p class="trans-print-date" data-generated></p>`;
  container.prepend(root);
  const generated = root.querySelector('[data-generated]');
  const updateGenerated = () => { if (generated) generated.textContent = 'Relatório gerado em ' + new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date()) + ' (horário de Brasília)'; };
  updateGenerated();
  const select = root.querySelector('#trans-select');
  if (!select) return;
  const query = new URL(location.href).searchParams.get('categoria');
  if (groups.has(query)) select.value = query;
  const update = () => root.querySelectorAll('.trans-category').forEach(el => el.classList.toggle('trans-selected', el.dataset.category === select.value));
  select.addEventListener('change', update); update();
  root.querySelector('[data-share]').addEventListener('click', async () => {
    const url = new URL(location.href); url.searchParams.set('categoria',select.value); url.hash = 'transparencia';
    try { if (navigator.share) await navigator.share({title:'Resultados por categoria — Melhores de Urânia 2026',url:url.href}); else { await navigator.clipboard.writeText(url.href); root.querySelector('[data-status]').textContent = 'Link copiado.'; } } catch { root.querySelector('[data-status]').textContent = 'Não foi possível compartilhar. Copie o endereço desta página.'; }
  });
  root.querySelectorAll('[data-print]').forEach(button => button.addEventListener('click', () => {
    root.classList.toggle('trans-print-all',button.dataset.print === 'all');
    updateGenerated();
    const closed = [...root.querySelectorAll('details:not([open])')];
    closed.forEach(item => { item.open = true; });
    try { window.print(); } finally { closed.forEach(item => { item.open = false; }); }
  }));
}
