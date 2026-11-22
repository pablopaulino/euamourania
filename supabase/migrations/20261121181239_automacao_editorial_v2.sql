begin;
alter table public.editorial_fontes
  add column confiabilidade text not null default 'portal' check (confiabilidade in ('oficial','portal')),
  add column escopo text not null default 'local' check (escopo in ('local','regional_nacional'));

-- Preserva os comunicados oficiais municipais reconhecidos na versão anterior.
update public.editorial_fontes set confiabilidade='oficial'
where lower(url) ~ '^https://(www\.)?urania\.sp\.(gov|leg)\.br([/?#:]|$)';

alter table public.editorial_pautas
  add column escopo text not null default 'local' check (escopo in ('local','regional_nacional')),
  add column titulo text,
  add column legenda_imagem text,
  add column prompt_imagem text,
  add column estado_triagem text not null default 'selecionada' check (estado_triagem in ('selecionada','descartada')),
  add column fato_original text,
  add column tentativa_pendente boolean not null default false;
create unique index editorial_rascunho_fato_v2 on public.editorial_pautas(fato_original)
  where estado_triagem='selecionada' and fato_original is not null;
create index editorial_pautas_historico on public.editorial_pautas(criado_em desc);
alter table public.editorial_execucoes drop constraint editorial_execucoes_estado_check;
alter table public.editorial_execucoes add check (estado in ('iniciada','concluida','sem_pautas','falhou','parcial'));

-- Cada candidata já existe no histórico. A vinculação ao CMS só acontece
-- junto com o INSERT da notícia e nunca atualiza uma notícia existente.
create function public.editorial_criar_rascunho_v2(p_execucao uuid, p_chave_fato text, p_dados jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  pauta public.editorial_pautas%rowtype;
  nova uuid;
  categoria uuid;
begin
  perform 1 from public.editorial_execucoes where id=p_execucao and estado='iniciada' for update;
  if not found then raise exception 'Execução encerrada'; end if;
  select * into strict pauta from public.editorial_pautas
    where execucao_id=p_execucao and chave_fato=p_chave_fato for update;
  if pauta.estado_triagem='selecionada' then raise exception 'Pauta já selecionada'; end if;
  if exists(select 1 from public.editorial_pautas where execucao_id=p_execucao
            and escopo=pauta.escopo and estado_triagem='selecionada') then
    raise exception 'Escopo já preenchido';
  end if;
  select id into categoria from public.categorias where tipo='noticias'
    and status='ativo' and nome=p_dados->>'categoria' order by ordem,id limit 1;
  insert into public.noticias(titulo,slug,subtitulo,resumo,conteudo_html,categoria_id,categoria_nome,
    seo_titulo,seo_descricao,legenda_imagem,autor,status,status_editorial,destaque,publicado_em,imagem_url)
  values(p_dados->>'titulo',p_dados->>'slug',p_dados->>'subtitulo',p_dados->>'resumo',
    p_dados->>'conteudo_html',categoria,p_dados->>'categoria',p_dados->>'titulo_seo',
    p_dados->>'descricao_seo',p_dados->>'legenda_imagem','Eu Amo Urânia','rascunho','rascunho',false,null,null)
  returning id into nova;
  update public.editorial_pautas set noticia_id=nova,estado_triagem='selecionada',tentativa_pendente=false,
    relevancia='Selecionada para revisão editorial.',legenda_imagem=p_dados->>'legenda_imagem',
    prompt_imagem=p_dados->>'prompt_imagem',uso_ia=true,
    revisao_reforcada=(p_dados->>'revisao_reforcada')::boolean,
    pendencias=p_dados->'pendencias'
  where id=pauta.id;
  return nova;
end $$;
revoke all on function public.editorial_criar_rascunho_v2(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.editorial_criar_rascunho_v2(uuid,text,jsonb) to service_role;
grant select on public.editorial_fontes,public.categorias to service_role;
grant select,insert,update on public.editorial_pautas to service_role;
grant select,update on public.editorial_configuracao,public.editorial_execucoes to service_role;
grant select,insert on public.noticias to service_role;
grant select on public.editorial_configuracao,public.editorial_pautas,public.editorial_fontes,public.editorial_execucoes to authenticated;
grant insert,update on public.editorial_fontes to authenticated;
commit;
