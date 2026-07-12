# Melhores de Urânia — finalização do pedido original

Esta etapa completa os pontos avançados que estavam preparados ou parciais no módulo.

## Cron de retenção pela Vercel

Além da tentativa de agendamento via `pg_cron`, o projeto possui um cron no `vercel.json`:

`/api/melhores-votar?cron=limpeza`

Agenda: `17 6 * * *`, equivalente a 03:17 no horário de Brasília.

A rota reaproveita a função existente de votação para evitar ultrapassar o limite de funções serverless do plano Hobby da Vercel.

Essa rotina chama:

`public.melhores_limpar_votos_expirados()`

Ela consolida a edição, remove votos individuais após o prazo de retenção e registra auditoria.

## Cloudflare Turnstile

A votação e as indicações públicas possuem suporte opcional ao Cloudflare Turnstile.

Variável segura na Vercel:

- `TURNSTILE_SECRET_KEY`

Chave pública no frontend:

- definir `window.EUAM_TURNSTILE_SITE_KEY = "sua_site_key"` antes do script da página; ou
- adicionar `<meta name="turnstile-site-key" content="sua_site_key">`.

Se `TURNSTILE_SECRET_KEY` não estiver configurada, o sistema continua funcionando com as proteções já existentes: cookie técnico, hash de visitante, hash de IP, hash de user-agent, limite de tentativas e status `suspeito`/`bloqueado`.

Quando `TURNSTILE_SECRET_KEY` estiver configurada, votos e indicações precisam enviar token válido. A chave secreta nunca deve ser colocada no navegador.

## Audiência avançada

O módulo registra eventos específicos para acompanhar a participação:

- visualização da edição;
- clique em categoria;
- impressão de indicado;
- início de voto;
- voto concluído;
- abandono de voto;
- erro de voto;
- início/conclusão/erro de indicação;
- clique em compartilhar;
- clique em chamadas da página.

## Experiência pós-voto

Após votar, o visitante recebe um pequeno painel de confirmação com opção de compartilhar a votação e continuar navegando pelo portal.

## Segurança complementar

As indicações públicas agora também possuem campo honeypot invisível para reduzir spam automatizado.
