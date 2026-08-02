alter table public.guia_comercial
add column if not exists recomendado_editorial boolean not null default false;

comment on column public.guia_comercial.recomendado_editorial
is 'Indica recomendação editorial da equipe Eu Amo Urânia para exibir selo no detalhe da empresa no aplicativo.';
