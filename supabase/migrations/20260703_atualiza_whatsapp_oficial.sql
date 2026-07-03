insert into public.configuracoes_site (chave, valor, tipo)
values ('whatsapp', '5517976005583', 'telefone')
on conflict (chave) do update
set valor = excluded.valor,
    tipo = excluded.tipo;

update public.links
set url = replace(url, '5517981344558', '5517976005583')
where url like '%5517981344558%';
