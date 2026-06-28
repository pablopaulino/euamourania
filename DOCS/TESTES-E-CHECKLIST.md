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
- Enviar newsletter de teste e validar descadastro.
- Canonical, OG, sitemap e robots.
- Teclado, foco, labels, alt e contraste básico.

## Depois do deploy

Execute smoke, confirme domínio/certificado, teste uma URL por slug e monitore Vercel/Supabase/Brevo. Registre qualquer regressão como issue com passos, navegador, URL e captura.