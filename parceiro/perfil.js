import {acesso,salvar,notice} from './_layout.js';

if(acesso?.guia){
  const g=acesso.guia;
  const form=document.querySelector('#form');
  const keys=['descricao','whatsapp','telefone','instagram','facebook','site','endereco','mapa_url'];
  for(const key of keys)form.elements[key].value=g[key]||'';
  document.querySelector('#profile-name').textContent=g.nome||'Sua empresa';
  document.querySelector('#profile-category').textContent=g.categoria_nome||'Guia Comercial';
  if(g.imagem_url){
    const cover=document.querySelector('#profile-cover');cover.src=g.imagem_url;cover.classList.add('business-cover');
  }
  if(g.status==='publicado'&&g.slug){
    const link=document.querySelector('#profile-public-link');
    link.href=`/guia/${encodeURIComponent(g.slug)}`;link.hidden=false;
  }
  const updateCount=()=>document.querySelector('#count').textContent=`${form.elements.descricao.value.length}/1000`;
  form.elements.descricao.addEventListener('input',updateCount);updateCount();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('[type=submit]');button.disabled=true;
    try{
      const dados=Object.fromEntries(new FormData(form));
      if(dados.whatsapp&&!/^55\d{10,11}$/.test(dados.whatsapp.replace(/\D/g,'')))throw Error('WhatsApp deve incluir 55 e DDD.');
      dados.whatsapp=dados.whatsapp.replace(/\D/g,'');
      if(dados.site&&!/^https?:\/\//i.test(dados.site))dados.site='https://'+dados.site;
      await salvar(dados);
      form.elements.whatsapp.value=dados.whatsapp;
      form.elements.site.value=dados.site;
    }catch(error){notice(error.message,true);}
    finally{button.disabled=false;}
  });
}
