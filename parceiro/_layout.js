import {exigirParceiro} from './auth.js';
import {getSupabase} from '../assets/js/services/supabaseClient.js';
import {normalizePartnerLinks,partnerPath} from './paths.js';
export const db=getSupabase();
export const acesso=await exigirParceiro();
if(acesso){
  normalizePartnerLinks();
  const header=document.querySelector('body > header');
  if(header){
    header.classList.add('partner-header');
    let brand=header.querySelector('.partner-header-brand');
    if(!brand){
      brand=document.createElement('a');
      brand.className='partner-header-brand';
      brand.innerHTML='<img src="/assets/viva-origem-colorido.svg" alt="" width="34" height="30"><span>viva<small>URÂNIA · PARCEIROS</small></span>';
      header.prepend(brand);
    }
    brand.href=partnerPath();
  }
  document.querySelector('body > nav')?.classList.add('partner-nav');
  document.querySelector('#partner-name').textContent=acesso.guia?.nome||'Aguardando vínculo do cadastro';
  document.querySelector('#logout')?.addEventListener('click',async()=>{await db.auth.signOut({scope:'local'});location.replace(partnerPath('login'));});
  document.querySelectorAll('main[data-needs-guide]').forEach(el=>{if(!acesso.guia)el.innerHTML='<p>Seu acesso foi criado. Aguarde o vínculo com o estabelecimento pelo atendimento.</p>';});
}
let noticeTimer;
export function notice(message,error=false,kind='success'){
 clearTimeout(noticeTimer);
 const el=document.querySelector('#notice');if(!el)return;
 el.replaceChildren();el.className=error?'error':kind;
 el.setAttribute('role',error?'alert':'status');el.setAttribute('aria-live',error?'assertive':'polite');el.setAttribute('aria-atomic','true');
 if(!message)return;
 if(kind==='info'&&!error){el.textContent=message;return;}
 el.classList.add('partner-feedback');
 const icon=document.createElement('span');icon.className='feedback-icon';icon.setAttribute('aria-hidden','true');icon.textContent=error?'!':'✓';
 const copy=document.createElement('span');copy.className='feedback-copy';
 const title=document.createElement('strong');title.textContent=error?'Confira antes de continuar':'Tudo certo!';
 const text=document.createElement('span');text.textContent=message;copy.append(title,text);
 const close=document.createElement('button');close.type='button';close.className='feedback-close';close.setAttribute('aria-label','Fechar aviso');close.textContent='×';
 close.addEventListener('click',()=>{if(el.contains(document.activeElement))document.querySelector('main form button')?.focus();notice('');});
 el.append(icon,copy,close);
 if(!error&&kind==='success')noticeTimer=setTimeout(()=>notice(''),3000);
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
 el.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
 icon.animate([{transform:'scale(.7)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:320,easing:'ease-out'});
 }
}
export async function salvar(dados){const {data,error}=await db.rpc('parceiro_atualizar_cadastro',{p_guia_id:acesso.guia.id,p_dados:dados});if(error)throw error;Object.assign(acesso.guia,dados,{atualizado_em:data.atualizado_em});notice('Alterações salvas.');return data;}
export async function upload(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Use JPG, PNG ou WebP de até 5 MB.');
  const ext=file.type==='image/jpeg'?'jpg':file.type.split('/')[1];
  const path=`parceiros/${acesso.guia.id}/${crypto.randomUUID()}.${ext}`;
  const {error}=await db.storage.from('cms-media').upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw error;
  return db.storage.from('cms-media').getPublicUrl(path).data.publicUrl;
}
