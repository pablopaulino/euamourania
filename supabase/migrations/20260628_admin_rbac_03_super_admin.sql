-- Complemento obrigatório das migrações RBAC.
-- Impede lockout administrativo mesmo por chamada REST direta.
begin;

create or replace function public.proteger_ultimo_super_admin()
returns trigger language plpgsql security definer set search_path=public as $$
declare ativos bigint;
begin
 if old.funcao='super_admin' and old.ativo=true and(
   tg_op='DELETE' or new.funcao<>'super_admin' or new.ativo=false
 )then
   select count(*) into ativos from public.usuarios_admin where funcao='super_admin' and ativo=true;
   if ativos<=1 then raise exception 'É obrigatório manter ao menos um Super Admin ativo.' using errcode='23514';end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;

drop trigger if exists usuarios_admin_proteger_super on public.usuarios_admin;
create trigger usuarios_admin_proteger_super
before update or delete on public.usuarios_admin
for each row execute function public.proteger_ultimo_super_admin();

commit;
