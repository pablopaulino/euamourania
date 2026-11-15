-- Atualiza apenas os valores públicos antigos, preservando configurações personalizadas.
update public.configuracoes_site
set valor = 'contato@euamourania.com.br'
where chave = 'email_contato' and lower(trim(valor)) = 'euamourania@gmail.com';

update public.configuracoes_site
set valor = replace(valor, 'mailto:euamourania@gmail.com', 'mailto:contato@euamourania.com.br')
where chave = 'rodape_links' and valor like '%mailto:euamourania@gmail.com%';
