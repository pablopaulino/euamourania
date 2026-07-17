import { uploadImagem, listarMidias, listarMidiasDisponiveis, excluirMidia } from "../assets/js/services/mediaService.js";
import { obterAcessoAtual } from "./auth.js";

const enhanced=new WeakSet();
const app=document.getElementById("app-content");
const communication=document.getElementById("communication-app");
let mediaRows=[];
let libraryOpened=false;

const PRESETS={
 wide:{label:"Notícia / banner (16:9)",ratio:16/9,width:1600},
 social:{label:"Compartilhamento (1,91:1)",ratio:1.91,width:1600},
 card:{label:"Card (3:2)",ratio:3/2,width:1500},
 classic:{label:"Clássica (4:3)",ratio:4/3,width:1400},
 square:{label:"Quadrada (1:1)",ratio:1,width:1080},
 original:{label:"Proporção original",ratio:null,width:1600}
};

function ensureStyles(){
 if(document.querySelector('link[data-cms-media]'))return;
 const link=document.createElement("link");
 link.rel="stylesheet";link.dataset.cmsMedia="true";
 link.href=new URL("./media-upload.css",import.meta.url).href;
 document.head.append(link);
}

function safe(value){
 return String(value||"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function formatSize(bytes){
 if(!bytes)return"—";
 return bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1).replace(".",",")} MB`;
}

function preview(container,url){
 container.innerHTML=/^(?:https?:\/\/|\/?assets\/)/i.test(url||"")?`<img src="${safe(url)}" alt="Prévia da imagem enviada"><small>Prévia da imagem</small>`:"";
}

function canvasBlob(canvas,type="image/webp",quality=.86){
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Não foi possível processar a imagem.")),type,quality));
}

function openImageEditor(file,initialPreset="wide",keepOriginal=true){
 return new Promise((resolve,reject)=>{
  const objectUrl=URL.createObjectURL(file);
  const image=new Image();
  image.onload=()=>{
   const modal=document.createElement("div");
   modal.className="cms-image-editor-backdrop";
   modal.innerHTML=`<section class="cms-image-editor" role="dialog" aria-modal="true" aria-labelledby="image-editor-title">
    <header><div><p class="eyebrow">Editor de imagem</p><h2 id="image-editor-title">Ajustar enquadramento</h2></div><button type="button" class="cms-editor-close" aria-label="Fechar">×</button></header>
    <div class="cms-crop-stage"><canvas aria-label="Prévia do recorte; arraste para reposicionar"></canvas><p>Arraste a imagem para escolher o melhor enquadramento.</p></div>
    <div class="cms-crop-controls">
     <label>Formato<select data-crop-preset>${Object.entries(PRESETS).map(([value,preset])=>`<option value="${value}" ${value===initialPreset?"selected":""}>${preset.label}</option>`).join("")}</select></label>
     <label>Zoom<input data-crop-zoom type="range" min="1" max="3" value="1" step="0.01"></label>
     <div class="cms-rotate-controls"><span>Rotação</span><button type="button" data-rotate="-90">↶ 90°</button><button type="button" data-rotate="90">↷ 90°</button></div>
     <label class="cms-preserve-original"><input data-keep-original type="checkbox" ${keepOriginal?"checked":""}> Guardar o arquivo original por 7 dias</label>
    </div>
    <footer><button type="button" class="admin-button secondary" data-use-original>Usar sem recortar</button><button type="button" class="admin-button secondary" data-crop-cancel>Cancelar</button><button type="button" class="admin-button" data-crop-apply>Aplicar recorte</button></footer>
   </section>`;
   document.body.append(modal);
   const canvas=modal.querySelector("canvas"),ctx=canvas.getContext("2d");
   const presetSelect=modal.querySelector("[data-crop-preset]");
   const zoomInput=modal.querySelector("[data-crop-zoom]");
   const state={rotation:0,zoom:1,offsetX:0,offsetY:0,dragging:false,lastX:0,lastY:0};
   let settled=false;

   const ratio=()=>{
    const preset=PRESETS[presetSelect.value];
    if(preset.ratio)return preset.ratio;
    const base=image.naturalWidth/image.naturalHeight;
    return Math.abs(state.rotation)%180===90?1/base:base;
   };
   const sizeCanvas=()=>{
    const r=ratio(),maxWidth=760,maxHeight=500;
    let width=maxWidth,height=Math.round(width/r);
    if(height>maxHeight){height=maxHeight;width=Math.round(height*r)}
    canvas.width=Math.max(280,width);canvas.height=Math.max(220,height);
   };
   const drawTo=(target,targetWidth,targetHeight)=>{
    const turn=Math.abs(state.rotation)%180===90;
    const rotatedWidth=turn?image.naturalHeight:image.naturalWidth;
    const rotatedHeight=turn?image.naturalWidth:image.naturalHeight;
    const scale=Math.max(targetWidth/rotatedWidth,targetHeight/rotatedHeight)*state.zoom;
    const renderedWidth=rotatedWidth*scale,renderedHeight=rotatedHeight*scale;
    const relativeX=state.offsetX/Math.max(1,canvas.width),relativeY=state.offsetY/Math.max(1,canvas.height);
    const offsetX=Math.max(-(renderedWidth-targetWidth)/2,Math.min((renderedWidth-targetWidth)/2,relativeX*targetWidth));
    const offsetY=Math.max(-(renderedHeight-targetHeight)/2,Math.min((renderedHeight-targetHeight)/2,relativeY*targetHeight));
    target.clearRect(0,0,targetWidth,targetHeight);
    target.fillStyle="#eef3f4";target.fillRect(0,0,targetWidth,targetHeight);
    target.save();
    target.translate(targetWidth/2+offsetX,targetHeight/2+offsetY);
    target.rotate(state.rotation*Math.PI/180);
    target.drawImage(image,-image.naturalWidth*scale/2,-image.naturalHeight*scale/2,image.naturalWidth*scale,image.naturalHeight*scale);
    target.restore();
   };
   const clampPosition=()=>{
    const turn=Math.abs(state.rotation)%180===90;
    const rotatedWidth=turn?image.naturalHeight:image.naturalWidth;
    const rotatedHeight=turn?image.naturalWidth:image.naturalHeight;
    const scale=Math.max(canvas.width/rotatedWidth,canvas.height/rotatedHeight)*state.zoom;
    const maxX=Math.max(0,(rotatedWidth*scale-canvas.width)/2);
    const maxY=Math.max(0,(rotatedHeight*scale-canvas.height)/2);
    state.offsetX=Math.max(-maxX,Math.min(maxX,state.offsetX));
    state.offsetY=Math.max(-maxY,Math.min(maxY,state.offsetY));
   };
   const draw=()=>{clampPosition();drawTo(ctx,canvas.width,canvas.height)};
   const resetPosition=()=>{state.offsetX=0;state.offsetY=0;state.zoom=Number(zoomInput.value)||1;sizeCanvas();draw()};
   const finish=value=>{
    if(settled)return;settled=true;
    URL.revokeObjectURL(objectUrl);modal.remove();resolve(value);
   };
   const fail=error=>{
    if(settled)return;settled=true;
    URL.revokeObjectURL(objectUrl);modal.remove();reject(error);
   };

   presetSelect.addEventListener("change",resetPosition);
   zoomInput.addEventListener("input",()=>{state.zoom=Number(zoomInput.value);draw()});
   modal.querySelectorAll("[data-rotate]").forEach(button=>button.addEventListener("click",()=>{
    state.rotation=(state.rotation+Number(button.dataset.rotate)+360)%360;
    resetPosition();
   }));
   const pointer=(event)=>{
    const rect=canvas.getBoundingClientRect();
    return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};
   };
   canvas.addEventListener("pointerdown",event=>{
    const point=pointer(event);state.dragging=true;state.lastX=point.x;state.lastY=point.y;
    canvas.setPointerCapture(event.pointerId);
   });
   canvas.addEventListener("pointermove",event=>{
    if(!state.dragging)return;
    const point=pointer(event);state.offsetX+=point.x-state.lastX;state.offsetY+=point.y-state.lastY;
    state.lastX=point.x;state.lastY=point.y;draw();
   });
   canvas.addEventListener("pointerup",()=>state.dragging=false);
   canvas.addEventListener("pointercancel",()=>state.dragging=false);
   modal.querySelector(".cms-editor-close").addEventListener("click",()=>finish(null));
   modal.querySelector("[data-crop-cancel]").addEventListener("click",()=>finish(null));
   modal.querySelector("[data-use-original]").addEventListener("click",()=>finish({
    arquivo:file,original:null,largura:image.naturalWidth,altura:image.naturalHeight
   }));
   modal.querySelector("[data-crop-apply]").addEventListener("click",async()=>{
    const apply=modal.querySelector("[data-crop-apply]");
    apply.disabled=true;apply.textContent="Processando…";
    try{
     const preset=PRESETS[presetSelect.value],r=ratio();
     const width=Math.min(preset.width,Math.max(600,Math.round(image.naturalWidth*state.zoom)));
     const height=Math.max(1,Math.round(width/r));
     const output=document.createElement("canvas");output.width=width;output.height=height;
     drawTo(output.getContext("2d"),width,height);
     const blob=await canvasBlob(output);
     const base=file.name.replace(/\.[^.]+$/,"").replace(/[^\p{L}\p{N}_-]+/gu,"-").slice(0,80)||"imagem";
     const edited=new File([blob],`${base}-editada.webp`,{type:"image/webp",lastModified:Date.now()});
     finish({
      arquivo:edited,
      original:modal.querySelector("[data-keep-original]").checked?file:null,
      largura:width,altura:height
     });
    }catch(error){fail(error)}
   });
   resetPosition();
  };
  image.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(new Error("Não foi possível abrir esta imagem."))};
  image.src=objectUrl;
 });
}

async function processAndUpload(file,folder,preset,{keepOriginal=true}={}){
 const edited=await openImageEditor(file,preset,keepOriginal);
 if(!edited)return null;
 if(edited.original){
  await uploadImagem(edited.original,`${folder}/originais`,{
   largura:null,altura:null,variante:"original"
  });
 }
 return uploadImagem(edited.arquivo,folder,{
  largura:edited.largura,altura:edited.altura,variante:"otimizada"
 });
}

async function fileFromUrl(item){
 const response=await fetch(item.url);
 if(!response.ok)throw new Error("Não foi possível abrir esta imagem da biblioteca.");
 const blob=await response.blob();
 const extension=(blob.type.split("/")[1]||"jpg").replace("jpeg","jpg");
 const name=(item.nome_original||`imagem-${item.id}.${extension}`).replace(/[^\p{L}\p{N}_.-]+/gu,"-");
 return new File([blob],name,{type:blob.type||item.mime_type||"image/jpeg",lastModified:Date.now()});
}

async function openLibraryPicker({folder,preset,onSelect}){
 const rows=await listarMidiasDisponiveis();
 return new Promise(resolve=>{
  const previousActive=document.activeElement;
  const previousOverflow=document.body.style.overflow;
  const modal=document.createElement("div");
  modal.className="cms-library-picker-backdrop";
  modal.innerHTML=`<section class="cms-library-picker" role="dialog" aria-modal="true" aria-labelledby="library-picker-title">
   <header><div><p class="eyebrow">Biblioteca do CMS</p><h2 id="library-picker-title">Escolher imagem existente</h2></div><button type="button" class="cms-editor-close" data-library-close aria-label="Fechar">×</button></header>
   <div class="cms-library-toolbar"><input type="search" data-library-search placeholder="Pesquisar por nome ou pasta…"><span data-library-count>${rows.length} imagem(ns)</span></div>
   <div class="cms-library-picker-grid">${rows.map(item=>`<article class="cms-library-picker-card" data-search="${safe(`${item.nome_original||""} ${item.pasta||""}`.toLowerCase())}">
    <img src="${safe(item.url)}" alt="${safe(item.nome_original||"Imagem da biblioteca")}" loading="lazy">
    <div><strong title="${safe(item.nome_original||item.caminho.split("/").pop())}">${safe(item.nome_original||item.caminho.split("/").pop())}</strong><small title="${safe(item.pasta)}">${safe(item.pasta)} · ${item.largura&&item.altura?`${item.largura}×${item.altura}`:"dimensão não registrada"}</small></div>
    <div class="cms-library-card-actions"><button type="button" class="admin-button secondary" data-library-edit="${item.id}">Editar / outro formato</button><button type="button" class="admin-button" data-library-use="${item.id}">Usar imagem</button></div>
   </article>`).join("")||'<div class="empty-state">Nenhuma imagem disponível. Envie a primeira imagem pelo formulário.</div>'}</div>
   <p class="cms-library-picker-status" aria-live="polite"></p>
  </section>`;
  document.body.style.overflow="hidden";
  document.body.append(modal);
  const status=modal.querySelector(".cms-library-picker-status");
  let settled=false;
  const close=value=>{
   if(settled)return;
   settled=true;
   document.removeEventListener("keydown",onKeydown);
   document.body.style.overflow=previousOverflow;
   modal.remove();
   previousActive?.focus?.();
   resolve(value);
  };
  const onKeydown=event=>{if(event.key==="Escape")close(null)};
  document.addEventListener("keydown",onKeydown);
  modal.querySelector("[data-library-close]").addEventListener("click",()=>close(null));
  modal.addEventListener("click",event=>{if(event.target===modal)close(null)});
  modal.querySelector("[data-library-search]").addEventListener("input",event=>{
   const term=event.target.value.trim().toLowerCase();
   let visible=0;
   modal.querySelectorAll(".cms-library-picker-card").forEach(card=>{
    card.hidden=!card.dataset.search.includes(term);
    if(!card.hidden)visible+=1;
   });
   modal.querySelector("[data-library-count]").textContent=term?`${visible} de ${rows.length} imagem(ns)`:`${rows.length} imagem(ns)`;
  });
  modal.querySelector("[data-library-search]").focus();
  modal.addEventListener("click",async event=>{
   const button=event.target.closest("button");if(!button)return;
   const useId=button.dataset.libraryUse,editId=button.dataset.libraryEdit;
   const item=rows.find(row=>row.id===(useId||editId));if(!item)return;
   if(useId){
    button.disabled=true;status.className="cms-library-picker-status";status.textContent="Selecionando imagem…";
    try{
     await onSelect(item.url);
     close(item.url);
    }catch(error){
     status.className="cms-library-picker-status error";status.textContent=error.message||"Não foi possível usar esta imagem.";
     button.disabled=false;
    }
    return;
   }
   button.disabled=true;status.className="cms-library-picker-status";status.textContent="Abrindo imagem para edição…";
   try{
    const file=await fileFromUrl(item);
    const result=await processAndUpload(file,folder,preset,{keepOriginal:false});
    if(!result){status.textContent="Edição cancelada.";button.disabled=false;return}
    onSelect(result.url);close(result.url);
   }catch(error){
    status.className="cms-library-picker-status error";status.textContent=error.message||"Não foi possível editar a imagem.";
    button.disabled=false;
   }
  });
 });
}

function attachUrlUpload(input,folder,preset){
 if(!input||enhanced.has(input))return;
 enhanced.add(input);
 const controls=document.createElement("div");
 controls.className="cms-media-upload";
 controls.innerHTML='<div class="cms-media-actions"><label class="cms-media-button">Enviar e editar<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"></label><button type="button" class="cms-media-button" data-open-library>Escolher da biblioteca</button><button type="button" class="cms-media-button" data-repeat-crop hidden>Criar outro formato</button></div><span class="cms-media-state">Envie uma imagem nova ou reutilize uma que já está na biblioteca.</span><div class="cms-media-preview"></div>';
 input.insertAdjacentElement("afterend",controls);
 const picker=controls.querySelector('input[type="file"]');
 const button=controls.querySelector(".cms-media-button");
 const status=controls.querySelector(".cms-media-state");
 const previewBox=controls.querySelector(".cms-media-preview");
 const libraryButton=controls.querySelector("[data-open-library]");
 const repeatButton=controls.querySelector("[data-repeat-crop]");
 let lastFile=null;
 const applyResult=result=>{
  input.value=result.url;
  input.dispatchEvent(new Event("input",{bubbles:true}));
  input.dispatchEvent(new Event("change",{bubbles:true}));
  preview(previewBox,result.url);
 };
 preview(previewBox,input.value);
 input.addEventListener("change",()=>preview(previewBox,input.value));
 picker.addEventListener("change",async()=>{
  const file=picker.files?.[0];if(!file)return;
  lastFile=file;
  button.classList.add("busy");status.className="cms-media-state";
  try{
   const result=await processAndUpload(file,folder,preset);
   if(!result){status.textContent="Envio cancelado.";return}
   status.textContent="Enviando imagem…";
   applyResult(result);repeatButton.hidden=false;
   status.className="cms-media-state success";status.textContent="Imagem editada, enviada e URL preenchida.";
  }catch(error){
   status.className="cms-media-state error";status.textContent=error.message||"Não foi possível enviar a imagem.";
  }finally{
   button.classList.remove("busy");picker.value="";
  }
 });
 libraryButton.addEventListener("click",async()=>{
  libraryButton.classList.add("busy");status.textContent="Carregando biblioteca…";
  try{
   await openLibraryPicker({folder,preset,onSelect:url=>{
    applyResult({url});status.className="cms-media-state success";status.textContent="Imagem da biblioteca selecionada.";
   }});
  }catch(error){status.className="cms-media-state error";status.textContent=error.message||"Não foi possível abrir a biblioteca."}
  finally{libraryButton.classList.remove("busy")}
 });
 repeatButton.addEventListener("click",async()=>{
  if(!lastFile)return;
  repeatButton.classList.add("busy");status.textContent="Criando outro formato…";
  try{
   const result=await processAndUpload(lastFile,folder,preset,{keepOriginal:false});
   if(!result){status.textContent="Edição cancelada.";return}
   applyResult(result);status.className="cms-media-state success";status.textContent="Novo formato criado e selecionado.";
  }catch(error){status.className="cms-media-state error";status.textContent=error.message||"Não foi possível criar outro formato."}
  finally{repeatButton.classList.remove("busy")}
 });
}

function attachEditorUpload(editorElement,folder){
 if(!editorElement||editorElement.dataset.mediaUpload)return;
 editorElement.dataset.mediaUpload="true";
 const controls=document.createElement("div");
 controls.className="cms-inline-upload";
 controls.innerHTML='<div class="cms-media-actions"><label class="cms-media-button">Enviar para o texto<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"></label><button type="button" class="cms-media-button" data-open-library>Escolher da biblioteca</button></div><span class="cms-media-state">Edite uma imagem nova ou insira uma já existente na posição atual.</span>';
 editorElement.insertAdjacentElement("afterend",controls);
 const picker=controls.querySelector("input");
 const button=controls.querySelector(".cms-media-button");
 const status=controls.querySelector(".cms-media-state");
 const libraryButton=controls.querySelector("[data-open-library]");
 const insertUrl=url=>{
  const editor=window.euamouraniaEditor||window.Quill?.find?.(editorElement);
  if(!editor?.insertEmbed)throw new Error("O editor ainda não está pronto.");
  const range=editor.getSelection(true),index=range?.index??Math.max(0,editor.getLength()-1);
  editor.insertEmbed(index,"image",url,"user");editor.setSelection(index+1,0,"silent");
 };
 picker.addEventListener("change",async()=>{
  const file=picker.files?.[0];if(!file)return;
  button.classList.add("busy");status.className="cms-media-state";
  try{
   const result=await processAndUpload(file,folder,"original");
   if(!result){status.textContent="Envio cancelado.";return}
   insertUrl(result.url);
   status.className="cms-media-state success";status.textContent="Imagem editada e inserida no texto.";
  }catch(error){
   status.className="cms-media-state error";status.textContent=error.message||"Não foi possível inserir a imagem.";
  }finally{
   button.classList.remove("busy");picker.value="";
  }
 });
 libraryButton.addEventListener("click",async()=>{
  libraryButton.classList.add("busy");status.textContent="Carregando biblioteca…";
  try{
   await openLibraryPicker({folder,preset:"original",onSelect:url=>{
    insertUrl(url);status.className="cms-media-state success";status.textContent="Imagem da biblioteca inserida no texto.";
   }});
  }catch(error){status.className="cms-media-state error";status.textContent=error.message||"Não foi possível abrir a biblioteca."}
  finally{libraryButton.classList.remove("busy")}
 });
}

function ensureMediaNavigation(){
 if(!app||obterAcessoAtual()?.admin?.funcao!=="super_admin")return;
 const nav=document.querySelector(".admin-nav");
 if(!nav||document.getElementById("media-library-nav"))return;
 const button=document.createElement("button");
 button.id="media-library-nav";button.dataset.module="configuracoes";button.textContent="Mídia";
 const settings=nav.querySelector('[data-view="configuracoes_site"]');
 nav.insertBefore(button,settings||null);
}

async function renderMediaLibrary(){
 libraryOpened=true;
 document.getElementById("page-title").textContent="Mídia";
 location.hash="midia";
 document.querySelectorAll(".admin-nav button").forEach(button=>button.classList.toggle("active",button.id==="media-library-nav"));
 app.innerHTML='<div class="ads-card"><div class="skeleton"></div><div class="skeleton"></div></div>';
 try{
  mediaRows=await listarMidias();
  const unused=mediaRows.filter(item=>!item.em_uso),eligible=mediaRows.filter(item=>item.elegivel_limpeza);
  app.innerHTML=`<section class="panel media-library">
   <div class="cms-section-head"><div><h2>Biblioteca de mídia</h2><p>Visualize, pesquise e acompanhe onde cada arquivo pode ser usado.</p></div><button class="admin-button danger" data-media-clean ${eligible.length?"":"disabled"}>Limpar ${eligible.length} arquivo(s)</button></div>
   <div class="media-library-summary"><article><span>Total</span><strong>${mediaRows.length}</strong></article><article><span>Em uso</span><strong>${mediaRows.length-unused.length}</strong></article><article><span>Sem uso</span><strong>${unused.length}</strong></article><article><span>Prontas para limpeza</span><strong>${eligible.length}</strong></article></div>
   <div class="media-library-toolbar"><input id="media-search" type="search" placeholder="Pesquisar imagem ou pasta…"><select id="media-variant"><option value="">Todas as versões</option><option value="otimizada">Otimizadas</option><option value="original">Originais</option></select><select id="media-status"><option value="">Todos os estados</option><option value="uso">Em uso</option><option value="protegida">Protegidas por 7 dias</option><option value="limpeza">Prontas para limpeza</option></select></div>
   <div class="media-library-grid">${mediaRows.map(item=>`<article class="media-library-card" data-search="${safe(`${item.nome_original||""} ${item.pasta||""}`.toLowerCase())}" data-variant="${item.variante}" data-status="${item.em_uso?"uso":item.elegivel_limpeza?"limpeza":"protegida"}">
    <img src="${safe(item.url)}" alt="${safe(item.nome_original||"Imagem do CMS")}" loading="lazy">
    <div class="media-library-info"><strong title="${safe(item.nome_original||item.caminho.split("/").pop())}">${safe(item.nome_original||item.caminho.split("/").pop())}</strong><small>${safe(item.pasta)}</small><small>${item.largura&&item.altura?`${item.largura}×${item.altura} · `:""}${formatSize(item.tamanho)} · ${new Date(item.criado_em).toLocaleDateString("pt-BR")}</small></div>
    <div class="media-library-footer"><span class="status-pill ${item.em_uso?"ativo":"inativo"}">${item.em_uso?"Em uso":item.elegivel_limpeza?"Pode limpar":item.variante==="original"?"Original protegido":"Protegida por 7 dias"}</span><span class="media-version">${item.variante==="original"?"Original":"WebP otimizada"}</span></div>
    <button type="button" class="admin-button secondary" data-media-delete="${item.id}" ${item.em_uso||!item.elegivel_limpeza?"disabled":""}>Excluir definitivamente</button>
   </article>`).join("")||'<div class="empty-state">Nenhuma imagem enviada pelo CMS ainda.</div>'}</div>
  </section>`;
  const filter=()=>{
   const term=document.getElementById("media-search").value.trim().toLowerCase();
   const variant=document.getElementById("media-variant").value,status=document.getElementById("media-status").value;
   document.querySelectorAll(".media-library-card").forEach(card=>{
    card.hidden=!(card.dataset.search.includes(term)&&(!variant||card.dataset.variant===variant)&&(!status||card.dataset.status===status));
   });
  };
  ["media-search","media-variant","media-status"].forEach(id=>document.getElementById(id).addEventListener("input",filter));
 }catch(error){
  app.innerHTML=`<div class="ads-card empty-state"><strong>Não foi possível carregar a biblioteca</strong><p>${safe(error.message)}</p></div>`;
 }
}

async function removeMediaRows(rows){
 for(const item of rows)await excluirMidia(item);
 await renderMediaLibrary();
}

function enhance(){
 ensureStyles();ensureMediaNavigation();
 const communicationForm=communication?.querySelector("#news-form");
 if(communicationForm){
  attachUrlUpload(communicationForm.elements.imagem_url,"comunicacao/newsletters","wide");
  attachEditorUpload(communicationForm.querySelector("#editor"),"comunicacao/conteudo");
 }
 const newsForm=app?.querySelector("#news-form");
 if(newsForm){
  attachUrlUpload(newsForm.elements.imagem_url,"noticias/principais","wide");
  attachUrlUpload(newsForm.elements.seo_imagem,"noticias/compartilhamento","social");
  attachEditorUpload(newsForm.querySelector("#editor"),"noticias/conteudo");
 }
 const resourceForm=app?.querySelector("#resource-form");
 if(resourceForm){
  const table=location.hash.slice(1),folder={guia_comercial:"guia",turismo:"turismo",eventos:"eventos",eventos_principais:"eventos/principais",eventos_edicoes:"eventos/edicoes"}[table];
  if(folder){
   attachUrlUpload(resourceForm.elements.imagem_url,folder,"card");
   attachUrlUpload(resourceForm.elements.imagem_capa_url,folder,"wide");
   attachUrlUpload(resourceForm.elements.cartaz_url,folder,"classic");
   attachUrlUpload(resourceForm.elements.banner_url,folder,"wide");
   if(table==="turismo")attachEditorUpload(resourceForm.querySelector("#editor"),`${folder}/conteudo`);
   if(table==="eventos_principais"||table==="eventos_edicoes")attachEditorUpload(resourceForm.querySelector("#editor"),`${folder}/conteudo`);
  }
 }
 if(location.hash==="#midia"&&!libraryOpened&&obterAcessoAtual()?.admin?.funcao==="super_admin")renderMediaLibrary();
}

document.addEventListener("click",async event=>{
 const button=event.target.closest("button");if(!button)return;
 if(button.id==="media-library-nav"){
  event.preventDefault();event.stopImmediatePropagation();renderMediaLibrary();return;
 }
 if(button.dataset.mediaDelete){
  const item=mediaRows.find(row=>row.id===button.dataset.mediaDelete);
  if(item&&confirm("Excluir definitivamente esta imagem sem uso?"))await removeMediaRows([item]);
  return;
 }
 if(button.hasAttribute("data-media-clean")){
  const rows=mediaRows.filter(item=>item.elegivel_limpeza);
  if(rows.length&&confirm(`Excluir definitivamente ${rows.length} imagem(ns) sem uso há mais de 7 dias?`))await removeMediaRows(rows);
 }
},true);

const observer=new MutationObserver(enhance);
observer.observe(document.body,{childList:true,subtree:true});
enhance();
