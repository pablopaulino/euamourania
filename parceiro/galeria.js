import {acesso,salvar,upload,notice} from './_layout.js';

if(acesso?.guia){
  let capa=acesso.guia.imagem_url||null;
  let extras=[...new Set(Array.isArray(acesso.guia.galeria_urls)?acesso.guia.galeria_urls.filter(Boolean):[])].filter(url=>url!==capa);
  const published=acesso.guia.status==='publicado';
  const coverEl=document.querySelector('#cover-photo');
  const grid=document.querySelector('#gallery');
  const form=document.querySelector('#photo-form');
  let saving=false;
  document.querySelector('#gallery-intro').textContent=published
    ?'Estas imagens já estão salvas para o Guia. A foto principal aparece no aplicativo.'
    :'Estas imagens já estão salvas no cadastro. A equipe controla a publicação no aplicativo.';

  async function persist(nextCover,nextExtras){
    if(saving)throw Error('Aguarde a foto anterior ser salva.');
    saving=true;
    document.querySelectorAll('.photo-action').forEach(button=>{button.disabled=true;});
    try{
      await salvar({imagem_url:nextCover,galeria_urls:nextExtras});
      capa=nextCover;
      extras=nextExtras;
      render();
    }finally{
      saving=false;
      document.querySelectorAll('.photo-action').forEach(button=>{button.disabled=false;});
    }
  }

  function action(label,onClick){
    const button=document.createElement('button');
    button.type='button';button.className='photo-action';button.textContent=label;
    button.addEventListener('click',onClick);
    return button;
  }

  function replaceAction(label,onFile){
    const button=action(label,()=>input.click());
    const input=document.createElement('input');
    input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      button.disabled=true;
      try{await onFile(await upload(file));}catch(error){notice(error.message,true);}
      finally{button.disabled=false;input.value='';}
    });
    const wrapper=document.createElement('span');wrapper.append(button,input);
    return wrapper;
  }

  function photoCard(url,index,isCover){
    const card=document.createElement('article');card.className=`photo-card${isCover?' photo-cover':''}`;
    const img=document.createElement('img');img.src=url;img.alt=isCover?'Foto principal da empresa':`Foto extra ${index+1}`;img.loading='lazy';
    const info=document.createElement('div');info.className='photo-card-info';
    const title=document.createElement('strong');title.textContent=isCover?'Capa do Guia':`Foto ${index+1}`;
    const tag=document.createElement('span');tag.className='photo-status';tag.textContent=isCover&&published?'No aplicativo':'Já cadastrada';
    const actions=document.createElement('div');actions.className='photo-actions';
    actions.append(replaceAction('Trocar foto',async nextUrl=>{
      if(isCover)await persist(nextUrl,extras);
      else await persist(capa,extras.map((value,i)=>i===index?nextUrl:value));
    }));
    if(!isCover)actions.append(action('Usar como capa',async()=>{
      try{await persist(url,[...(capa?[capa]:[]),...extras.filter((_,i)=>i!==index)]);}catch(error){notice(error.message,true);}
    }));
    actions.append(action('Remover',async()=>{
      try{
        if(isCover)await persist(extras[0]||null,extras.slice(1));
        else await persist(capa,extras.filter((_,i)=>i!==index));
      }catch(error){notice(error.message,true);}
    }));
    info.append(title,tag,actions);card.append(img,info);
    return card;
  }

  function render(){
    coverEl.replaceChildren();grid.replaceChildren();
    if(capa)coverEl.append(photoCard(capa,0,true));
    else{
      const empty=document.createElement('div');empty.className='photo-empty';
      empty.textContent='Ainda não há foto principal. Adicione uma imagem abaixo ou escolha uma das outras fotos como capa.';
      coverEl.append(empty);
    }
    if(extras.length)extras.forEach((url,i)=>grid.append(photoCard(url,i,false)));
    else{
      const empty=document.createElement('div');empty.className='photo-empty';empty.textContent='Nenhuma outra foto cadastrada.';grid.append(empty);
    }
    document.querySelector('#photo-count').textContent=`${extras.length} de 10 fotos extras`;
    form.hidden=extras.length>=10&&Boolean(capa);
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button');button.disabled=true;
    try{
      const file=form.querySelector('input').files?.[0];
      if(!file)throw Error('Escolha uma imagem.');
      if(capa&&extras.length>=10)throw Error('Limite de 10 fotos extras atingido.');
      const url=await upload(file);
      await persist(capa||url,capa?[...extras,url]:extras);
      form.reset();
    }catch(error){notice(error.message,true);}
    finally{button.disabled=false;}
  });
  render();
}
