-- Base desativada para uma futura rotina editorial. Não instala agendamento.
begin;

create table if not exists public.editorial_fontes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 200),
  url text not null unique check (url ~ '^https://[^[:space:]]+$'),
  tipo text not null check (tipo in ('site','pagina','rss')),
  ativa boolean not null default false,
  prioridade integer not null default 50 check (prioridade between 0 and 100),
  criado_em timestamptz not null default now()
);

create table if not exists public.editorial_execucoes (
  id uuid primary key default gen_random_uuid(),
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  estado text not null default 'iniciada' check (estado in ('iniciada','concluida','sem_pautas','falhou')),
  resumo text,
  check ((estado = 'iniciada' and finalizada_em is null) or (estado <> 'iniciada' and finalizada_em is not null))
);
-- Uma execução simultânea por vez; recuperação de execução abandonada deve ser
-- feita explicitamente pelo futuro trabalhador, com expiração e registro de falha.
create unique index if not exists editorial_execucao_unica
  on public.editorial_execucoes ((true)) where estado = 'iniciada';

create table if not exists public.editorial_pautas (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.editorial_execucoes(id),
  noticia_id uuid unique references public.noticias(id) on delete set null,
  chave_fato text not null unique check (length(chave_fato) between 16 and 256),
  fontes jsonb not null check (jsonb_typeof(fontes) = 'array' and jsonb_array_length(fontes) > 0),
  relevancia text not null check (length(trim(relevancia)) > 0),
  pendencias jsonb not null default '[]'::jsonb check (jsonb_typeof(pendencias) = 'array'),
  revisao_reforcada boolean not null default false,
  uso_ia boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.editorial_fontes enable row level security;
alter table public.editorial_execucoes enable row level security;
alter table public.editorial_pautas enable row level security;

-- Metadados nunca ficam na tabela de notícias exposta ao público.
create policy editorial_fontes_leitura on public.editorial_fontes for select to authenticated
  using (public.tem_permissao_admin('noticias','ler'));
create policy editorial_fontes_gerenciar on public.editorial_fontes for all to authenticated
  using (public.tem_permissao_admin('noticias','editar'))
  with check (public.tem_permissao_admin('noticias','editar'));
create policy editorial_execucoes_leitura on public.editorial_execucoes for select to authenticated
  using (public.tem_permissao_admin('noticias','ler'));
create policy editorial_pautas_leitura on public.editorial_pautas for select to authenticated
  using (public.tem_permissao_admin('noticias','ler'));

-- A inserção é transacional e só cria rascunhos. Não há caminho de atualização
-- de uma notícia já criada, mesmo quando uma chave é reprocessada.
create or replace function public.editorial_criar_rascunho(
  p_execucao uuid, p_chave_fato text, p_titulo text, p_slug text,
  p_resumo text, p_conteudo_html text, p_seo_titulo text, p_seo_descricao text,
  p_fontes jsonb, p_relevancia text, p_pendencias jsonb, p_revisao_reforcada boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.editorial_execucoes where id = p_execucao and estado = 'iniciada') then
    raise exception 'Execução editorial não está ativa';
  end if;
  if length(trim(coalesce(p_titulo,''))) = 0 or length(trim(coalesce(p_conteudo_html,''))) = 0 then
    raise exception 'Título e conteúdo são obrigatórios';
  end if;
  if coalesce(jsonb_typeof(p_fontes),'') <> 'array' or jsonb_array_length(p_fontes) = 0 then
    raise exception 'Fontes consultadas são obrigatórias';
  end if;
  insert into public.noticias (titulo, slug, resumo, conteudo_html, seo_titulo, seo_descricao,
    autor, status, status_editorial, destaque, publicado_em, imagem_url, criado_por)
  values (p_titulo, p_slug, p_resumo, p_conteudo_html, p_seo_titulo, p_seo_descricao,
    'Eu Amo Urânia', 'rascunho', 'rascunho', false, null, null, null)
  returning id into v_id;
  insert into public.editorial_pautas (execucao_id, noticia_id, chave_fato, fontes, relevancia, pendencias, revisao_reforcada)
  values (p_execucao, v_id, p_chave_fato, p_fontes, p_relevancia, coalesce(p_pendencias,'[]'::jsonb), coalesce(p_revisao_reforcada,false));
  return v_id;
end;
$$;
revoke all on function public.editorial_criar_rascunho(uuid,text,text,text,text,text,text,text,jsonb,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.editorial_criar_rascunho(uuid,text,text,text,text,text,text,text,jsonb,text,jsonb,boolean) to service_role;

commit;
