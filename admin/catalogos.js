import { temPermissao } from './auth.js';
import { attachUrlUpload } from './media-upload.js';
import { createCatalogService } from '../assets/js/services/catalogosService.js';
import { emptyCatalog, emptyProduct, newKey, statuses, sources, parseCatalog, validateCatalog, duplicateCatalog } from '../assets/js/catalog-schema.mjs';

let root, ctx, service, state, controller;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = {rascunho:'Rascunho',ativo:'Ativo',inativo:'Inativo',em_revisao:'Em revisão',desatualizado:'Desatualizado',manual:'Manual',json:'JSON',externa:'Integração externa',fixo:'Preço fixo',a_partir:'A partir de',variacoes:'Por variações',disponivel:'Disponível',indisponivel:'Indisponível temporariamente',unica:'Única',multipla:'Múltipla'};
const can = action => temPermissao(ctx?.access?.admin, 'guia_comercial', action);
const writable = () => !state.readonly && can(state.id ? 'editar' : 'criar');
const button = (action,label,extra='') => `<button type="button" class="admin-button secondary" data-catalog-action="${action}" ${extra}>${label}</button>`;
const modelDownload = '<a class="admin-button secondary" href="/modelos/catalogo-exemplo-v1.json" download="modelo-catalogo-viva-v1.json">Baixar modelo JSON</a>';
const date = v => v ? new Date(v).toLocaleString('pt-BR') : '—';
const get = path => path.split('.').reduce((v,k)=>v?.[k],state.doc);
const field = (path,label,type='text',extra='') => `<label>${label}<input data-path="${path}" type="${type}" value="${esc(get(path))}" ${extra}></label>`;
const select = (path,label,values) => `<label>${label}<select data-path="${path}">${values.map(v=>`<option value="${v}" ${get(path)===v?'selected':''}>${labels[v]||v}</option>`).join('')}</select></label>`;
const check = (path,label) => `<label class="catalog-check"><input data-path="${path}" type="checkbox" ${get(path)?'checked':''}>${label}</label>`;
const money = (path,label) => `<label>${label}<input data-path="${path}" data-money type="number" min="0" max="1000000" step="0.01" value="${get(path)==null?'':(get(path)/100).toFixed(2)}"><small>Em reais; armazenado em centavos.</small></label>`;
const companies = chosen => state.companies.map(x=>`<option value="${x.id}" ${x.id===chosen?'selected':''}>${esc(x.nome)}</option>`).join('');
const companyName = id => state.companies.find(x=>x.id===id)?.nome || 'Empresa';
function notice(error) { if(root) {const target=root.querySelector('[data-catalog-message]'); if(target){target.textContent=error.message||error;target.focus();} ctx.toast?.(error.message||error,'error');} }
async function busy(task) {
  if(state.busy)return;
  const current=state; state.busy=true; root?.setAttribute('aria-busy','true');
  root?.querySelectorAll('fieldset').forEach(el=>el.disabled=true);
  root?.querySelectorAll('[data-catalog-action],button[type=submit]').forEach(b=>b.disabled=true);
  try { await task(); } catch(e) { notice(e); }
  finally { if(state===current && root){state.busy=false;root.removeAttribute('aria-busy');root.querySelectorAll('fieldset').forEach(el=>el.disabled=false);root.querySelectorAll('[data-catalog-action],button[type=submit]').forEach(b=>b.disabled=false);} }
}
async function loadList() {
  const current=state;
  const [items, firms]=await Promise.all([service.list(),service.companies()]);
  if(state!==current||!root)return;
  state.items=items; state.companies=firms; render();
}
function render() {
  if(!root)return;
  root.innerHTML=`<section class="admin-page catalog-admin"><p data-catalog-message class="form-message" role="status" tabindex="-1"></p>${state.doc?editor():listing()}</section>`;
  if(state.doc && !writable()) {
    root.querySelectorAll('input,textarea,select:not([data-category])').forEach(el=>el.disabled=true);
    root.querySelectorAll('fieldset [data-catalog-action]:not([data-catalog-action="product"])').forEach(el=>el.hidden=true);
  }
  if(state.doc && writable()) root.querySelectorAll('[data-catalog-image]').forEach(input=>attachUrlUpload(input,'catalogos','square'));
}
function listing() {
  return `<header class="admin-page-header"><div><h2>Catálogos</h2><p>Produtos e opções das empresas do Guia. Área administrativa, ainda sem exibição pública.</p></div><div class="catalog-actions">${can('criar')?button('new','Criar catálogo')+button('import','Importar JSON'):''}${modelDownload}</div></header>
  <div class="catalog-filters"><label>Buscar<input data-filter="search" placeholder="Empresa ou catálogo" value="${esc(state.search)}"></label><label>Empresa<select data-filter="company"><option value="">Todas</option>${companies(state.company)}</select></label><label>Status<select data-filter="status"><option value="">Todos</option>${statuses.map(v=>`<option value="${v}" ${state.status===v?'selected':''}>${labels[v]}</option>`).join('')}</select></label><label>Origem<select data-filter="source"><option value="">Todas</option>${sources.map(v=>`<option value="${v}" ${state.source===v?'selected':''}>${labels[v]}</option>`).join('')}</select></label></div>
  <div data-catalog-rows>${rows()}</div>`;
}
function rows() {
  const items=state.items.filter(x=>(!state.company||x.empresa_id===state.company)&&(!state.status||x.status===state.status)&&(!state.source||x.source===state.source)&&(`${x.name} ${companyName(x.empresa_id)}`.toLocaleLowerCase('pt-BR').includes(state.search.toLocaleLowerCase('pt-BR'))));
  if(!items.length)return '<div class="catalog-empty">Nenhum catálogo encontrado. Crie um catálogo ou ajuste os filtros.</div>';
  return `<div class="table-wrap"><table class="admin-table"><thead><tr><th>Empresa / catálogo</th><th>Status / origem</th><th>Conteúdo</th><th>Atualização / sincronização</th><th>Ações</th></tr></thead><tbody>${items.map(x=>`<tr><td><strong>${esc(x.name)}</strong><small>${esc(companyName(x.empresa_id))}</small></td><td>${labels[x.status]}<small>${labels[x.source]}</small></td><td>${x.catalogo_categorias?.[0]?.count||0} categorias<small>${x.catalogo_produtos?.[0]?.count||0} produtos</small></td><td>${date(x.updated_at)}<small>Sincronização: ${date(x.last_synced_at)}</small></td><td><div class="catalog-actions">${button('view','Visualizar',`data-id="${x.id}"`)}${can('editar')?button('edit','Editar',`data-id="${x.id}"`)+button('deactivate','Desativar',`data-id="${x.id}"`):''}${can('criar')?button('duplicate','Duplicar',`data-id="${x.id}"`):''}${can('excluir')?button('delete','Excluir',`data-id="${x.id}"`):''}</div></td></tr>`).join('')}</tbody></table></div><p>${items.length} catálogo(s).</p>`;
}
function editor() {
  const c=state.doc.catalog;
  const cats=c.categories;
  const cat=cats[state.category];
  const editable=writable();
  return `<header class="admin-page-header"><div><h2>${state.id?esc(c.name):'Novo catálogo'}</h2><p>${state.readonly?'Somente leitura.':'Alterações ficam no editor até clicar em Salvar catálogo.'} ${state.revision?`Revisão ${state.revision}.`:''}</p></div><div class="catalog-actions">${button('back','Voltar')}${button('export','Exportar JSON')}${editable?button('import','Importar JSON'):''}${modelDownload}</div></header>
  <form data-catalog-form><fieldset><section class="catalog-section"><h3>Dados gerais</h3><div class="catalog-grid"><label>Empresa<select data-company required ${state.id?'disabled':''}><option value="">Selecione uma empresa</option>${companies(state.empresa)}</select></label>${field('catalog.name','Nome','text','required maxlength="180"')}${select('catalog.status','Status',statuses)}${select('catalog.source','Origem',sources)}${field('catalog.order','Ordem','number','min="0" max="1000000" required')}<label>Descrição<textarea data-path="catalog.description" maxlength="5000">${esc(c.description)}</textarea></label></div><details><summary>Identificação e revisão</summary><div class="catalog-grid"><label>Identificador estável<input readonly value="${esc(c.key)}"></label>${field('catalog.external_id','Identificador externo','text','maxlength="200"')}<label>Última revisão<input readonly value="${date(c.last_reviewed_at)}"></label><label>Última sincronização<input readonly value="${date(c.last_synced_at)}"></label></div>${button('reviewed','Marcar como revisado hoje')}</details></section>
  <section class="catalog-section"><div class="catalog-section-head"><h3>Categorias</h3>${editable?button('add-category','Adicionar categoria'):''}</div>${cats.map((x,i)=>`<div class="catalog-category">${field(`catalog.categories.${i}.name`,'Nome','text','required maxlength="180"')}${field(`catalog.categories.${i}.order`,'Ordem','number','required min="0" max="1000000"')}${check(`catalog.categories.${i}.active`,'Ativa')}${editable?button('remove-category','Excluir',`data-index="${i}"`):''}</div>`).join('')||'<p>Adicione a primeira categoria para cadastrar produtos.</p>'}</section>
  <section class="catalog-section"><div class="catalog-section-head"><h3>Produtos</h3>${cat&&editable?button('add-product','Adicionar produto'):''}</div><label>Categoria em edição<select data-category ${!cats.length?'disabled':''}>${cats.map((x,i)=>`<option value="${i}" ${i===state.category?'selected':''}>${esc(x.name||'Nova categoria')}</option>`).join('')}</select></label>${cat?`<div class="table-wrap"><table class="admin-table"><thead><tr><th>Produto</th><th>Preço</th><th>Disponibilidade</th><th>Ordem</th><th>Ações</th></tr></thead><tbody>${cat.products.map((p,i)=>`<tr><td>${esc(p.name||'Novo produto')}</td><td>${p.price_mode==='variacoes'?'Por variação':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((p.promo_price_cents??p.price_cents??0)/100)}</td><td>${labels[p.status]} · ${labels[p.availability]}</td><td>${p.order}</td><td>${button('product','Abrir',`data-index="${i}"`)} ${editable?button('remove-product','Excluir',`data-index="${i}"`):''}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum produto nesta categoria.</td></tr>'}</tbody></table></div>`:''}</section>
  ${cat&&state.product!=null&&cat.products[state.product]?productEditor(`catalog.categories.${state.category}.products.${state.product}`):''}</fieldset>
  ${editable?'<footer class="form-actions admin-form-actions"><p>Salvamento integral e transacional. Nada é publicado no aplicativo.</p><button type="submit" class="admin-button">Salvar catálogo</button></footer>':''}</form>`;
}
function productEditor(path) {
  const p=get(path);
  return `<section class="catalog-section" data-product-editor><h3>${esc(p.name||'Novo produto')}</h3><div class="catalog-grid">${field(path+'.name','Nome','text','required maxlength="180"')}${field(path+'.sku','SKU / código interno','text','maxlength="120"')}${select(path+'.status','Status',['ativo','inativo'])}${select(path+'.availability','Disponibilidade',['disponivel','indisponivel'])}${select(path+'.price_mode','Tipo de preço',['fixo','a_partir','variacoes'])}${money(path+'.price_cents','Preço base (R$)')}${money(path+'.promo_price_cents','Promocional (opcional)')}${field(path+'.order','Ordem','number','min="0" max="1000000" required')}<label class="catalog-wide">Descrição<textarea data-path="${path}.description" maxlength="5000">${esc(p.description)}</textarea></label>${check(path+'.accepts_notes','Aceita observações do cliente')}</div>
  <details open><summary>Imagem principal e galeria</summary><p>A primeira imagem é a principal. Use a biblioteca existente ou uma URL HTTPS pública.</p>${p.images.map((im,i)=>`<div class="catalog-image-row"><label>Imagem ${i+1}<input type="url" data-catalog-image data-path="${path}.images.${i}.url" value="${esc(im.url)}" placeholder="https://" required></label>${field(`${path}.images.${i}.alt`,'Texto alternativo','text','maxlength="500"')}${button('remove-image','Remover',`data-path-action="${path}.images" data-index="${i}"`)}</div>`).join('')}${button('add-image','Adicionar imagem',`data-path-action="${path}.images"`)}</details>
  <details><summary>Variações (${p.variants.length})</summary><p>Cada combinação possui preço absoluto. Ex.: tamanho G + cor preta. Quando o preço for por variações, deixe a promoção no cadastro da variante.</p>${p.variants.map((v,i)=>variantEditor(`${path}.variants.${i}`,i)).join('')}${button('add-variant','Adicionar variação',`data-path-action="${path}.variants"`)}</details>
  <details><summary>Opções e adicionais (${p.option_groups.length} grupos)</summary><p>Mínimo 0 = opcional; mínimo maior que zero = obrigatório. O preço de cada opção é um acréscimo.</p>${p.option_groups.map((g,i)=>groupEditor(`${path}.option_groups.${i}`,i)).join('')}${button('add-group','Adicionar grupo',`data-path-action="${path}.option_groups"`)}</details>
  <details><summary>Origem e identificação</summary><div class="catalog-grid">${field(path+'.external_id','Identificador externo','text','maxlength="200"')}${field(path+'.source','Origem / conector','text','maxlength="120"')}<label>Identificador estável<input readonly value="${esc(p.key)}"></label></div></details></section>`;
}
function variantEditor(path,i) {
  const v=get(path);
  return `<div class="catalog-subsection"><h4>Variação ${i+1}</h4><div class="catalog-grid">${field(path+'.name','Nome','text','required maxlength="180"')}${field(path+'.sku','SKU','text','maxlength="120"')}${money(path+'.price_cents','Preço (R$)')}${money(path+'.promo_price_cents','Promoção (R$)')}${field(path+'.order','Ordem','number','min="0" required')}${check(path+'.available','Disponível')}<label class="catalog-wide">Atributos (um por linha)<textarea data-attributes="${path}.attributes" placeholder="Tamanho: G&#10;Cor: Preta" required>${esc(Object.entries(v.attributes).map(([k,x])=>`${k}: ${x}`).join('\n'))}</textarea><small>Nome: valor. Cada combinação deve ser única.</small></label></div>${button('remove-variant','Excluir variação',`data-path-action="${path.split('.').slice(0,-1).join('.')}" data-index="${i}"`)}</div>`;
}
function groupEditor(path,i) {
  const g=get(path);
  return `<div class="catalog-subsection"><h4>Grupo ${i+1}</h4><div class="catalog-grid">${field(path+'.name','Nome do grupo','text','required maxlength="180"')}${select(path+'.selection','Seleção',['unica','multipla'])}${field(path+'.min','Mínimo','number','min="0" max="100" required')}${field(path+'.max','Máximo','number','min="1" max="100" required')}${field(path+'.order','Ordem','number','min="0" required')}</div>${g.options.map((o,j)=>`<div class="catalog-option"><div class="catalog-grid">${field(`${path}.options.${j}.name`,'Opção','text','required maxlength="180"')}${money(`${path}.options.${j}.price_cents`,'Acréscimo (R$)')}${field(`${path}.options.${j}.order`,'Ordem','number','min="0" required')}${check(`${path}.options.${j}.available`,'Disponível')}</div>${button('remove-option','Excluir opção',`data-path-action="${path}.options" data-index="${j}"`)}</div>`).join('')}<div class="catalog-actions">${button('add-option','Adicionar opção',`data-path-action="${path}.options"`)}${button('remove-group','Excluir grupo',`data-path-action="${path.split('.').slice(0,-1).join('.')}" data-index="${i}"`)}</div></div>`;
}
function set(path,value) { const keys=path.split('.'),last=keys.pop();const parent=keys.reduce((v,k)=>v[k],state.doc);parent[last]=value;state.dirty=true; }
function input(event) {
  const el=event.target;
  if(el.dataset.filter){state[el.dataset.filter]=el.value;root.querySelector('[data-catalog-rows]').innerHTML=rows();return;}
  if(!writable())return;
  if(el.hasAttribute('data-company')){state.empresa=el.value;state.dirty=true;}
  if(el.dataset.path){let value=el.type==='checkbox'?el.checked:el.value;if(el.type==='number')value=el.value===''?null:el.hasAttribute('data-money')?Math.round(Number(el.value)*100):Number(el.value);set(el.dataset.path,value);if(el.dataset.path.endsWith('.price_mode')){const parent=el.dataset.path.slice(0,-'.price_mode'.length);if(value==='variacoes'){set(parent+'.price_cents',null);set(parent+'.promo_price_cents',null);}else if(get(parent+'.price_cents')==null)set(parent+'.price_cents',0);const opened=[...root.querySelectorAll('details')].map(x=>x.open);render();root.querySelectorAll('details').forEach((x,i)=>x.open=opened[i]??false);}}
  if(el.dataset.attributes){const attrs=Object.create(null);let valid=true;for(const line of el.value.split('\n').filter(x=>x.trim())){const colon=line.indexOf(':');const key=line.slice(0,colon).trim();if(colon<1||!line.slice(colon+1).trim()||Object.hasOwn(attrs,key)){valid=false;break;}attrs[key]=line.slice(colon+1).trim();}el.setCustomValidity(valid?'':'Use um atributo por linha: Nome: valor, sem nomes repetidos.');if(valid)set(el.dataset.attributes,attrs);}
}
function start(doc=emptyCatalog(),record={}) { state.doc=doc;state.id=record.id||null;state.revision=record.revision||null;state.empresa=record.empresa_id||state.company||'';state.category=0;state.product=null;state.readonly=!!record.readonly;state.dirty=!record.id;render(); }
async function action(event) {
  const b=event.target.closest('[data-catalog-action]');if(!b||state.busy)return;
  const act=b.dataset.catalogAction,id=b.dataset.id,index=Number(b.dataset.index),path=b.dataset.pathAction;
  if(act==='back'){if(state.dirty&&!confirm('Descartar as alterações não salvas?'))return;state.doc=null;state.dirty=false;state.id=null;state.revision=null;state.empresa='';return busy(loadList);}
  if(act==='view'||act==='edit'||act==='duplicate') {if(act==='edit'&&!can('editar')||act==='duplicate'&&!can('criar'))return;return busy(async()=>{const r=await service.load(id);if(!root)return;start(act==='duplicate'?duplicateCatalog(r.document):r.document,act==='duplicate'?{empresa_id:r.empresa_id}:{...r,readonly:act==='view'});});}
  if(act==='new'&&can('criar')){start();return;}
  if(act==='delete'&&can('excluir'))return busy(async()=>{const x=state.items.find(x=>x.id===id);if(confirm(`Excluir “${x.name}” e todos os seus produtos? Esta ação não pode ser desfeita.`)){await service.remove(id,x.revision);await loadList();ctx.toast?.('Catálogo excluído.');}});
  if(act==='deactivate'&&can('editar'))return busy(async()=>{if(!confirm('Desativar este catálogo?'))return;const r=await service.load(id);r.document.catalog.status='inativo';await service.save(r.empresa_id,r.document,r.id,r.revision);await loadList();ctx.toast?.('Catálogo desativado.');});
  if(act==='export'){try{const checked=validateCatalog(state.doc);if(!checked.valid)throw new Error(checked.errors.slice(0,20).join('\n'));const url=URL.createObjectURL(new Blob([JSON.stringify(state.doc,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`catalogo-${state.doc.catalog.key}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){notice(e);}return;}
  if(act==='import'&&(state.doc?writable():can('criar'))){openImport();return;}
  if(act==='product'&&state.doc){state.product=index;render();const editor=root.querySelector('[data-product-editor]');if(editor)window.scrollTo({top:window.scrollY+editor.getBoundingClientRect().top-96,behavior:'smooth'});return;}
  if(!state.doc||!writable())return;
  const cat=state.doc.catalog.categories[state.category];
  if(act.startsWith('remove-')){
    if(state.id&&!can('excluir')){notice('Você não possui permissão para excluir registros existentes.');return;}
    if(!confirm('Remover este item do catálogo? A remoção só será aplicada ao salvar.'))return;
    if(act==='remove-category'){state.doc.catalog.categories.splice(index,1);state.category=0;state.product=null;}
    else if(act==='remove-product'){cat.products.splice(index,1);state.product=null;}
    else get(path).splice(index,1);
  } else if(act==='add-category'){state.doc.catalog.categories.push({key:newKey(),name:'',order:state.doc.catalog.categories.length,active:true,products:[]});state.category=state.doc.catalog.categories.length-1;state.product=null;}
  else if(act==='add-product'){cat.products.push({...emptyProduct(),order:cat.products.length});state.product=cat.products.length-1;}
  else if(act==='product'){state.product=index;render();root.querySelector('[data-product-editor]')?.scrollIntoView({block:'start'});return;}
  else if(act==='add-image')get(path).push({url:'',alt:''});
  else if(act==='add-variant')get(path).push({key:newKey(),name:'',order:get(path).length,attributes:{},price_cents:0,promo_price_cents:null,sku:null,available:true});
  else if(act==='add-group')get(path).push({key:newKey(),name:'',order:get(path).length,min:0,max:1,selection:'unica',options:[]});
  else if(act==='add-option')get(path).push({key:newKey(),name:'',order:get(path).length,price_cents:0,available:true,quantity:1,product_key:null});
  else if(act==='reviewed')state.doc.catalog.last_reviewed_at=new Date().toISOString();
  else return;
  state.dirty=true;
  // Keep progressive sections open across edits; no loss of typed values.
  const opened=[...root.querySelectorAll('details')].map(x=>x.open);render();root.querySelectorAll('details').forEach((x,i)=>x.open=opened[i]??true);
}
function openImport() {
  const dialog=document.createElement('dialog');dialog.className='catalog-import';
  dialog.innerHTML=`<form method="dialog"><h2>Importar JSON · versão 1</h2><p>${state.id?'Substitui integralmente o conteúdo deste catálogo. Itens ausentes serão removidos após salvar.':'Cria um catálogo. Para atualizar um existente, abra-o primeiro e importe dentro dele.'} Os identificadores devem ser preservados.</p><label>Empresa<select name="company" required ${state.id?'disabled':''}><option value="">Selecione</option>${companies(state.empresa||state.company)}</select></label><label>Arquivo JSON<input type="file" accept=".json,application/json"></label><label>Conteúdo JSON<textarea name="json" rows="12" required spellcheck="false"></textarea></label><pre role="status" data-summary></pre><div class="catalog-actions"><button type="button" class="admin-button secondary" data-validate>Validar e resumir</button><button type="submit" class="admin-button" data-apply disabled>Carregar no editor</button><button type="button" class="admin-button secondary" data-close>Cancelar</button></div></form>`;
  root.append(dialog);dialog.showModal();let parsed=null;
  const json=dialog.querySelector('textarea'),summary=dialog.querySelector('[data-summary]'),apply=dialog.querySelector('[data-apply]');
  json.oninput=()=>{parsed=null;apply.disabled=true;summary.textContent='';};
  dialog.querySelector('input[type=file]').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5*1024*1024)throw new Error('Máximo de 5 MB.');json.value=await f.text();json.oninput();}catch(e){summary.textContent=e.message;}};
  dialog.querySelector('[data-validate]').onclick=()=>{try{parsed=parseCatalog(json.value);if(state.id&&parsed.doc.catalog.key!==state.doc.catalog.key)throw new Error('A key do catálogo importado deve ser a mesma do catálogo em edição.');const n=parsed.counts;summary.textContent=`${n.categories} categorias · ${n.products} produtos · ${n.variants} variações · ${n.groups} grupos · ${n.options} opções.\nValidação concluída. Nada foi gravado ainda.`;apply.disabled=false;}catch(e){parsed=null;apply.disabled=true;summary.textContent=e.message;}};
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();if(!parsed)return;const empresa=state.id?state.empresa:dialog.querySelector('[name=company]').value;if(!empresa)return;if(state.doc&&!confirm('Substituir o conteúdo em edição pelo JSON validado?'))return;const record={id:state.id,revision:state.revision,empresa_id:empresa};dialog.close();dialog.remove();start(parsed.doc,record);state.dirty=true;};
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
}
function guard(event) {
  if(!state?.dirty)return;
  if(event.type==='beforeunload'){event.preventDefault();event.returnValue='';return;}
  const target=event.target.closest('a,button[data-view]');
  if(target&&!root?.contains(target)&&!confirm('Sair e descartar as alterações não salvas do catálogo?')){event.preventDefault();event.stopImmediatePropagation();}
}
export async function mount(container,context) {
  root=container;ctx=context;service=createCatalogService(context.db);controller=new AbortController();
  root.classList.remove('loading');root.dataset.layout='module';
  state={items:[],companies:[],doc:null,id:null,search:'',company:new URLSearchParams(location.search).get('empresa')||'',status:'',source:'',dirty:false,busy:false,readonly:false};
  context.setPrimaryAction?.(null);
  if(!can('ler')){root.innerHTML='<p role="alert">Sem permissão para acessar catálogos.</p>';return;}
  if(!document.querySelector('link[data-catalog-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/admin/catalogos.css';css.dataset.catalogStyle='';document.head.append(css);}
  const options={signal:controller.signal};root.addEventListener('input',input,options);root.addEventListener('change',e=>{input(e);if(e.target.hasAttribute('data-category')){state.category=Number(e.target.value);state.product=null;render();}},options);root.addEventListener('click',action,options);
  root.addEventListener('submit',e=>{if(!e.target.matches('[data-catalog-form]'))return;e.preventDefault();if(!writable())return;busy(async()=>{if(!state.empresa)throw new Error('Selecione uma empresa.');const id=await service.save(state.empresa,state.doc,state.id,state.revision);if(!root)return;const r=await service.load(id);state.dirty=false;start(r.document,r);ctx.toast?.('Catálogo salvo. Nenhum conteúdo foi publicado no aplicativo.');});},options);
  window.addEventListener('beforeunload',guard,options);document.addEventListener('click',guard,{...options,capture:true});
  root.innerHTML='<section class="catalog-admin"><p data-catalog-message role="status">Carregando catálogos…</p></section>';
  try{await loadList();}catch(e){notice(e);}
}
export function unmount(){controller?.abort();root?.querySelector('dialog')?.close();ctx?.setPrimaryAction?.(null);root=null;ctx=null;state=null;}
