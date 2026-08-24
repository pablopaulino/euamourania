alter table public.links
  add column if not exists rotulo text,
  add column if not exists descricao text,
  add column if not exists tipo_destaque text not null default 'normal';

insert into public.links (titulo, url, icone, rotulo, descricao, tipo_destaque, ordem, status)
select
  'Notícias',
  '/news/',
  'news',
  null,
  null,
  'normal',
  20,
  'ativo'
where not exists (
  select 1
  from public.links
  where url in ('/news', '/news/')
);

update public.links
set
  titulo = 'Grupo de notícias no WhatsApp',
  icone = coalesce(nullif(icone, ''), 'whatsapp'),
  rotulo = 'Grupo de notícias',
  descricao = 'Entre para receber avisos, notícias e informações importantes de Urânia direto no WhatsApp.',
  tipo_destaque = 'grupo_whatsapp',
  ordem = case when ordem is null or ordem = 0 then 30 else ordem end,
  status = 'ativo'
where url like 'https://chat.whatsapp.com/H8uSnazUFAREgQZziiwmPf%';

insert into public.links (titulo, url, icone, rotulo, descricao, tipo_destaque, ordem, status)
select
  'Grupo de notícias no WhatsApp',
  'https://chat.whatsapp.com/H8uSnazUFAREgQZziiwmPf?s=cl&p=i&ilr=0',
  'whatsapp',
  'Grupo de notícias',
  'Entre para receber avisos, notícias e informações importantes de Urânia direto no WhatsApp.',
  'grupo_whatsapp',
  30,
  'ativo'
where not exists (
  select 1
  from public.links
  where url like 'https://chat.whatsapp.com/H8uSnazUFAREgQZziiwmPf%'
);

update public.links
set
  titulo = 'Viva Urânia',
  icone = coalesce(nullif(icone, ''), 'app'),
  rotulo = 'O app da cidade',
  descricao = 'Guia, turismo, favoritos e informações de Urânia na palma da sua mão.',
  tipo_destaque = 'app',
  ordem = case when ordem is null or ordem = 0 then 35 else ordem end,
  status = 'ativo'
where url = '/app'
   or lower(coalesce(titulo, '')) in ('baixe o app', 'viva urânia', 'viva urania');

insert into public.links (titulo, url, icone, rotulo, descricao, tipo_destaque, ordem, status)
select
  'Viva Urânia',
  '/app',
  'app',
  'O app da cidade',
  'Guia, turismo, favoritos e informações de Urânia na palma da sua mão.',
  'app',
  35,
  'ativo'
where not exists (
  select 1
  from public.links
  where url = '/app'
);
