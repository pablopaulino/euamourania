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
  const updateCount=()=>document.querySelector('#count').textContent=`${form.elements.descricao.value.length}/1000`;
  form.elements.descricao.addEventListener('input',updateCount);updateCount();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('[type=submit]');button.disabled=true;
    try{
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
