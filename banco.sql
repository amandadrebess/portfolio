-- =====================================================================
-- banco.sql | Banco de dados do painel da Amanda Drebes
--
-- ONDE COLAR:
--   1. Abra https://supabase.com/dashboard e entre no seu projeto.
--   2. No menu da esquerda, clique em "SQL Editor".
--   3. Clique em "New query" (nova consulta).
--   4. Apague o que estiver escrito, cole TUDO deste arquivo e clique em "Run".
--   5. Deve aparecer "Success. No rows returned". Isso é bom.
--
-- Pode rodar de novo quantas vezes quiser: nada é duplicado nem apagado.
-- Este arquivo NUNCA guarda senha nem chave secreta.
-- =====================================================================


-- =====================================================================
-- BLOCO 1: "QUEM SOU EU"
-- Uma pequena função que responde: "quem está usando o banco agora é a
-- Amanda?". Ela compara o e-mail de quem está logado com o seu.
-- Todas as trancas abaixo usam essa função. Se um dia você mudar de
-- e-mail de login, troque o e-mail aqui e rode o arquivo de novo.
-- =====================================================================
create or replace function public.eh_amanda()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'amandadrebes9@gmail.com';
$$;


-- =====================================================================
-- BLOCO 2: AS TABELAS (as "planilhas" onde ficam os seus dados)
-- A coluna "exemplo" marca as linhas de demonstração que eu deixo para
-- você entender o formato. Pode apagar essas linhas quando quiser.
-- =====================================================================

-- 2.1 VÍDEOS: o que aparece no seu portfólio.
create table if not exists public.videos (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  link       text not null,
  nicho      text,
  formato    text,
  marca      text,
  destaque   text,                          -- ex: "2,4M views"
  ordem      integer not null default 0,    -- posição na galeria (1 aparece primeiro)
  visivel    boolean not null default true, -- false = escondido do site
  exemplo    boolean not null default false,
  criado_em  timestamptz not null default now()
);

-- 2.2 MARCAS: sua base de contatos de empresas.
create table if not exists public.marcas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  instagram      text,
  email          text,
  telefone       text,
  situacao       text not null default 'lead'
                 check (situacao in ('lead', 'conversando', 'cliente', 'parada')),
  obs            text,
  ultimo_contato date,
  exemplo        boolean not null default false,
  criado_em      timestamptz not null default now()
);

-- 2.3 CALENDÁRIO: o que você precisa gravar, editar e postar.
create table if not exists public.calendario (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  marca      text,
  tipo       text not null default 'gravar'
             check (tipo in ('gravar', 'editar', 'postar')),
  data       date not null,
  status     text not null default 'a fazer'
             check (status in ('a fazer', 'feito')),
  exemplo    boolean not null default false,
  criado_em  timestamptz not null default now()
);

-- 2.4 CAMPANHAS: seus trabalhos com marcas, valores e prazos.
create table if not exists public.campanhas (
  id         uuid primary key default gen_random_uuid(),
  campanha   text not null,
  cliente    text,
  tipo       text not null default 'Conteúdo'
             check (tipo in ('Conteúdo', 'Publicidade')),
  status     text not null default 'Briefing'
             check (status in ('Briefing', 'Roteiro', 'Aprovação Roteiro',
                               'Gravação', 'Edição', 'Aprovado', 'Entregue')),
  qtd        integer not null default 1 check (qtd >= 0),
  valor      numeric(12, 2) not null default 0 check (valor >= 0),
  prazo      date,
  pagamento  text not null default 'pendente'
             check (pagamento in ('pendente', 'pago')),
  ativa      boolean not null default true,
  favorita   boolean not null default false,
  exemplo    boolean not null default false,
  criado_em  timestamptz not null default now()
);

-- 2.5 MARCADOS: o que você já marcou no checklist. Cada item marcado
-- é guardado por uma chave de texto (ex: "capa:0").
create table if not exists public.marcados (
  chave          text primary key,
  marcado        boolean not null default true,
  atualizado_em  timestamptz not null default now()
);

-- 2.6 VISITAS: uma linha por visita ao seu portfólio (para as métricas).
create table if not exists public.visitas (
  id      bigint generated always as identity primary key,
  data    timestamptz not null default now(),
  pagina  text not null,
  origem  text                               -- ex: "Instagram", "Google", "Direto"
);

