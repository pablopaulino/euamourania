# Arquitetura

## Visão geral

O portal é uma aplicação HTML/CSS/JavaScript sem framework, distribuída pela Vercel. O navegador consulta o Supabase usando a chave publicável; RLS decide o que cada visitante ou administrador pode acessar. Funções em `api/` entregam SEO dinâmico, sitemaps e integração segura com Brevo.

## Fluxos

- Público: HTML → módulos de `assets/js/pages/` → serviços Supabase.
- Administração: Supabase Auth → `usuarios_admin` → telas em `admin/` → RLS.
- Notícia amigável: `/noticias/:slug` → `api/noticia.js` → HTML com Open Graph → módulo público.
- Newsletter: formulário → RPC Supabase; painel → função Vercel → Brevo.
- Publicidade: campanhas/posições → renderização pública → RPC de métricas.

## Decisões e limites

A arquitetura atual é econômica e adequada ao porte municipal. O custo é a existência de módulos grandes e composição por scripts de aprimoramento. Antes de crescimento significativo, priorizar módulos menores, ambiente local reproduzível e testes end-to-end.

## Como expandir

Novos módulos devem seguir: tabela + RLS + serviço + tela administrativa + módulo público opcional + teste + documentação. Segredos pertencem exclusivamente às variáveis da Vercel.
