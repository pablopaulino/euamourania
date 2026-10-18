import {acesso,notice} from './_layout.js';
if(acesso?.guia){
 const g=acesso.guia,ready=g.status==='publicado'&&g.slug;
 document.querySelector('#kit-unavailable').hidden=Boolean(ready);document.querySelector('#kit-content').hidden=!ready;
 if(ready){
  const url='https://euamourania.com.br/guia/'+encodeURIComponent(g.slug);
  for(const id of ['sign-name','seal-name'])document.querySelector('#'+id).textContent=g.nome;
  document.querySelector('#sign-category').textContent=g.categoria_nome||'';
  const link=document.querySelector('#sign-url');link.href=url;link.textContent=url;
  document.querySelector('#bio-text').textContent='📍 Veja nossos horários, fotos e promoções no Guia Oficial Viva Urânia: '+url;
  document.querySelector('#whatsapp-text').textContent='Olá! Agora nossa empresa está no Guia Oficial Viva Urânia. Confira nossos horários de atendimento, fotos e novidades: '+url;
  document.querySelectorAll('[data-copy]').forEach(button=>{const label=button.textContent;button.onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).textContent);button.textContent='Copiado!';setTimeout(()=>button.textContent=label,3000);notice('Texto copiado!');}catch{notice('Não foi possível copiar. Selecione o texto e copie manualmente.',true);}};});
  function download(blob,name){const local=URL.createObjectURL(blob),a=document.createElement('a');a.href=local;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(local),60000);}
  let qrBlob,qrObject;const image=document.querySelector('#business-qr'),print=document.querySelector('#print-sign'),save=document.querySelector('#download-qr'),retry=document.querySelector('#retry-qr'),status=document.querySelector('#qr-status');
  async function loadQr(){
   print.disabled=true;save.disabled=true;retry.hidden=true;status.textContent='Preparando QR Code…';
   try{const response=await fetch('https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=24&ecc=M&format=png&data='+encodeURIComponent(url),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();qrBlob=await response.blob();if(qrObject)URL.revokeObjectURL(qrObject);qrObject=URL.createObjectURL(qrBlob);image.src=qrObject;await image.decode();print.disabled=false;save.disabled=false;status.textContent='QR Code pronto. Teste com a câmera antes de imprimir várias cópias.';}catch{status.textContent='Não foi possível gerar o QR Code. Tente novamente.';retry.hidden=false;}
  }
  retry.onclick=loadQr;save.onclick=()=>download(qrBlob,'qr-viva-'+g.slug+'.png');print.onclick=()=>window.print();loadQr();
  async function seal(format){
   const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=format==='stories'?1920:1080;const ctx=canvas.getContext('2d'),center=canvas.height/2;
   ctx.fillStyle='#fcf8ef';ctx.fillRect(0,0,1080,canvas.height);ctx.fillStyle='#ff8900';ctx.fillRect(0,0,1080,18);ctx.fillStyle='#f50019';ctx.fillRect(0,canvas.height-18,1080,18);
   const logo=new Image();logo.src='/assets/viva-origem-colorido.svg';await logo.decode();ctx.drawImage(logo,450,center-340,180,150);
   ctx.textAlign='center';ctx.fillStyle='#123849';ctx.font='bold 28px sans-serif';ctx.fillText('ESTAMOS NO VIVA URÂNIA',540,center-130);
   ctx.font='bold 58px sans-serif';ctx.fillText('Empresa verificada',540,center-40);
   ctx.fillStyle='#a85b00';ctx.font='36px sans-serif';const words=String(g.nome).split(/\s+/);let line='',lines=[];for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>880&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
   lines.slice(0,3).forEach((text,i)=>ctx.fillText(text,540,center+35+i*48,880));
   ctx.fillStyle='#607783';ctx.font='26px sans-serif';ctx.fillText('Encontre nossa empresa no Guia Viva Urânia',540,center+240);ctx.font='24px sans-serif';ctx.fillText('euamourania.com.br/guia',540,center+285);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,'selo-viva-'+g.slug+'-'+format+'.png');
  }
  document.querySelectorAll('[data-seal]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await seal(button.dataset.seal);notice('Selo pronto para baixar!');}catch{notice('Não foi possível gerar o selo. Tente novamente.',true);}finally{button.disabled=false;}});
 }
}
