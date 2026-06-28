-- Garante que apenas notícias com data de publicação atingida sejam públicas.
-- Notícias antigas publicadas sem data recebem a data original de criação.

update public.noticias
set publicado_em = criado_em
where status = 'publicado'
  and publicado_em is null;

-- Repara somente o valor exato sobrescrito pela regressão no editor.
-- A condição protege uma eventual alteração manual posterior.
update public.noticias
set publicado_em = '2024-12-03 12:00:00-03'::timestamptz
where slug = 'borboletario-de-urania-comemora-2-anos'
  and publicado_em = '2026-06-28 14:16:56.516+00'::timestamptz;

drop policy if exists "noticias_publicadas_publicas" on public.noticias;

create policy "noticias_publicadas_publicas"
on public.noticias
for select
to anon, authenticated
using (
  (
    status = 'publicado'
    and publicado_em is not null
    and publicado_em <= now()
  )
  or public.is_admin()
);

create index if not exists noticias_publicacao_idx
on public.noticias(status, publicado_em desc);
