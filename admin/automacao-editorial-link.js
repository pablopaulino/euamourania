// Coloca o acesso junto à fila existente sem modificar o componente da fila.
const attachEditorialLink = () => {
  const actions=document.querySelector('.news-admin-head-actions');
  if(!actions || actions.querySelector('[data-editorial-automation-link]')) return;
  const link=document.createElement('a');
  link.href='/admin/automacao-editorial.html';
  link.className='admin-button secondary';
  link.dataset.editorialAutomationLink='';
  link.textContent='Automação editorial';
  actions.prepend(link);
};
new MutationObserver(attachEditorialLink).observe(document.body,{childList:true,subtree:true});
attachEditorialLink();
