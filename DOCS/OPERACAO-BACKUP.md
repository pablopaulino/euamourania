# Operação, backup e recuperação

## Rotina diária

Verifique dashboard, rascunhos, eventos/campanhas vencendo, falhas de envio e páginas principais. Publique somente após prévia.

## Rotina semanal

Teste login/logout, uma notícia por slug, guia, eventos, publicidade, inscrição e descadastro. Revise atividades administrativas e métricas anormais.

## Backup

Use os backups do Supabase compatíveis com o plano e mantenha exportações periódicas de schema, dados e Storage. Antes de toda migração importante, gere um ponto de recuperação. Documente data, responsável e local protegido.

## Teste de restauração

Trimestralmente, restaure em projeto isolado; confirme contagens, relacionamentos, políticas RLS e leitura pública. Backup sem restauração testada não é garantia.

## Continuidade

Se o CMS falhar, preserve o site público e suspenda gravações afetadas. Para deploy defeituoso, promova o último deployment saudável. Para banco, não improvise comandos destrutivos: diagnostique, preserve evidências e siga a migração/restore.