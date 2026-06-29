-- Eu Amo Urânia — usuários administrativos e RBAC
-- Execute no SQL Editor do Supabase antes de publicar o frontend desta branch.
begin;

alter table public.usuarios_admin add column if not exists funcao text not null default 'administrador';
alter table public.usuarios_admin add column if not exists permissoes_extra jsonb not null default '{}'::jsonb;
alter table public.usuarios_admin add column if not exists ultimo_login timestamptz;
alter table public.usuarios_admin add column if not exists atualizado_em timestamptz not null default now();
alter table public.usuarios_admin drop constraint if exists usuarios_admin_funcao_check;
alter table public.usuarios_admin add constraint usuarios_admin_funcao_check check(funcao in('super_admin','administrador','editor','redator','comercial','comunicacao','visualizador'));

-- A conta administrativa já usada pelo projeto permanece ativa e vira Super Admin.
update public.usuarios_admin set funcao='super_admin',ativo=true
where lower(email)=lower('euamourania@gmail.com');

create table if not exists public.admin_permissoes_funcao(
 funcao text not null,
 modulo text not null,
 acao text not null,
 primary key(funcao,modulo,acao),
 constraint admin_permissoes_funcao_check check(funcao in('super_admin','administrador','editor','redator','comercial','comunicacao','visualizador'))
);
alter table public.admin_permissoes_funcao enable row level security;
delete from public.admin_permissoes_funcao;
insert into public.admin_permissoes_funcao(funcao,modulo,acao) values
 ('super_admin','*','*'),
 ('administrador','dashboard','acessar'),('administrador','insights','acessar'),('administrador','insights','ler'),
 ('administrador','noticias','acessar'),('administrador','noticias','ler'),('administrador','noticias','criar'),('administrador','noticias','editar'),('administrador','noticias','excluir'),('administrador','noticias','publicar'),
 ('administrador','categorias','acessar'),('administrador','categorias','ler'),('administrador','categorias','criar'),('administrador','categorias','editar'),('administrador','categorias','excluir'),
 ('administrador','guia_comercial','acessar'),('administrador','guia_comercial','ler'),('administrador','guia_comercial','criar'),('administrador','guia_comercial','editar'),('administrador','guia_comercial','excluir'),
 ('administrador','turismo','acessar'),('administrador','turismo','ler'),('administrador','turismo','criar'),('administrador','turismo','editar'),('administrador','turismo','excluir'),
 ('administrador','eventos','acessar'),('administrador','eventos','ler'),('administrador','eventos','criar'),('administrador','eventos','editar'),('administrador','eventos','excluir'),
 ('administrador','publicidade','acessar'),('administrador','publicidade','ler'),('administrador','publicidade','criar'),('administrador','publicidade','editar'),('administrador','publicidade','excluir'),
 ('administrador','comunicacao','acessar'),('administrador','comunicacao','ler'),('administrador','comunicacao','criar'),('administrador','comunicacao','editar'),('administrador','comunicacao','excluir'),('administrador','comunicacao','enviar'),
 ('administrador','links','acessar'),('administrador','links','ler'),('administrador','links','criar'),('administrador','links','editar'),('administrador','links','excluir'),
 ('editor','dashboard','acessar'),('editor','noticias','acessar'),('editor','noticias','ler'),('editor','noticias','criar'),('editor','noticias','editar'),('editor','noticias','publicar'),
 ('editor','categorias','acessar'),('editor','categorias','ler'),('editor','categorias','criar'),('editor','categorias','editar'),
 ('redator','dashboard','acessar'),('redator','noticias','acessar'),('redator','noticias','ler'),('redator','noticias','criar'),('redator','noticias','editar'),
 ('comercial','dashboard','acessar'),('comercial','guia_comercial','acessar'),('comercial','guia_comercial','ler'),('comercial','guia_comercial','criar'),('comercial','guia_comercial','editar'),
 ('comercial','publicidade','acessar'),('comercial','publicidade','ler'),('comercial','publicidade','criar'),('comercial','publicidade','editar'),
 ('comunicacao','dashboard','acessar'),('comunicacao','comunicacao','acessar'),('comunicacao','comunicacao','ler'),('comunicacao','comunicacao','criar'),('comunicacao','comunicacao','editar'),('comunicacao','comunicacao','excluir'),('comunicacao','comunicacao','enviar'),
 ('comunicacao','links','acessar'),('comunicacao','links','ler'),('comunicacao','links','criar'),('comunicacao','links','editar'),('comunicacao','links','excluir'),
 ('visualizador','dashboard','acessar'),('visualizador','insights','acessar'),('visualizador','insights','ler'),
 ('visualizador','noticias','ler'),('visualizador','categorias','ler'),('visualizador','guia_comercial','ler'),('visualizador','turismo','ler'),('visualizador','eventos','ler'),('visualizador','publicidade','ler'),('visualizador','comunicacao','ler'),('visualizador','links','ler');

