import { uploadImagem } from "../assets/js/services/mediaService.js";

const enhanced=new WeakSet();
const app=document.getElementById("app-content");
const communication=document.getElementById("communication-app");

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

function preview(container,url){
 container.innerHTML=/^https?:\/\//i.test(url||"")?`<img src="${safe(url)}" alt="Prévia da imagem enviada"><small>Prévia da imagem</small>`:"";
}

function attachUrlUpload(input,folder){
 if(!input||enhanced.has(input))return;
 enhanced.add(input);
 const controls=document.createElement("div");
 controls.className="cms-media-upload";
 controls.innerHTML='<label class="cms-media-button">Enviar imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"></label><span class="cms-media-state">JPG, PNG, WebP, GIF ou AVIF · máximo 8 MB.</span><div class="cms-media-preview"></div>';
 input.insertAdjacentElement("afterend",controls);
 const picker=controls.querySelector('input[type="file"]');
 const button=controls.querySelector(".cms-media-button");
 const state=controls.querySelector(".cms-media-state");
 const previewBox=controls.querySelector(".cms-media-preview");
 preview(previewBox,input.value);
 input.addEventListener("change",()=>preview(previewBox,input.value));
 picker.addEventListener("change",async()=>{
  const file=picker.files?.[0];if(!file)return;
  button.classList.add("busy");state.className="cms-media-state";state.textContent="Enviando imagem…";
  try{
   const url=await uploadImagem(file,folder);
   input.value=url;
   input.dispatchEvent(new Event("input",{bubbles:true}));
   input.dispatchEvent(new Event("change",{bubbles:true}));
   preview(previewBox,url);
   state.className="cms-media-state success";state.textContent="Imagem enviada e URL preenchida.";
  }catch(error){
   state.className="cms-media-state error";state.textContent=error.message||"Não foi possível enviar a imagem.";
  }finally{
   button.classList.remove("busy");picker.value="";
  }
 });
}

function attachEditorUpload(editorElement,folder){
 if(!editorElement||editorElement.dataset.mediaUpload)return;
 editorElement.dataset.mediaUpload="true";
 const controls=document.createElement("div");
 controls.className="cms-inline-upload";
 controls.innerHTML='<label class="cms-media-button">Inserir imagem no texto<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"></label><span class="cms-media-state">A imagem será enviada e inserida na posição atual do editor.</span>';
 editorElement.insertAdjacentElement("afterend",controls);
 const picker=controls.querySelector("input");
 const button=controls.querySelector(".cms-media-button");
 const state=controls.querySelector(".cms-media-state");
 picker.addEventListener("change",async()=>{
  const file=picker.files?.[0];if(!file)return;
  button.classList.add("busy");state.className="cms-media-state";state.textContent="Enviando e inserindo…";
  try{
   const url=await uploadImagem(file,folder);
   const editor=window.euamouraniaEditor||window.Quill?.find?.(editorElement);
   if(!editor?.insertEmbed)throw new Error("O editor ainda não está pronto.");
   const range=editor.getSelection(true);
   const index=range?.index??Math.max(0,editor.getLength()-1);
   editor.insertEmbed(index,"image",url,"user");
   editor.setSelection(index+1,0,"silent");
   state.className="cms-media-state success";state.textContent="Imagem inserida no texto.";
  }catch(error){
   state.className="cms-media-state error";state.textContent=error.message||"Não foi possível inserir a imagem.";
  }finally{
   button.classList.remove("busy");picker.value="";
  }
 });
}

function enhance(){
 ensureStyles();
 const communicationForm=communication?.querySelector("#news-form");
 if(communicationForm){
  attachUrlUpload(communicationForm.elements.imagem_url,"comunicacao/newsletters");
  attachEditorUpload(communicationForm.querySelector("#editor"),"comunicacao/conteudo");
 }
 const newsForm=app?.querySelector("#news-form");
 if(newsForm){
  attachUrlUpload(newsForm.elements.imagem_url,"noticias/principais");
  attachUrlUpload(newsForm.elements.seo_imagem,"noticias/compartilhamento");
  attachEditorUpload(newsForm.querySelector("#editor"),"noticias/conteudo");
 }
 const resourceForm=app?.querySelector("#resource-form");
 if(resourceForm){
  const table=location.hash.slice(1);
  const folder={guia_comercial:"guia",turismo:"turismo",eventos:"eventos"}[table];
  if(folder){
   attachUrlUpload(resourceForm.elements.imagem_url,folder);
   if(table==="turismo")attachEditorUpload(resourceForm.querySelector("#editor"),`${folder}/conteudo`);
  }
 }
}

const observer=new MutationObserver(enhance);
observer.observe(document.body,{childList:true,subtree:true});
enhance();
