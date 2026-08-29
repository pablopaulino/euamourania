-- Integridade da hierarquia de Iniciativas da Comunidade.
-- Preparada para execução manual; não altera nem corrige dados existentes.

create or replace function public.validar_hierarquia_iniciativa_comunitaria()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  tipo_pai text;
begin
  if new.iniciativa_pai_id is null then
    return new;
  end if;

  if new.tipo <> 'acao' then
    raise exception 'Apenas iniciativas do tipo acao podem possuir iniciativa_pai_id.';
  end if;

  select tipo into tipo_pai
  from public.iniciativas_comunitarias
  where id = new.iniciativa_pai_id;

  if tipo_pai is distinct from 'projeto' then
    raise exception 'A iniciativa pai deve existir e ser do tipo projeto.';
  end if;

  return new;
end;
$$;

drop trigger if exists iniciativas_validar_hierarquia on public.iniciativas_comunitarias;
create trigger iniciativas_validar_hierarquia
before insert or update of tipo, iniciativa_pai_id
on public.iniciativas_comunitarias
for each row
execute function public.validar_hierarquia_iniciativa_comunitaria();
