-- =====================================================================
-- disparo.sql | Prospecção por e-mail (aba PROSPECÇÃO do seu painel)
--
-- ONDE COLAR: no Supabase, menu da esquerda "SQL Editor", botão "New query".
-- Cole TUDO que está neste arquivo e clique em "Run".
-- Pode rodar quantas vezes quiser: nada é apagado e nada é duplicado.
--
-- O que este arquivo faz:
--   1. Acrescenta duas colunas na tabela "marcas" (a sua base de contatos):
--        selecionada       = a marca está marcada para o próximo disparo
--        email_enviado_em  = quando a marca recebeu o seu último e-mail
--   2. Cria a tabela "email_envios": uma linha para cada e-mail enviado
--      (ou que deu erro), para você saber quem recebeu e quem não recebeu.
--   3. Cria a tabela "email_optout": quem pediu para não receber mais.
--   4. Liga a tranca (RLS) nas duas: só você, logada, lê e escreve.
--      Quem está deslogado não enxerga nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOCO 1: colunas novas na tabela "marcas" (sem apagar nada)
-- ---------------------------------------------------------------------
alter table public.marcas add column if not exists selecionada boolean not null default false;
alter table public.marcas add column if not exists email_enviado_em timestamptz;


-- ---------------------------------------------------------------------
-- BLOCO 2: registro de envios (uma linha por destinatário)
-- ---------------------------------------------------------------------
create table if not exists public.email_envios (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,                       -- para quem foi
  assunto    text not null,                       -- assunto já com o nome da marca
  status     text not null check (status in ('ok', 'erro')),
  erro       text,                                -- o que deu errado, quando deu
  resend_id  text,                                -- número que o Resend devolve (ou "rascunho")
  marca_id   uuid,                                -- qual marca era (se souber)
  criado_em  timestamptz not null default now()   -- quando
);

create index if not exists email_envios_email_idx  on public.email_envios (email);
create index if not exists email_envios_criado_idx on public.email_envios (criado_em desc);


-- ---------------------------------------------------------------------
-- BLOCO 3: descadastro (quem respondeu SAIR nunca mais recebe)
-- ---------------------------------------------------------------------
create table if not exists public.email_optout (
  email      text primary key check (email = lower(email)),
  motivo     text,
  criado_em  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- BLOCO 4: a tranca (RLS). Só você, logada, com o seu e-mail.
-- Usa a mesma função "eh_amanda()" que já protege o resto do painel.
-- ---------------------------------------------------------------------
alter table public.email_envios enable row level security;
alter table public.email_optout enable row level security;

drop policy if exists "so_amanda" on public.email_envios;
create policy "so_amanda" on public.email_envios
  for all to authenticated
  using (public.eh_amanda()) with check (public.eh_amanda());

drop policy if exists "so_amanda" on public.email_optout;
create policy "so_amanda" on public.email_optout
  for all to authenticated
  using (public.eh_amanda()) with check (public.eh_amanda());

-- Quem está deslogado não tem acesso nenhum a estas duas tabelas.
revoke all on public.email_envios, public.email_optout from anon;
grant select, insert, update, delete on public.email_envios, public.email_optout to authenticated;
