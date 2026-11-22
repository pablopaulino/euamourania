import { exigirPermissao, temPermissao } from './auth.js';
import { getSupabase } from '../assets/js/services/supabaseClient.js';

const app = document.getElementById('editorial-app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value ? new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) : '—';
const safeLink = value => { try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
const scopeName = scope => scope==='regional_nacional'?'Regional/Nacional':'Local — Urânia';
function classificacao(source={}) {
  return `<label>Confiabilidade <select name="confiabilidade"><option value="portal">Portal</option><option value="oficial" ${source.confiabilidade==='oficial'?'selected':''}>Oficial</option></select></label>
    <label>Escopo <select name="escopo"><option value="local">Local — Urânia</option><option value="regional_nacional" ${source.escopo==='regional_nacional'?'selected':''}>Regional/Nacional</option></select></label>`;
}
function listaPautas(items) {
  return items.map(p=>`<article><h3>${esc(p.noticias?.titulo||p.titulo||'Pauta anterior')}</h3>
    <p>${scopeName(p.escopo)} · ${esc(p.estado_triagem)} · ${esc(p.relevancia)}</p>
    <ul>${(p.fontes||[]).filter(f=>safeLink(f.url)).map(f=>`<li><a href="${esc(safeLink(f.url))}" target="_blank" rel="noopener noreferrer">${esc(f.titulo||f.url)}</a> · ${date(f.publicado_em)}</li>`).join('')}</ul>
    ${p.noticia_id?`<p><a href="/admin/noticias">Abrir lista de notícias para revisar pelo título</a> · ${p.revisao_reforcada?'Revisão reforçada':'Revisão necessária'}</p><p>${esc((p.pendencias||[]).join(' · '))}</p>`:''}
    ${['legenda_imagem','prompt_imagem'].filter(k=>p[k]).map(k=>`<div><strong>${k==='legenda_imagem'?'Legenda sugerida':'Prompt de imagem'}</strong><p>${esc(p[k])}</p><button type="button" data-copy>Copiar</button></div>`).join('')}
  </article>`).join('')||'<p>Nenhuma pauta registrada nesta execução.</p>';
}
const access = await exigirPermissao('noticias','ler');
if (access) {
  const db=getSupabase(), canEdit=temPermissao(access.admin,'noticias','editar');
  async function render() {
    const [sources,runs,items,settings]=await Promise.all([
      db.from('editorial_fontes').select('*').order('prioridade',{ascending:false}),
      db.from('editorial_execucoes').select('*').order('iniciada_em',{ascending:false}).limit(30),
      db.from('editorial_pautas').select('*,noticias(id,titulo,status,status_editorial)').order('criado_em',{ascending:false}).limit(150),
      db.from('editorial_configuracao').select('*').eq('id',1).single()
    ]);
    const error=[sources,runs,items,settings].find(x=>x.error)?.error;
    if(error){app.textContent='Não foi possível carregar a área editorial. Verifique se a migração foi instalada e se sua conta possui permissão.';return;}
    const cfg=settings.data;
    app.innerHTML=`<section class="panel"><h2>Rotina editorial</h2><p>Estado: <strong>${cfg.ativa?'Ativa':'Pausada'}</strong>. Agendamento diário às 9h de São Paulo, sujeito à janela da hospedagem. Publicação sempre depende de revisão humana.</p>${canEdit?`<form id="config-form" class="cms-form"><label>Frequência, em dias <input name="intervalo_dias" type="number" min="1" max="30" required value="${cfg.intervalo_dias}"></label><label>Limite de pautas <input name="limite_pautas" type="number" min="1" max="5" required value="${Math.min(5,cfg.limite_pautas)}"></label><label>Rascunhos por execução <select name="limite_materias"><option value="1">1 local</option><option value="2" ${cfg.limite_materias===2?'selected':''}>2 — um local e um regional/nacional</option></select></label><button class="admin-button">Salvar configurações</button><button type="button" class="admin-button secondary" id="routine-toggle">${cfg.ativa?'Pausar':'Ativar'}</button><button type="button" class="admin-button secondary" id="run-now">Executar agora</button></form>`:''}<p id="routine-feedback" role="status"></p></section><section class="panel"><h2>Fontes monitoradas</h2><p>Cadastre fontes que você conferiu; fontes novas começam desativadas.</p>
      ${canEdit?`<form id="source-form" class="cms-form"><label>Nome <input name="nome" required maxlength="200"></label><label>Endereço HTTPS <input name="url" type="url" required></label><label>Tipo <select name="tipo"><option value="site">Site</option><option value="pagina">Página</option><option value="rss">RSS</option></select></label>${classificacao()}<label>Prioridade (0 a 100) <input name="prioridade" type="number" min="0" max="100" value="50" required></label><button class="admin-button">Cadastrar fonte</button></form>`:''}
      <ul>${sources.data.map(s=>`<li><strong>${esc(s.nome)}</strong> — ${esc(s.tipo)} · ${esc(s.confiabilidade)} · ${scopeName(s.escopo)} · prioridade ${s.prioridade} · ${s.ativa?'ativa':'inativa'} ${safeLink(s.url)?`<a href="${esc(safeLink(s.url))}" target="_blank" rel="noopener noreferrer">Abrir fonte</a>`:''} ${canEdit?`<form class="cms-form" data-source="${esc(s.id)}">${classificacao(s)}<button>Salvar classificação</button></form><button class="admin-button secondary" data-toggle="${esc(s.id)}" data-active="${s.ativa}">${s.ativa?'Desativar':'Ativar'}</button>`:''}</li>`).join('')||'<li>Nenhuma fonte cadastrada.</li>'}</ul><p id="feedback" role="status"></p></section>
      <section class="panel"><h2>Pautas da última execução</h2>${listaPautas(items.data.filter(p=>p.execucao_id===runs.data[0]?.id))}</section>
      <section class="panel"><h2>Histórico</h2>${runs.data.map(r=>`<details><summary>${date(r.iniciada_em)} · ${esc(r.estado)}</summary><p>${esc(r.resumo)}</p>${listaPautas(items.data.filter(p=>p.execucao_id===r.id))}</details>`).join('')||'<p>Nenhuma execução.</p>'}</section>`;
    for(const form of app.querySelectorAll('[data-source]')) form.onsubmit=async event=>{
      event.preventDefault();
      const fields=Object.fromEntries(new FormData(form));
      const {error}=await db.from('editorial_fontes').update(fields).eq('id',form.dataset.source);
      if(error) app.querySelector('#feedback').textContent='Falha ao salvar a classificação.';
      else await render();
    };
    for(const button of app.querySelectorAll('[data-copy]')) button.onclick=async()=>{
      try {await navigator.clipboard.writeText(button.previousElementSibling.textContent);button.textContent='Copiado';}
      catch {button.textContent='Selecione o texto acima para copiar';}
    };
    app.querySelector('#config-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const {error}=await db.from('editorial_configuracao').update({intervalo_dias:Number(f.elements.intervalo_dias.value),limite_pautas:Number(f.elements.limite_pautas.value),limite_materias:Number(f.elements.limite_materias.value)}).eq('id',1);if(error)app.querySelector('#routine-feedback').textContent='Não foi possível salvar as configurações.';else await render();});
    app.querySelector('#routine-toggle')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;const {error}=await db.from('editorial_configuracao').update({ativa:!cfg.ativa}).eq('id',1);if(error){app.querySelector('#routine-feedback').textContent='Não foi possível alterar o estado da rotina.';button.disabled=false;}else await render();});
    app.querySelector('#run-now')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;app.querySelector('#routine-feedback').textContent='Executando pesquisa e apuração…';try{const {data:{session}}=await db.auth.getSession();if(!session?.access_token)throw new Error('Sessão expirada.');const response=await fetch('/api/automacao-editorial',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}});const result=await response.json();if(!response.ok)throw new Error(result.error||'Falha na execução.');await render();app.querySelector('#routine-feedback').textContent=result.resumo||'Execução concluída.';}catch(error){const message=error.message||'Falha na execução.';await render();const feedback=app.querySelector('#routine-feedback');if(feedback)feedback.textContent=message;}});
    app.querySelector('#source-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,button=e.submitter;let url=safeLink(f.elements.url.value);if(!url){app.querySelector('#feedback').textContent='Informe um endereço HTTPS válido, sem credenciais.';return;}button.disabled=true;const {error}=await db.from('editorial_fontes').insert({nome:f.elements.nome.value.trim(),url,confiabilidade:f.elements.confiabilidade.value,escopo:f.elements.escopo.value,tipo:f.elements.tipo.value,prioridade:Number(f.elements.prioridade.value),ativa:false});if(error){app.querySelector('#feedback').textContent='Não foi possível cadastrar a fonte. Verifique se já existe e tente novamente.';button.disabled=false;}else await render();});
    app.querySelectorAll('[data-toggle]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;const {error}=await db.from('editorial_fontes').update({ativa:button.dataset.active!=='true'}).eq('id',button.dataset.toggle);if(error){app.querySelector('#feedback').textContent='Não foi possível atualizar a fonte.';button.disabled=false;}else await render();}));
  }
  await render();
}
