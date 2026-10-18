import { verifiedBadge } from "/assets/js/viva-verified.js";
import {acesso} from './_layout.js';
if(acesso?.guia){
 document.querySelector('#plan-verified-badge').innerHTML=verifiedBadge(acesso.plano?.ativo);
 if(acesso.plano?.ativo)document.querySelector('#plan-verification-note').textContent='Sua empresa possui o Selo Oficial de Verificação. Ele aparece no Guia após a publicação do cadastro e permanece enquanto seu plano estiver ativo.';
 const g=acesso.guia;document.querySelector('#plan-name').textContent=g.nome;
 document.querySelector('#publication-note').textContent=g.status==='publicado'?'Sua vitrine está publicada no Guia.':'Seu cadastro ainda aguarda publicação. Os materiais públicos serão liberados quando a equipe publicar sua vitrine.';
 const official='5517976005583';
 const plan=acesso.plano,badge=document.querySelector('#partner-active'),details=document.querySelector('#subscription-details');
 const periods={mensal:{name:'Mensal',price:'R$ 79,90',term:'por mês'},semestral:{name:'Semestral',price:'R$ 419,90',term:'por 6 meses'},anual:{name:'Anual',price:'R$ 759,90',term:'por 12 meses'}};
 const situations={sem_assinatura:'Sem assinatura vinculada',ativa:'Parceiro Viva ativo',vencida:'Assinatura vencida',pendente:'Aguardando confirmação',pausada:'Assinatura pausada',cancelada:'Assinatura cancelada',agendada:'Início agendado'};
 const contact=text=>'https://wa.me/'+official+'?text='+encodeURIComponent(text);
 if(acesso.planoErro||!plan){badge.textContent='Consulta indisponível';details.textContent='Não foi possível consultar sua assinatura. Atualize a página ou fale com o suporte. Isso não significa que você está sem plano.';}
 else{
 badge.textContent=situations[plan.situacao]||'Consulte a equipe';badge.classList.toggle('is-open',Boolean(plan.ativo));
 const date=value=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR'):'—';
 details.textContent=plan.periodo?periods[plan.periodo].name+' · Início: '+date(plan.inicio)+' · Válido até '+date(plan.validade)+' (horário de Brasília).':'Ainda não há assinatura Viva vinculada a esta empresa. Se você já pagou, peça à equipe para conferir o vínculo.';
 if(plan.ativo&&plan.validade){const next=new Date(plan.validade+'T12:00:00');next.setDate(next.getDate()+1);details.textContent+=' Próxima renovação: '+next.toLocaleDateString('pt-BR')+'.';}
 const renew=document.querySelector('#renew-plan');renew.hidden=!plan.periodo;renew.href=contact('Olá equipe Viva Urânia! Quero renovar o Plano Parceiro Viva da empresa '+g.nome+', período '+(periods[plan.periodo]?.name||'mensal')+'.');
 document.querySelector('#subscription-offers').hidden=Boolean(plan.ativo);
 for(const [key,option] of Object.entries(periods)){
  const article=document.createElement('article'),title=document.createElement('h3'),price=document.createElement('p'),link=document.createElement('a');title.textContent=option.name;price.textContent=option.price+' '+option.term;link.className='button';link.textContent='Assinar '+option.name;link.target='_blank';link.rel='noopener';link.href=contact('Olá equipe Viva Urânia! Quero assinar o Plano Parceiro Viva para '+g.nome+', no período '+option.name+' por '+option.price+'.');article.append(title,price,link);document.querySelector('#viva-offers').append(article);
 }
 }

 document.querySelector('#support-link').href='https://wa.me/'+official+'?text='+encodeURIComponent(`Olá equipe Viva Urânia! Sou responsável pela empresa ${g.nome} e preciso de suporte com meu painel.`);
 document.querySelector('#commercial-link').href='https://wa.me/'+official+'?text='+encodeURIComponent(`Olá equipe Viva Urânia! Sou responsável pela empresa ${g.nome} e gostaria de consultar opções de divulgação e destaque.`);
}
