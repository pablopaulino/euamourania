import {getSupabase} from '../assets/js/services/supabaseClient.js';
import {verificarParceiro} from './auth.js';
import {partnerPath} from './paths.js';
const db=getSupabase(),form=document.querySelector('#login'),notice=document.querySelector('#notice');
function show(message,error=false){notice.textContent=message;notice.className=error?'error':'success';}
if(location.hash.includes('type=recovery')){
  form.hidden=true;
  document.querySelector('#reset').hidden=true;
  document.querySelector('#new-password').hidden=false;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  try{
    const values=new FormData(form),captchaToken=values.get('cf-turnstile-response');
    if(!captchaToken)throw Error('Confirme a verificação de segurança.');
    const {error}=await db.auth.signInWithPassword({email:values.get('email'),password:values.get('password'),options:{captchaToken}});
    if(error)throw error;
    if(!await verificarParceiro()){await db.auth.signOut({scope:'local'});throw Error('Acesso exclusivo para parceiros');}
    location.replace(partnerPath());
  }catch(error){show(error.message,true);window.turnstile?.reset();}
});
document.querySelector('#reset').addEventListener('click',async()=>{
  try{
    const email=form.elements.email.value,captchaToken=window.turnstile?.getResponse();
    if(!email)throw Error('Informe o e-mail primeiro.');
    if(!captchaToken)throw Error('Confirme a verificação de segurança.');
    const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+partnerPath('login'),captchaToken});
    if(error)throw error;
    show('Enviamos o link de recuperação.');
  }catch(error){show(error.message,true);}
});
document.querySelector('#new-password').addEventListener('submit',async event=>{
  event.preventDefault();
  try{
    const {error}=await db.auth.updateUser({password:event.target.elements.password.value});
    if(error)throw error;
    if(!await verificarParceiro())throw Error('Acesso exclusivo para parceiros');
    location.replace(partnerPath());
  }catch(error){show(error.message,true);}
});
if(document.querySelector('#published-companies')&&window.matchMedia('(min-width:681px)').matches){
  fetch('/api/parceiro-impacto').then(async response=>{
    if(!response.ok)throw Error('Dados indisponíveis');
    return response.json();
  }).then(data=>{
    const metrics=[['empresas','#published-count','#published-companies'],['visualizacoes','#guide-views-count','#guide-views'],['cliquesWhatsapp','#whatsapp-clicks-count','#whatsapp-clicks']];
    if(!metrics.every(([key])=>Number.isSafeInteger(data[key])&&data[key]>=0))throw Error('Dados inválidos');
    for(const [key,valueSelector,cardSelector] of metrics){
      document.querySelector(valueSelector).textContent=new Intl.NumberFormat('pt-BR').format(data[key]);
      document.querySelector(cardSelector).hidden=false;
    }
    document.querySelector('#impact-fallback').textContent='Totais acumulados desde o início do registro no Guia.';
  }).catch(()=>{document.querySelector('#impact-fallback').textContent='Dados do Guia temporariamente indisponíveis.';});
}