create or replace function public.funcao_admin_atual()
returns text language sql stable security definer set search_path=public as $$
 select funcao from public.usuarios_admin where id=(select auth.uid()) and ativo=true limit 1;
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.usuarios_admin where id=(select auth.uid()) and ativo=true);
$$;
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.funcao_admin_atual()='super_admin',false);
$$;
create or replace function public.tem_permissao_admin(p_modulo text,p_acao text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(
   select 1 from public.usuarios_admin u
   where u.id=(select auth.uid()) and u.ativo=true and(
     exists(select 1 from public.admin_permissoes_funcao p where p.funcao=u.funcao and(p.modulo=p_modulo or p.modulo='*')and(p.acao=p_acao or p.acao='*'))
     or coalesce((u.permissoes_extra->p_modulo)?p_acao,false)
   )
 );
$$;
create or replace function public.registrar_login_admin()
returns void language sql security definer set search_path=public as $$
 update public.usuarios_admin set ultimo_login=now(),atualizado_em=now() where id=(select auth.uid()) and ativo=true;
$$;
revoke all on function public.funcao_admin_atual() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.tem_permissao_admin(text,text) from public;
revoke all on function public.registrar_login_admin() from public;
grant execute on function public.funcao_admin_atual(),public.is_admin(),public.is_super_admin(),public.tem_permissao_admin(text,text),public.registrar_login_admin() to authenticated;

alter table public.noticias add column if not exists criado_por uuid references auth.users(id) on delete set null default auth.uid();
update public.noticias n set criado_por=(select id from public.usuarios_admin where funcao='super_admin' and ativo=true order by criado_em limit 1) where criado_por is null;
create index if not exists noticias_criado_por_idx on public.noticias(criado_por);

-- Perfis e matriz: usuário lê o próprio perfil; somente Super Admin lê todos.
drop policy if exists "admin_visualiza_perfil" on public.usuarios_admin;
drop policy if exists "admin_gerencia_administradores" on public.usuarios_admin;
create policy "rbac_usuarios_select" on public.usuarios_admin for select to authenticated using(id=(select auth.uid()) or public.is_super_admin());
create policy "rbac_usuarios_write" on public.usuarios_admin for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists "rbac_permissoes_select" on public.admin_permissoes_funcao;
create policy "rbac_permissoes_select" on public.admin_permissoes_funcao for select to authenticated using(public.is_admin());

-- Notícias: Redator só altera as próprias e nunca publica; Editor publica, mas não exclui.
drop policy if exists "noticias_publicadas_publicas" on public.noticias;
drop policy if exists "admin_gerencia_noticias" on public.noticias;
create policy "rbac_noticias_select" on public.noticias for select to anon,authenticated using((status='publicado' and publicado_em is not null and publicado_em<=now())or public.tem_permissao_admin('noticias','ler'));
create policy "rbac_noticias_insert" on public.noticias for insert to authenticated with check(public.tem_permissao_admin('noticias','criar')and(public.funcao_admin_atual()<>'redator'or(criado_por=(select auth.uid())and status='rascunho'))and(status<>'publicado'or public.tem_permissao_admin('noticias','publicar')));
create policy "rbac_noticias_update" on public.noticias for update to authenticated using(public.tem_permissao_admin('noticias','editar')and(public.funcao_admin_atual()<>'redator'or criado_por=(select auth.uid()))) with check(public.tem_permissao_admin('noticias','editar')and(public.funcao_admin_atual()<>'redator'or(criado_por=(select auth.uid())and status='rascunho'))and(status<>'publicado'or public.tem_permissao_admin('noticias','publicar')));
create policy "rbac_noticias_delete" on public.noticias for delete to authenticated using(public.tem_permissao_admin('noticias','excluir'));

-- Conteúdo geral.
drop policy if exists "guia_publicado_publico" on public.guia_comercial; drop policy if exists "admin_gerencia_guia" on public.guia_comercial;
create policy "rbac_guia_select" on public.guia_comercial for select to anon,authenticated using(status='publicado'or public.tem_permissao_admin('guia_comercial','ler'));
create policy "rbac_guia_insert" on public.guia_comercial for insert to authenticated with check(public.tem_permissao_admin('guia_comercial','criar'));
create policy "rbac_guia_update" on public.guia_comercial for update to authenticated using(public.tem_permissao_admin('guia_comercial','editar'))with check(public.tem_permissao_admin('guia_comercial','editar'));
create policy "rbac_guia_delete" on public.guia_comercial for delete to authenticated using(public.tem_permissao_admin('guia_comercial','excluir'));

drop policy if exists "turismo_publicado_publico" on public.turismo; drop policy if exists "admin_gerencia_turismo" on public.turismo;
create policy "rbac_turismo_select" on public.turismo for select to anon,authenticated using(status='publicado'or public.tem_permissao_admin('turismo','ler'));
create policy "rbac_turismo_insert" on public.turismo for insert to authenticated with check(public.tem_permissao_admin('turismo','criar'));
create policy "rbac_turismo_update" on public.turismo for update to authenticated using(public.tem_permissao_admin('turismo','editar'))with check(public.tem_permissao_admin('turismo','editar'));
create policy "rbac_turismo_delete" on public.turismo for delete to authenticated using(public.tem_permissao_admin('turismo','excluir'));

drop policy if exists "eventos_publicados_publicos" on public.eventos; drop policy if exists "admin_gerencia_eventos" on public.eventos;
create policy "rbac_eventos_select" on public.eventos for select to anon,authenticated using(status='publicado'or public.tem_permissao_admin('eventos','ler'));
create policy "rbac_eventos_insert" on public.eventos for insert to authenticated with check(public.tem_permissao_admin('eventos','criar'));
create policy "rbac_eventos_update" on public.eventos for update to authenticated using(public.tem_permissao_admin('eventos','editar'))with check(public.tem_permissao_admin('eventos','editar'));
create policy "rbac_eventos_delete" on public.eventos for delete to authenticated using(public.tem_permissao_admin('eventos','excluir'));

-- Categorias: Editor gerencia apenas categorias de notícias.
drop policy if exists "categorias_ativas_publicas" on public.categorias; drop policy if exists "admin_gerencia_categorias" on public.categorias;
create policy "rbac_categorias_select" on public.categorias for select to anon,authenticated using(status='ativo'or public.tem_permissao_admin('categorias','ler'));
create policy "rbac_categorias_insert" on public.categorias for insert to authenticated with check(public.tem_permissao_admin('categorias','criar')and(public.funcao_admin_atual()<>'editor'or tipo='noticias'));
create policy "rbac_categorias_update" on public.categorias for update to authenticated using(public.tem_permissao_admin('categorias','editar')and(public.funcao_admin_atual()<>'editor'or tipo='noticias'))with check(public.tem_permissao_admin('categorias','editar')and(public.funcao_admin_atual()<>'editor'or tipo='noticias'));
create policy "rbac_categorias_delete" on public.categorias for delete to authenticated using(public.tem_permissao_admin('categorias','excluir'));

-- Links e configurações.
drop policy if exists "links_ativos_publicos" on public.links; drop policy if exists "admin_gerencia_links" on public.links;
create policy "rbac_links_select" on public.links for select to anon,authenticated using(status='ativo'or public.tem_permissao_admin('links','ler'));
create policy "rbac_links_insert" on public.links for insert to authenticated with check(public.tem_permissao_admin('links','criar'));
create policy "rbac_links_update" on public.links for update to authenticated using(public.tem_permissao_admin('links','editar'))with check(public.tem_permissao_admin('links','editar'));
create policy "rbac_links_delete" on public.links for delete to authenticated using(public.tem_permissao_admin('links','excluir'));
drop policy if exists "admin_gerencia_configuracoes" on public.configuracoes_site;
create policy "rbac_configuracoes_write" on public.configuracoes_site for all to authenticated using(public.tem_permissao_admin('configuracoes','editar'))with check(public.tem_permissao_admin('configuracoes','editar'));

-- Publicidade.
drop policy if exists "admin_gerencia_campanhas" on public.campanhas_publicitarias;
create policy "rbac_campanhas_manage" on public.campanhas_publicitarias for all to authenticated using(public.tem_permissao_admin('publicidade','ler'))with check((case when id is null then public.tem_permissao_admin('publicidade','criar')else public.tem_permissao_admin('publicidade','editar')end));
drop policy if exists "admin_gerencia_posicoes" on public.campanha_posicoes;
create policy "rbac_posicoes_manage" on public.campanha_posicoes for all to authenticated using(public.tem_permissao_admin('publicidade','ler'))with check(public.tem_permissao_admin('publicidade','editar'));
drop policy if exists "admin_gerencia_anunciantes" on public.anunciantes;
create policy "rbac_anunciantes_manage" on public.anunciantes for all to authenticated using(public.tem_permissao_admin('publicidade','ler'))with check(public.tem_permissao_admin('publicidade','editar'));
drop policy if exists "admin_consulta_metricas" on public.publicidade_metricas_diarias;
create policy "rbac_metricas_ads_select" on public.publicidade_metricas_diarias for select to authenticated using(public.tem_permissao_admin('publicidade','ler')or public.tem_permissao_admin('insights','ler'));

-- Comunicação. Comunicação visualiza assinantes; somente Admin/Super os altera.
drop policy if exists "admin_gerencia_assinantes" on public.newsletter_assinantes;
create policy "rbac_assinantes_select" on public.newsletter_assinantes for select to authenticated using(public.tem_permissao_admin('comunicacao','ler'));
create policy "rbac_assinantes_write" on public.newsletter_assinantes for all to authenticated using(public.funcao_admin_atual() in('super_admin','administrador'))with check(public.funcao_admin_atual() in('super_admin','administrador'));
drop policy if exists "admin_gerencia_newsletters" on public.newsletters;
create policy "rbac_newsletters_select" on public.newsletters for select to authenticated using(public.tem_permissao_admin('comunicacao','ler'));
create policy "rbac_newsletters_insert" on public.newsletters for insert to authenticated with check(public.tem_permissao_admin('comunicacao','criar'));
create policy "rbac_newsletters_update" on public.newsletters for update to authenticated using(public.tem_permissao_admin('comunicacao','editar')or public.tem_permissao_admin('comunicacao','enviar'))with check(public.tem_permissao_admin('comunicacao','editar')or public.tem_permissao_admin('comunicacao','enviar'));
create policy "rbac_newsletters_delete" on public.newsletters for delete to authenticated using(public.tem_permissao_admin('comunicacao','excluir'));
drop policy if exists "admin_consulta_envios" on public.newsletter_envios;
create policy "rbac_envios_select" on public.newsletter_envios for select to authenticated using(public.tem_permissao_admin('comunicacao','ler'));
create policy "rbac_envios_write" on public.newsletter_envios for all to authenticated using(public.tem_permissao_admin('comunicacao','enviar'))with check(public.tem_permissao_admin('comunicacao','enviar'));

-- Relatórios e auditoria.
drop policy if exists "admin_consulta_analytics" on public.analytics_eventos;
create policy "rbac_analytics_select" on public.analytics_eventos for select to authenticated using(public.tem_permissao_admin('insights','ler'));
drop policy if exists "admin_consulta_atividades" on public.cms_atividades;
create policy "rbac_atividades_select" on public.cms_atividades for select to authenticated using(public.tem_permissao_admin('insights','ler'));

-- Legado e Storage.
drop policy if exists "admin_gerencia_banners" on public.banners;
create policy "rbac_banners_manage" on public.banners for all to authenticated using(public.tem_permissao_admin('publicidade','ler'))with check(public.tem_permissao_admin('publicidade','editar'));
drop policy if exists "admin_insere_publicidade" on storage.objects;
create policy "rbac_insere_publicidade" on storage.objects for insert to authenticated with check(bucket_id='publicidade' and public.tem_permissao_admin('publicidade','criar'));
drop policy if exists "admin_atualiza_publicidade" on storage.objects;
create policy "rbac_atualiza_publicidade" on storage.objects for update to authenticated using(bucket_id='publicidade' and public.tem_permissao_admin('publicidade','editar'))with check(bucket_id='publicidade' and public.tem_permissao_admin('publicidade','editar'));
drop policy if exists "admin_exclui_publicidade" on storage.objects;
create policy "rbac_exclui_publicidade" on storage.objects for delete to authenticated using(bucket_id='publicidade' and public.tem_permissao_admin('publicidade','excluir'));

commit;
