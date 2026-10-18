import {acesso} from './_layout.js';
if(acesso?.guia){
 const g=acesso.guia;document.querySelector('#plan-name').textContent=g.nome;
 document.querySelector('#publication-note').textContent=g.status==='publicado'?'Sua vitrine está publicada no Guia.':'Seu cadastro ainda aguarda publicação. Os materiais públicos serão liberados quando a equipe publicar sua vitrine.';
 const official='5517976005583';
 document.querySelector('#support-link').href='https://wa.me/'+official+'?text='+encodeURIComponent(`Olá equipe Viva Urânia! Sou responsável pela empresa ${g.nome} e preciso de suporte com meu painel.`);
 document.querySelector('#commercial-link').href='https://wa.me/'+official+'?text='+encodeURIComponent(`Olá equipe Viva Urânia! Sou responsável pela empresa ${g.nome} e gostaria de consultar opções de divulgação e destaque.`);
}
