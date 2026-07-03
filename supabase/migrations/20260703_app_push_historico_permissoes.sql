-- Permissões específicas para leitura, criação, envio e exclusão do histórico push.

drop policy if exists "admin_gerencia_notificacoes" on public.app_notificacoes;

drop policy if exists "admin_le_notificacoes" on public.app_notificacoes;
create policy "admin_le_notificacoes" on public.app_notificacoes
for select to authenticated
using (public.tem_permissao_admin('notificacoes', 'ler'));

drop policy if exists "admin_cria_notificacoes" on public.app_notificacoes;
create policy "admin_cria_notificacoes" on public.app_notificacoes
for insert to authenticated
with check (public.tem_permissao_admin('notificacoes', 'criar'));

drop policy if exists "admin_atualiza_notificacoes" on public.app_notificacoes;
create policy "admin_atualiza_notificacoes" on public.app_notificacoes
for update to authenticated
using (public.tem_permissao_admin('notificacoes', 'enviar'))
with check (public.tem_permissao_admin('notificacoes', 'enviar'));

drop policy if exists "admin_exclui_notificacoes" on public.app_notificacoes;
create policy "admin_exclui_notificacoes" on public.app_notificacoes
for delete to authenticated
using (public.tem_permissao_admin('notificacoes', 'excluir'));

insert into public.admin_permissoes_funcao (funcao, modulo, acao) values
  ('administrador', 'notificacoes', 'excluir'),
  ('comunicacao', 'notificacoes', 'excluir')
on conflict do nothing;
