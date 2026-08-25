-- Permissões administrativas para o módulo Telefones úteis.
-- Não altera estrutura nem dados; apenas permite que o painel gerencie contatos.

grant select, insert, update, delete on public.useful_contact_categories to authenticated;
grant select, insert, update, delete on public.useful_contacts to authenticated;
grant select, update on public.useful_contact_reports to authenticated;

drop policy if exists useful_contact_categories_admin_select on public.useful_contact_categories;
create policy useful_contact_categories_admin_select
on public.useful_contact_categories
for select
to authenticated
using (public.tem_permissao_admin('configuracoes', 'ler'));

drop policy if exists useful_contact_categories_admin_insert on public.useful_contact_categories;
create policy useful_contact_categories_admin_insert
on public.useful_contact_categories
for insert
to authenticated
with check (public.tem_permissao_admin('configuracoes', 'editar'));

drop policy if exists useful_contact_categories_admin_update on public.useful_contact_categories;
create policy useful_contact_categories_admin_update
on public.useful_contact_categories
for update
to authenticated
using (public.tem_permissao_admin('configuracoes', 'editar'))
with check (public.tem_permissao_admin('configuracoes', 'editar'));

drop policy if exists useful_contact_categories_admin_delete on public.useful_contact_categories;
create policy useful_contact_categories_admin_delete
on public.useful_contact_categories
for delete
to authenticated
using (public.tem_permissao_admin('configuracoes', 'editar'));

drop policy if exists useful_contacts_admin_select on public.useful_contacts;
create policy useful_contacts_admin_select
on public.useful_contacts
for select
to authenticated
using (public.tem_permissao_admin('configuracoes', 'ler'));

drop policy if exists useful_contacts_admin_insert on public.useful_contacts;
create policy useful_contacts_admin_insert
on public.useful_contacts
for insert
to authenticated
with check (public.tem_permissao_admin('configuracoes', 'editar'));

drop policy if exists useful_contacts_admin_update on public.useful_contacts;
create policy useful_contacts_admin_update
on public.useful_contacts
for update
to authenticated
using (public.tem_permissao_admin('configuracoes', 'editar'))
with check (public.tem_permissao_admin('configuracoes', 'editar'));

drop policy if exists useful_contacts_admin_delete on public.useful_contacts;
create policy useful_contacts_admin_delete
on public.useful_contacts
for delete
to authenticated
using (public.tem_permissao_admin('configuracoes', 'editar'));

drop policy if exists useful_contact_reports_admin_select on public.useful_contact_reports;
create policy useful_contact_reports_admin_select
on public.useful_contact_reports
for select
to authenticated
using (public.tem_permissao_admin('configuracoes', 'ler'));

drop policy if exists useful_contact_reports_admin_update on public.useful_contact_reports;
create policy useful_contact_reports_admin_update
on public.useful_contact_reports
for update
to authenticated
using (public.tem_permissao_admin('configuracoes', 'editar'))
with check (public.tem_permissao_admin('configuracoes', 'editar'));
