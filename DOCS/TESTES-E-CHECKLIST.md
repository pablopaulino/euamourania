# Testes e checklist

## Automático

- `npm test`: sintaxe JavaScript, referências HTML, arquivos obrigatórios e varredura de segredos.
- `npm run smoke`: rotas públicas essenciais e proteção da API de newsletter.
- GitHub Actions: valida todo PR e executa smoke após mudanças em `main`.

## Antes do merge

- CI verde e Preview Vercel disponível.
- Home, notícias/lista/detalhe, guia, turismo, eventos e links em desktop/mobile.
- Sem erro no console ou requisição 4xx/5xx inesperada.
- Login/logout e autorização de não administrador.
- Criar/editar/publicar notícia; destaque; categoria; guia; evento; campanha.
- Redator envia rascunho; Editor solicita ajustes, aprova e publica; tentativa direta é bloqueada.
- Audiência: períodos, comparação, rankings, publicidade e exportação CSV.
- GA4: recusar não carrega a tag; aceitar carrega somente o ID público.
- Google: endpoint de audiência rejeita visitante sem sessão e nunca retorna a credencial.
- Enviar newsletter de teste e validar descadastro.
- Canonical, OG, sitemap e robots.
- Teclado, foco, labels, alt e contraste básico.

## Depois do deploy

Execute smoke, confirme domínio/certificado, teste uma URL por slug e monitore Vercel/Supabase/Brevo. Registre qualquer regressão como issue com passos, navegador, URL e captura.