-- Índices: deixam as listas por data rápidas.
create index if not exists visitas_data_idx    on public.visitas (data);
create index if not exists calendario_data_idx on public.calendario (data);


-- =====================================================================
-- BLOCO 3: A TRANCA (RLS = Row Level Security)
--
-- RLS é a tranca de cada tabela. Ligada, ninguém lê nem escreve nada,
-- a não ser que exista uma regra ("policy") liberando.
--
-- As regras deste arquivo:
--   * SÓ VOCÊ (logada, com o seu e-mail) lê e escreve em todas as tabelas.
--   * Pessoa deslogada NÃO lê nada. Em nenhuma tabela.
--   * Só existem DUAS exceções, e apenas para GRAVAR (nunca para ler):
--       - qualquer pessoa pode INSERIR em "marcas" (formulário do site),
--         mas só como "lead" e nunca como exemplo;
--       - qualquer pessoa pode INSERIR em "visitas" (contador do site).
-- =====================================================================

alter table public.videos     enable row level security;
alter table public.marcas     enable row level security;
alter table public.calendario enable row level security;
alter table public.campanhas  enable row level security;
alter table public.marcados   enable row level security;
alter table public.visitas    enable row level security;

-- 3.1 REGRA "SÓ A AMANDA": vale para ler, criar, editar e apagar.
drop policy if exists "so_amanda" on public.videos;
create policy "so_amanda" on public.videos
  for all to authenticated
  using (public.eh_amanda()) with check (public.eh_amanda());

drop policy if exists "so_amanda" on public.marcas;
create policy "so_amanda" on public.marcas
  for all to authenticated
  using (public.eh_amanda()) with check (public.eh_amanda());

drop policy if exists "so_amanda" on public.calendario;
create policy "so_amanda" on public.calendario
  for all to authenticated
  using (public.eh_amanda()) with check (public.eh_amanda());

drop policy if exists "so_amanda" on public.campanhas;
create policy "so_amanda" on public.campanhas
  for all to authenticated
  using (public.eh_amanda()) with check (public.eh_amanda());

drop policy if exists "so_amanda" on public.marcados;
create policy "so_amanda" on public.marcados
  for all to authenticated
  using (public.eh_amanda()) with check (public.eh_amanda());

drop policy if exists "so_amanda" on public.visitas;
create policy "so_amanda" on public.visitas
  for all to authenticated
  using (public.eh_amanda()) with check (public.eh_amanda());

-- 3.2 EXCEÇÃO 1: o formulário do site pode ENVIAR um contato novo.
-- Só entra como "lead", com nome preenchido e textos de tamanho razoável.
drop policy if exists "site_envia_contato" on public.marcas;
create policy "site_envia_contato" on public.marcas
  for insert to anon, authenticated
  with check (
    situacao = 'lead'
    and exemplo = false
    and char_length(nome) between 1 and 120
    and (email     is null or char_length(email)     <= 200)
    and (instagram is null or char_length(instagram) <= 100)
    and (telefone  is null or char_length(telefone)  <= 40)
    and (obs       is null or char_length(obs)       <= 2000)
  );

-- 3.3 EXCEÇÃO 2: o site pode REGISTRAR uma visita nova.
drop policy if exists "site_registra_visita" on public.visitas;
create policy "site_registra_visita" on public.visitas
  for insert to anon, authenticated
  with check (
    char_length(pagina) between 1 and 200
    and (origem is null or char_length(origem) <= 100)
  );

-- 3.4 PERMISSÕES DE ACESSO ÀS TABELAS (a "porta" antes da tranca).
-- Primeiro tiro tudo de quem está deslogado; depois libero só o mínimo.
revoke all on public.videos, public.marcas, public.calendario,
              public.campanhas, public.marcados, public.visitas
  from anon;

grant select, insert, update, delete
  on public.videos, public.marcas, public.calendario,
     public.campanhas, public.marcados, public.visitas
  to authenticated;

-- Deslogado só pode INSERIR (nunca ler) nestas duas:
grant insert on public.marcas, public.visitas to anon;


