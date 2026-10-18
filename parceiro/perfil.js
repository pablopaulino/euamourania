import { verifiedBadge } from "/assets/js/viva-verified.js";
import {isOpen} from './hours.js';
import {acesso,db,salvar,notice} from './_layout.js';

if(acesso?.guia){
  const g=acesso.guia;
  const form=document.querySelector('#form');
  const keys=['descricao','whatsapp','telefone','instagram','facebook','site','endereco','mapa_url'];
  for(const key of keys)form.elements[key].value=g[key]||'';
  document.querySelector('#profile-name').textContent=g.nome||'Sua empresa';
  const category=form.elements.categoria_id;
  const originalCategory=String(g.categoria_id||'');
  category.replaceChildren();
  const currentOption=new Option(g.categoria_nome||'Escolha a categoria',originalCategory);
  category.add(currentOption);
  const {data:categories,error:categoryError}=await db.from('categorias').select('id,nome').eq('tipo','guia').eq('status','ativo').order('nome');
  if(categoryError){category.disabled=true;notice('Não foi possível carregar as categorias. Os outros dados continuam editáveis.',true);}
  else for(const item of categories||[]){
    if(item.id!==originalCategory)category.add(new Option(item.nome,item.id));
  }
  if(g.imagem_url){
    const cover=document.querySelector('#profile-cover');cover.src=g.imagem_url;cover.classList.add('business-cover');
  }
  if(g.status==='publicado'&&g.slug){
    const link=document.querySelector('#profile-public-link');
    link.href=`https://euamourania.com.br/guia/${encodeURIComponent(g.slug)}`;link.hidden=false;
  }
  const instagram=form.elements.instagram;
  const cleanInstagram=value=>value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/^@+/,'').split(/[/?#]/)[0];
  instagram.value=cleanInstagram(instagram.value);
  instagram.addEventListener('blur',()=>{instagram.value=cleanInstagram(instagram.value);preview();});
  const publicUrl=g.status==='publicado'&&g.slug?'https://euamourania.com.br/guia/'+encodeURIComponent(g.slug):null;
  const copy=document.querySelector('#copy-profile-link');copy.hidden=!publicUrl;
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(publicUrl);notice('Link copiado!');}catch{notice('Não foi possível copiar. Abra “Ver no Guia” e copie o endereço.',true);}};
  document.querySelector('#preview-name').textContent=g.nome;
  document.querySelector('#preview-name').insertAdjacentHTML('beforeend', verifiedBadge(acesso.plano?.ativo));
  if(g.imagem_url)document.querySelector('#preview-cover').src=g.imagem_url;
  function preview(){
    document.querySelector('#preview-category').textContent=category.selectedOptions[0]?.textContent||'Categoria';
    document.querySelector('#preview-description').textContent=form.elements.descricao.value||'Conte um pouco sobre sua empresa.';
    const status=document.querySelector('#preview-status'),open=isOpen(g.opening_hours);status.textContent=open?'Aberta agora':'Fechada agora';status.classList.toggle('is-open',open);
    document.querySelectorAll('[data-contact]').forEach(el=>{const filled=Boolean(form.elements[el.dataset.contact].value.trim());el.classList.toggle('available',filled);el.setAttribute('aria-label',el.textContent+(filled?': preenchido':': não informado'));});
    const checks=[Boolean(g.imagem_url),Boolean(category.value),Boolean(form.elements.descricao.value.trim()),Boolean(form.elements.whatsapp.value.trim()),Boolean(form.elements.endereco.value.trim()),Boolean(instagram.value.trim()||form.elements.mapa_url.value.trim())];
    const percent=Math.round(checks.filter(Boolean).length/checks.length*100);document.querySelector('#profile-progress').value=percent;document.querySelector('#profile-percent').textContent=percent+'%';
    const tips=['Adicione uma capa na aba Fotos.','Escolha a categoria da sua empresa.','Descreva o que sua empresa oferece.','Informe o WhatsApp para facilitar o contato.','Complete o endereço para ajudar clientes a encontrar você.','Inclua Instagram ou mapa para completar sua vitrine.'];
    document.querySelector('#profile-tip').textContent=checks.every(Boolean)?'Vitrine completa! Mantenha as informações atualizadas.':tips[checks.indexOf(false)];
    const map=document.querySelector('#test-map');let url;try{url=new URL(form.elements.mapa_url.value);}catch{}map.hidden=!url||!['https:','http:'].includes(url.protocol);if(!map.hidden)map.href=url.href;else map.removeAttribute('href');
  }
  form.addEventListener('input',preview);form.addEventListener('change',preview);preview();
  const previewTimer=setInterval(preview,60000);window.addEventListener('pagehide',()=>clearInterval(previewTimer),{once:true});
  const updateCount=()=>document.querySelector('#count').textContent=`${form.elements.descricao.value.length}/1000`;
  form.elements.descricao.addEventListener('input',updateCount);updateCount();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('[type=submit]');button.disabled=true;
    try{
      instagram.value=cleanInstagram(instagram.value);
      const dados=Object.fromEntries(new FormData(form));
      if(dados.categoria_id===originalCategory||!dados.categoria_id)delete dados.categoria_id;
      if(dados.whatsapp){
        const raw=dados.whatsapp.trim();
        let number=raw;
        if(/^https?:\/\//i.test(raw)){
          const url=new URL(raw);
          const host=url.hostname.toLowerCase();
          if(host==='wa.me'||host==='www.wa.me')number=url.pathname.slice(1);
          else if(host==='api.whatsapp.com'||host==='www.api.whatsapp.com')number=url.searchParams.get('phone')||'';
          else throw Error('Use um número ou link do WhatsApp (wa.me).');
        }
        number=number.replace(/\D/g,'');
        if(/^\d{10,11}$/.test(number))number='55'+number;
        if(!/^55\d{10,11}$/.test(number))throw Error('WhatsApp deve incluir 55, DDD e número.');
        dados.whatsapp=number;
      }
      if(dados.site&&!/^https?:\/\//i.test(dados.site))dados.site='https://'+dados.site;
      await salvar(dados);
      form.elements.whatsapp.value=dados.whatsapp;
      form.elements.site.value=dados.site;
    }catch(error){notice(error.message,true);}
    finally{button.disabled=false;}
  });
}
