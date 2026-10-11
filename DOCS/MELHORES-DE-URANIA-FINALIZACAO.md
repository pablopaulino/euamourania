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

A votação pública exige Cloudflare Turnstile obrigatório. As indicações públicas também usam Turnstile quando configuradas.

Variável segura na Vercel:

- `TURNSTILE_SECRET_KEY`

Chave pública no frontend:

- definir `window.EUAM_TURNSTILE_SITE_KEY = "sua_site_key"` antes do script da página; ou
- adicionar `<meta name="turnstile-site-key" content="sua_site_key">`.

Se `TURNSTILE_SECRET_KEY` não estiver configurada, a votação fica indisponível por segurança. A chave secreta nunca deve ser colocada no navegador.

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

## Histórico oficial e divulgação dos vencedores

A migration `supabase/migrations/20261010_melhores_integridade_historico.sql` deve ser validada em homologação e aplicada **antes** de publicar o código que consulta a RPC `melhores_listar_resultados_publicos`. O deploy do site não aplica essa migration automaticamente.

Enquanto a edição está em indicações, votação ou apuração, as páginas de resultado não anunciam vencedores. Após a publicação oficial, o site disponibiliza o resultado anual, o Hall dos vencedores (`/melhores-de-urania/hall/`) e um perfil por vencedor (`/melhores-de-urania/{ano}/vencedores/{id}/`). Uma edição arquivada mantém essas páginas disponíveis somente quando possui resultado publicado.

Para revisar o visual sem uma edição concluída, a prévia local aceita `?demo=1` em `/melhores-de-urania/hall.html` e `/melhores-de-urania/vencedor.html`. Essas telas usam dados fictícios isolados e não registram resultado no banco.

O resultado é um snapshot: não pode ser republicado, excluído nem alterado junto com a edição, categoria ou indicado. Categorias públicas sem votos impedem a publicação. Em caso de empate na primeira colocação, a organização deve registrar a regra textual e selecionar, no cadastro da categoria, um dos indicados empatados; a função de publicação valida essa escolha. A decisão fica na tabela administrativa `melhores_desempates`, não na categoria pública, para não antecipar o vencedor. A RPC pública mostra as contagens somente quando `mostrar_votos_publicamente` estiver ativado; a tabela bruta permanece restrita ao painel.

Para conferir localmente o contrato e a interface, execute `npm run test:melhores-integridade` junto das demais suítes de Melhores. Esses testes estruturais não substituem uma validação de banco em homologação: criar uma edição de teste, encerrar a votação, testar categoria sem voto/empate, publicar uma vez, tentar republicar e conferir RLS como `anon`, usuário comum e administrador.
