-- Divulgação gradual da edição 2026. Todos os horários usam Brasília.
begin;
-- TRUNCATE não respeita RLS nem os bloqueios por linha da vitrine.
revoke truncate on public.app_melhores_campanhas, public.app_melhores_vencedores from public, anon, authenticated;
create table premios_privado.revelacoes (
  edicao_id uuid not null references public.melhores_edicoes(id),
  categoria_id uuid not null,
  publicar_em timestamptz not null,
  primary key (edicao_id,categoria_id),
  foreign key (categoria_id,edicao_id) references public.melhores_categorias(id,edicao_id)
);
revoke all on premios_privado.revelacoes from public,anon,authenticated;
create table premios_privado.revelacao_campanhas (
  edicao_id uuid primary key references public.melhores_edicoes(id),
  campanha_id uuid not null unique references public.app_melhores_campanhas(id)
);
revoke all on premios_privado.revelacao_campanhas from public,anon,authenticated;

-- Revela apenas se a categoria faz parte da apuração fechada e seu horário chegou.
create or replace function public.melhores_revelacao_resultado_visivel(p_resultado uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,premios_privado as $$
  select exists(select 1 from public.melhores_resultados r
    join public.melhores_edicoes e on e.id=r.edicao_id
    join premios_privado.agendamentos a on a.edicao_id=r.edicao_id
    join premios_privado.revelacoes x on x.edicao_id=r.edicao_id and x.categoria_id=r.categoria_id
    where r.id=p_resultado and r.vencedor is true and e.ano=2026 and e.status='apuracao'
      and a.publicado_em is null and x.publicar_em<=now());
$$;
revoke all on function public.melhores_revelacao_resultado_visivel(uuid) from public,anon,authenticated;
grant execute on function public.melhores_revelacao_resultado_visivel(uuid) to anon,authenticated;

create or replace function public.melhores_revelacao_campanha_visivel(p_campanha uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,premios_privado as $$
  select exists(select 1 from premios_privado.revelacao_campanhas m
    join public.app_melhores_campanhas c on c.id=m.campanha_id and c.edicao_id=m.edicao_id
    join public.melhores_edicoes e on e.id=m.edicao_id and e.ano=2026 and e.status='apuracao'
    join premios_privado.agendamentos a on a.edicao_id=e.id and a.publicado_em is null
    where m.campanha_id=p_campanha and c.ativo and c.status in ('ativa','agendada')
      and c.exibir_inicio<=now() and c.exibir_fim>=now()
      and exists(select 1 from premios_privado.revelacoes x where x.edicao_id=e.id and x.publicar_em<=now()));
$$;
revoke all on function public.melhores_revelacao_campanha_visivel(uuid) from public,anon,authenticated;
grant execute on function public.melhores_revelacao_campanha_visivel(uuid) to anon,authenticated;

create or replace function public.melhores_revelacao_app_visivel(p_vencedor uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,premios_privado as $$
  select exists(select 1 from public.app_melhores_vencedores w
    join premios_privado.revelacao_campanhas m on m.campanha_id=w.campanha_id
    join public.melhores_resultados r on r.id=w.resultado_id and r.edicao_id=m.edicao_id and r.categoria_id=w.categoria_id and r.indicado_id=w.indicado_id
    where w.id=p_vencedor and w.status='ativo' and public.melhores_revelacao_campanha_visivel(w.campanha_id)
      and public.melhores_revelacao_resultado_visivel(r.id));
$$;
revoke all on function public.melhores_revelacao_app_visivel(uuid) from public,anon,authenticated;
grant execute on function public.melhores_revelacao_app_visivel(uuid) to anon,authenticated;

create policy app_melhores_campanhas_revelacao_2026 on public.app_melhores_campanhas
  for select to anon,authenticated using (public.melhores_revelacao_campanha_visivel(id));
create policy app_melhores_vencedores_revelacao_2026 on public.app_melhores_vencedores
  for select to anon,authenticated using (public.melhores_revelacao_app_visivel(id));

create or replace function public.melhores_listar_resultados_publicos(
  p_edicao uuid default null,
  p_somente_vencedores boolean default false
)
returns table (
  id uuid,
  edicao_id uuid,
  categoria_id uuid,
  indicado_id uuid,
  votos_site integer,
  percentual_site numeric,
  votos_instagram integer,
  percentual_instagram numeric,
  pontuacao_final numeric,
  colocacao integer,
  vencedor boolean,
  selo text,
  empate boolean,
  criterio_aplicado text,
  metodologia_resumida text,
  publicado boolean,
  publicado_em timestamptz,
  melhores_categorias jsonb,
  melhores_indicados jsonb,
  melhores_edicoes jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    r.id, r.edicao_id, r.categoria_id, r.indicado_id,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.votos_site else null end,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.percentual_site else null end,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.votos_instagram else null end,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.percentual_instagram else null end,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.pontuacao_final else null end,
    r.colocacao, r.vencedor, r.selo, r.empate, r.criterio_aplicado,
    r.metodologia_resumida, true, coalesce(r.publicado_em, (select x.publicar_em from premios_privado.revelacoes x where x.edicao_id=r.edicao_id and x.categoria_id=r.categoria_id)),
    pg_catalog.jsonb_build_object('nome', c.nome),
    pg_catalog.jsonb_build_object(
      'nome', i.nome,
      'imagem_url', i.imagem_url,
      'descricao_curta', i.descricao_curta,
      'guia_comercial_id', i.guia_comercial_id,
      'guia_comercial', case when g.id is null then null else
        pg_catalog.jsonb_build_object(
          'id', g.id, 'nome', g.nome, 'slug', g.slug,
          'imagem_url', g.imagem_url, 'categoria_nome', g.categoria_nome,
          'status', g.status
        ) end
    ),
    pg_catalog.jsonb_build_object('ano', e.ano, 'nome', e.nome)
  from public.melhores_resultados r
  join public.melhores_edicoes e on e.id = r.edicao_id
  join public.melhores_categorias c on c.id = r.categoria_id
  join public.melhores_indicados i on i.id = r.indicado_id
  left join public.guia_comercial g
    on g.id = i.guia_comercial_id and g.status = 'publicado'
  where ((r.publicado = true and (e.status = 'resultado_publicado' or (e.status = 'arquivada' and e.resultado_publicado_em is not null)))
    or (e.ano=2026 and e.status='apuracao' and r.vencedor is true and public.melhores_revelacao_resultado_visivel(r.id)))
    and (p_edicao is null or r.edicao_id = p_edicao)
    and (not coalesce(p_somente_vencedores, false) or r.vencedor = true)
  order by e.ano desc, r.categoria_id, r.colocacao, i.nome;
$$;

revoke all on function public.melhores_listar_resultados_publicos(uuid,boolean) from public;
grant execute on function public.melhores_listar_resultados_publicos(uuid,boolean)
  to anon, authenticated;


create or replace function public.app_melhores_validar_campanha()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_edicao record;
  v_vencedores integer;
  v_sem_categoria integer;
begin
  if new.ativo = false and new.status not in('ativa','agendada') then
    return new;
  end if;

  if new.edicao_id is null then
    raise exception 'Vincule uma edição antes de ativar a campanha do app.' using errcode='23514';
  end if;
  if new.exibir_inicio is null or new.exibir_fim is null or new.exibir_inicio >= new.exibir_fim then
    raise exception 'Defina início e término válidos para exibir no app.' using errcode='23514';
  end if;

  select id,status,resultado_publicado_em,divulgacao_em
  into v_edicao
  from public.melhores_edicoes
  where id=new.edicao_id;

  if v_edicao.id is null or (v_edicao.status <> 'resultado_publicado' and not (v_edicao.status='apuracao' and exists(select 1 from premios_privado.revelacao_campanhas m where m.edicao_id=v_edicao.id and m.campanha_id=new.id))) then
    raise exception 'A edição precisa ter resultado oficialmente publicado.' using errcode='23514';
  end if;

  select count(*) into v_vencedores
  from public.app_melhores_vencedores
  where campanha_id=new.id and status='ativo';

  if v_vencedores = 0 then
    raise exception 'Importe ou cadastre ao menos um vencedor antes de ativar.' using errcode='23514';
  end if;

  select count(*) into v_sem_categoria
  from public.app_melhores_vencedores
  where campanha_id=new.id and categoria_id is null and status='ativo';

  if v_sem_categoria > 0 then
    raise exception 'Há vencedor ativo sem categoria.' using errcode='23514';
  end if;

  return new;
end;
$$;

create or replace function public.melhores_registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_edicao uuid;
  v_entidade_id uuid;
  v_antes jsonb;
  v_depois jsonb;
begin
  v_antes := case when tg_op in('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_depois := case when tg_op in('INSERT','UPDATE') then to_jsonb(new) else null end;

  v_edicao := coalesce(
    nullif(v_depois->>'edicao_id','')::uuid,
    nullif(v_antes->>'edicao_id','')::uuid,
    nullif(v_depois->>'id','')::uuid,
    nullif(v_antes->>'id','')::uuid
  );
  if tg_table_name='app_melhores_vencedores' then
    select c.edicao_id into v_edicao from public.app_melhores_campanhas c where c.id=coalesce(nullif(v_depois->>'campanha_id','')::uuid,nullif(v_antes->>'campanha_id','')::uuid);
  elsif tg_table_name='melhores_edicoes' then
    v_edicao := coalesce(
      nullif(v_depois->>'id','')::uuid,
      nullif(v_antes->>'id','')::uuid
    );
  end if;
  v_entidade_id := coalesce(
    nullif(v_depois->>'id','')::uuid,
    nullif(v_antes->>'id','')::uuid
  );

  insert into public.melhores_auditoria(
    edicao_id,
    usuario_id,
    acao,
    entidade,
    entidade_id,
    valores_anteriores,
    valores_posteriores
  ) values(
    v_edicao,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    v_entidade_id,
    v_antes,
    v_depois
  );

  return coalesce(new, old);
end;
$$;

-- Cada linha da apuração já preparada corresponde a uma categoria da lista.
do $$
declare v_edicao uuid; v_campanha uuid; v_total integer; v_registro record;
begin
  if (select count(*) from public.melhores_edicoes where ano=2026)<>1 then raise exception 'A edição 2026 não é única.'; end if;
  select id into v_edicao from public.melhores_edicoes where ano=2026;
  perform 1 from premios_privado.agendamentos where edicao_id=v_edicao and publicado_em is null for update;
  if not found then raise exception 'Não há apuração preparada e pendente para 2026.'; end if;
  perform 1 from public.melhores_edicoes where id=v_edicao and status='apuracao' for update;
  if not found then raise exception 'A edição 2026 não está em apuração.'; end if;
  if now() >= timestamptz '2026-11-23 10:00:00-03' then raise exception 'O primeiro horário já chegou; é necessário revisar o cronograma.'; end if;
  if exists(select 1 from public.melhores_resultados where edicao_id=v_edicao and publicado) then raise exception 'Já há resultados publicados; não alterar este cronograma.'; end if;
  if exists(select 1 from public.app_melhores_campanhas where edicao_id=v_edicao) then raise exception 'Já existe uma campanha do aplicativo para a edição; revise antes de continuar.'; end if;
  create temporary table agenda_temporaria(nome text primary key, publicar_em timestamptz not null) on commit drop;
  insert into agenda_temporaria values
    ('Melhor Academia','2026-11-23 10:00:00-03'),('Melhor Açaíteria','2026-11-23 15:00:00-03'),('Melhor Atendimento','2026-11-23 20:00:00-03'),
    ('Melhor Atrativo Turístico','2026-11-24 10:00:00-03'),('Melhor Auto Center / Mecânica','2026-11-24 15:00:00-03'),('Melhor Bar ou Boteco','2026-11-24 20:00:00-03'),
    ('Melhor Barbearia','2026-11-25 10:00:00-03'),('Melhor Comércio','2026-11-25 15:00:00-03'),('Melhor Empresa de Festas e Eventos','2026-11-25 20:00:00-03'),
    ('Melhor Escritório de Advocacia','2026-11-26 10:00:00-03'),('Melhor Farmácia','2026-11-26 15:00:00-03'),('Melhor Lanchonete / Hamburgueria','2026-11-26 20:00:00-03'),
    ('Melhor Loja de Roupas','2026-11-27 10:00:00-03'),('Melhor Mercado','2026-11-27 15:00:00-03'),('Melhor Padaria','2026-11-27 20:00:00-03'),
    ('Melhor Pet Shop / Veterinária','2026-11-28 10:00:00-03'),('Melhor Pizzaria','2026-11-28 15:00:00-03'),('Melhor Prestador de Serviços','2026-11-28 20:00:00-03'),
    ('Melhor Restaurante','2026-11-29 10:00:00-03'),('Melhor Salão de Beleza','2026-11-29 15:00:00-03'),('Melhor Sorveteria','2026-11-29 20:00:00-03');
  if (select count(*) from public.melhores_categorias where edicao_id=v_edicao and status='ativo' and visibilidade_publica)<>21 then raise exception 'A edição não possui exatamente 21 categorias públicas ativas.'; end if;
  if exists(select 1 from agenda_temporaria x where (select count(*) from public.melhores_categorias c where c.edicao_id=v_edicao and c.status='ativo' and c.visibilidade_publica and c.nome=x.nome)<>1) then raise exception 'Categoria ausente ou duplicada no cronograma.'; end if;
  if exists(select 1 from public.melhores_categorias c where c.edicao_id=v_edicao and c.status='ativo' and c.visibilidade_publica and (select count(*) from public.melhores_resultados r where r.edicao_id=v_edicao and r.categoria_id=c.id and r.vencedor and not r.publicado)<>1) then raise exception 'Cada categoria precisa ter exatamente um vencedor preparado.'; end if;
  if (select count(*) from public.melhores_resultados where edicao_id=v_edicao and not publicado)<>(select total from premios_privado.agendamentos where edicao_id=v_edicao and publicado_em is null) then raise exception 'A apuração preparada está incompleta.'; end if;
  insert into premios_privado.revelacoes(edicao_id,categoria_id,publicar_em)
    select v_edicao,c.id,x.publicar_em from agenda_temporaria x join public.melhores_categorias c on c.edicao_id=v_edicao and c.nome=x.nome;
  get diagnostics v_total=row_count;
  if v_total<>21 then raise exception 'Cronograma incompleto.'; end if;
  -- Atualiza somente a data final; a trava é restaurada na mesma transação.
  alter table public.melhores_edicoes disable trigger zz_agendamento_proteger;
  update public.melhores_edicoes set divulgacao_em=timestamptz '2026-11-23 10:00:00-03',resultado_publicado_em=null where id=v_edicao;
  alter table public.melhores_edicoes enable trigger zz_agendamento_proteger;
  update premios_privado.agendamentos set divulgar_em=timestamptz '2026-11-29 20:00:00-03' where edicao_id=v_edicao and publicado_em is null;
  insert into public.app_melhores_campanhas(edicao_id,titulo,subtitulo,texto_botao,link_oficial,status,ativo,exibir_inicio,exibir_fim,exibir_avulsos)
    values(v_edicao,'Melhores de Urânia 2026','Conheça os vencedores divulgados pela comunidade.','Ver vencedores','https://euamourania.com.br/melhores-de-urania/2026/resultados/','rascunho',false,timestamptz '2026-11-23 10:00:00-03',timestamptz '2027-11-30 23:59:00-03',true)
    returning id into v_campanha;
  insert into premios_privado.revelacao_campanhas(edicao_id,campanha_id) values(v_edicao,v_campanha);
  insert into public.app_melhores_vencedores(campanha_id,resultado_id,categoria_id,indicado_id,guia_comercial_id,categoria_nome,nome_exibido,imagem_url,descricao_curta,selo,ordem,instagram,whatsapp,site,endereco,status,origem)
    select v_campanha,r.id,c.id,i.id,i.guia_comercial_id,c.nome,i.nome,coalesce(i.imagem_url,g.imagem_url),coalesce(i.descricao_curta,g.descricao),coalesce(r.selo,'Vencedor 2026'),row_number() over(order by x.publicar_em)::integer,coalesce(i.instagram,g.instagram),coalesce(i.whatsapp,g.whatsapp),coalesce(i.site,g.site),coalesce(i.endereco,g.endereco),'ativo','resultado_oficial'
    from public.melhores_resultados r join public.melhores_categorias c on c.id=r.categoria_id join public.melhores_indicados i on i.id=r.indicado_id
      join premios_privado.revelacoes x on x.edicao_id=r.edicao_id and x.categoria_id=r.categoria_id
      left join public.guia_comercial g on g.id=i.guia_comercial_id and g.status='publicado'
    where r.edicao_id=v_edicao and r.vencedor and not r.publicado;
  get diagnostics v_total=row_count;
  if v_total<>21 then raise exception 'Vencedores do app incompletos.'; end if;
  update public.app_melhores_campanhas set status='agendada',ativo=true where id=v_campanha;
end $$;
-- A vitrine é uma cópia da apuração e não deve ser alterada enquanto estiver preparada.
create or replace function premios_privado.proteger_vitrine_revelacao() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,premios_privado as $$
declare v_campanha uuid;
begin
  if tg_table_name='app_melhores_campanhas' then v_campanha:=case when tg_op='DELETE' then old.id else new.id end;
  else v_campanha:=case when tg_op='DELETE' then old.campanha_id else new.campanha_id end; end if;
  if exists(select 1 from premios_privado.revelacao_campanhas m join premios_privado.agendamentos a on a.edicao_id=m.edicao_id where m.campanha_id=v_campanha and a.publicado_em is null) then
    raise exception 'Vitrine bloqueada durante a divulgação agendada.' using errcode='23514';
  end if;
  if tg_op='UPDATE' and tg_table_name='app_melhores_vencedores' then
    if old.campanha_id is distinct from new.campanha_id and exists(select 1 from premios_privado.revelacao_campanhas m join premios_privado.agendamentos a on a.edicao_id=m.edicao_id where m.campanha_id=old.campanha_id and a.publicado_em is null) then raise exception 'Não é possível mover dados da vitrine agendada.' using errcode='23514'; end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function premios_privado.proteger_vitrine_revelacao() from public,anon,authenticated;
create trigger zz_revelacao_proteger before update or delete on public.app_melhores_campanhas for each row execute function premios_privado.proteger_vitrine_revelacao();
create trigger zz_revelacao_proteger before insert or update or delete on public.app_melhores_vencedores for each row execute function premios_privado.proteger_vitrine_revelacao();

-- Após o primeiro anúncio, não é permitido apagar a apuração já divulgada.
create or replace function public.melhores_cancelar_agendamento(p_edicao uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,premios_privado as $$
declare v_campanha uuid;
begin
  if (select auth.uid()) is null or not coalesce(public.tem_permissao_admin('melhores','editar'),false) then raise exception 'Sem permissão.' using errcode='42501'; end if;
  perform 1 from premios_privado.agendamentos where edicao_id=p_edicao and publicado_em is null for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  perform 1 from public.melhores_edicoes where id=p_edicao for update;
  if exists(select 1 from premios_privado.revelacoes where edicao_id=p_edicao and publicar_em<=now()) then raise exception 'A divulgação já começou; não é possível cancelar a apuração publicada.'; end if;
  if not exists(select 1 from premios_privado.agendamentos where edicao_id=p_edicao and publicado_em is null and now()<divulgar_em) then raise exception 'Agendamento não encontrado ou já vencido.'; end if;
  select campanha_id into v_campanha from premios_privado.revelacao_campanhas where edicao_id=p_edicao;
  delete from premios_privado.revelacao_campanhas where edicao_id=p_edicao;
  if v_campanha is not null then delete from public.app_melhores_campanhas where id=v_campanha; end if;
  delete from premios_privado.revelacoes where edicao_id=p_edicao;
  delete from premios_privado.agendamentos where edicao_id=p_edicao;
  if v_campanha is not null then update public.melhores_edicoes set divulgacao_em=null where id=p_edicao; end if;
  delete from public.melhores_resultados where edicao_id=p_edicao and not publicado;
end $$;
revoke all on function public.melhores_cancelar_agendamento(uuid) from public,anon,authenticated;
grant execute on function public.melhores_cancelar_agendamento(uuid) to authenticated;
commit;