-- =====================================================================
-- BLOCO 4: A "JANELINHA" DOS VÍDEOS PARA O SITE
--
-- O portfólio precisa mostrar os seus vídeos para qualquer visitante,
-- mas você pediu que deslogado não leia nenhuma tabela. Então o site NÃO
-- lê a tabela: ele chama esta função, que devolve SOMENTE os vídeos
-- marcados como visíveis e SOMENTE estas colunas: título, link, nicho,
-- formato, marca, destaque e ordem. Não mostra mais nada do banco.
-- =====================================================================
create or replace function public.videos_do_site()
returns table (
  titulo   text,
  link     text,
  nicho    text,
  formato  text,
  marca    text,
  destaque text,
  ordem    integer
)
language sql
stable
security definer
set search_path = public
as $$
  select v.titulo, v.link, v.nicho, v.formato, v.marca, v.destaque, v.ordem
  from public.videos v
  where v.visivel = true
  order by v.ordem, v.criado_em;
$$;

revoke all on function public.videos_do_site() from public;
grant execute on function public.videos_do_site() to anon, authenticated;


-- =====================================================================
-- BLOCO 5: UMA LINHA DE EXEMPLO EM CADA LISTA
-- Só para você entender o formato. Aparecem marcadas como "exemplo" no
-- painel e você pode apagar depois. O vídeo de exemplo nasce ESCONDIDO,
-- então não aparece no seu site. Se a lista já tiver dados, nada é
-- inserido. Visitas começam em zero.
-- =====================================================================
insert into public.videos (titulo, link, nicho, formato, marca, destaque, ordem, visivel, exemplo)
select 'Vídeo de exemplo (pode apagar)', 'https://youtube.com/shorts/EXEMPLO',
       'skincare', 'vídeo 9:16', 'Marca Exemplo', '0 views', 1, false, true
where not exists (select 1 from public.videos);

insert into public.marcas (nome, instagram, email, telefone, situacao, obs, ultimo_contato, exemplo)
select 'Marca Exemplo', '@marcaexemplo', 'contato@marcaexemplo.com', '(00) 00000-0000',
       'lead', 'Linha de exemplo. Pode apagar.', current_date, true
where not exists (select 1 from public.marcas);

insert into public.calendario (titulo, marca, tipo, data, status, exemplo)
select 'Gravar vídeo de exemplo', 'Marca Exemplo', 'gravar', current_date, 'a fazer', true
where not exists (select 1 from public.calendario);

insert into public.campanhas (campanha, cliente, tipo, status, qtd, valor, prazo, pagamento, ativa, favorita, exemplo)
select 'Campanha de exemplo', 'Marca Exemplo', 'Conteúdo', 'Briefing', 1, 0,
       current_date + 7, 'pendente', true, false, true
where not exists (select 1 from public.campanhas);

-- =====================================================================
-- BLOCO 6: CUPONS DAS MARCAS
-- Os cupons que você divulga: marca, nome do cupom, link, desconto,
-- validade e se está ativo. Trancado como as outras: só você lê e escreve.
-- =====================================================================
create table if not exists public.cupons (
  id         uuid primary key default gen_random_uuid(),
  marca      text not null,
  cupom      text not null,
  link       text,
  desconto   text,
  validade   date,
  ativo      boolean not null default true,
  obs        text,
  exemplo    boolean not null default false,
  criado_em  timestamptz not null default now()
);

alter table public.cupons enable row level security;

drop policy if exists "so_amanda" on public.cupons;
create policy "so_amanda" on public.cupons
  for all to authenticated
  using (public.eh_amanda()) with check (public.eh_amanda());

revoke all on public.cupons from anon;
grant select, insert, update, delete on public.cupons to authenticated;

insert into public.cupons (marca, cupom, link, desconto, validade, ativo, obs, exemplo)
select 'Marca Exemplo', 'EXEMPLO10', 'https://marcaexemplo.com/?cupom=EXEMPLO10', '10%',
       current_date + 30, true, 'Linha de exemplo. Pode apagar.', true
where not exists (select 1 from public.cupons);

-- BLOCO 7: nicho das marcas (pode rodar quantas vezes quiser)
alter table public.marcas add column if not exists nicho text;

-- BLOCO 8: marcas favoritas (destaque)
alter table public.marcas add column if not exists favorita boolean not null default false;
