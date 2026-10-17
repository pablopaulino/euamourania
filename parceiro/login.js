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
  db.from('guia_comercial').select('id',{count:'exact',head:true}).eq('status','publicado').then(({count,error})=>{
    if(error||!Number.isFinite(count))return;
    document.querySelector('#published-count').textContent=new Intl.NumberFormat('pt-BR').format(count);
    document.querySelector('#published-companies').hidden=false;
  }).catch(()=>{});
}
