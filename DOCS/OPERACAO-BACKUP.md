# Operação, backup e recuperação

## Rotina diária

Verifique dashboard, rascunhos, eventos/campanhas vencendo, falhas de envio e páginas principais. Publique somente após prévia.

## Rotina semanal

Teste login/logout, uma notícia por slug, guia, eventos, publicidade, inscrição e descadastro. Revise atividades administrativas e métricas anormais.

## Backup

Use os backups do Supabase compatíveis com o plano e mantenha exportações periódicas de schema, dados e Storage. Antes de toda migração importante, gere um ponto de recuperação. Documente data, responsável e local protegido.

## Teste de restauração

Trimestralmente, restaure em projeto isolado; confirme contagens, relacionamentos, políticas RLS e leitura pública. Backup sem restauração testada não é garantia.

### Checklist de restauração do Supabase

1. Criar um projeto Supabase isolado apenas para teste.
2. Restaurar o backup mais recente ou importar schema, dados e Storage exportados.
3. Conferir tabelas críticas: `noticias`, `guia_comercial`, `turismo`, `eventos`, `melhores_edicoes`, `melhores_categorias`, `melhores_indicados`, `melhores_votos`, `melhores_resultados` e `analytics_eventos`.
4. Conferir Storage/biblioteca de mídia e URLs públicas.
5. Rodar contagens comparativas entre produção e restauração.
6. Testar login administrativo com usuário de teste.
7. Testar leitura pública com chave anon.
8. Testar RLS tentando ler/escrever dados sem permissão.
9. Testar uma votação do Melhores de Urânia em ambiente isolado, com `MELHORES_VOTO_SECRET` e `TURNSTILE_SECRET_KEY` configurados.
10. Registrar data, responsável, resultado, problemas encontrados e ações corretivas.

Status atual: procedimento documentado. O teste real de restauração deve ser executado fora da produção antes do lançamento oficial.

## Continuidade

Se o CMS falhar, preserve o site público e suspenda gravações afetadas. Para deploy defeituoso, promova o último deployment saudável. Para banco, não improvise comandos destrutivos: diagnostique, preserve evidências e siga a migração/restore.
