insert into public.links (titulo, url, icone, ordem, status)
select 'Baixe o app', '/app', 'app', 35, 'ativo'
where not exists (
  select 1
  from public.links
  where url = '/app'
     or lower(coalesce(titulo, '')) like '%baixe o app%'
     or lower(coalesce(titulo, '')) like '%viva urania%'
);
