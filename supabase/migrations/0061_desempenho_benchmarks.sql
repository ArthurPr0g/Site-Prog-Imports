-- Aba "Desempenho" da página de produto: resultados de testes reais (jogos, programas,
-- bateria, ruído) feitos pelo canal Bench Promos (https://benchpromos.com.br/benchmarks).
--
-- Regra de fidelidade: só entra resultado de uma configuração IGUAL à do produto
-- (mesmo modelo, mesmo processador e mesma placa de vídeo). O casamento é revisado à
-- mão; config_testada guarda exatamente como a fonte descreve a máquina testada, e
-- condicao, qualquer diferença ou modo de teste (ex.: "16GB de RAM", "25 Watts").
create table if not exists public.product_benchmarks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  grupo text not null check (grupo in ('jogo', 'programa', 'bateria', 'ruido')),
  teste text not null,               -- ex.: "Cyberpunk 2077"
  ajuste text,                       -- ex.: "Quad HD · Ultra"
  resultado numeric not null,
  unidade text not null,             -- FPS, Pontos, Minutos, Segundos, dB
  menor_melhor boolean not null default false,
  posicao_ranking integer,           -- colocação entre todos os notebooks testados nesse teste
  total_ranking integer,
  config_testada text not null,
  condicao text,
  fonte text not null default 'Bench Promos',
  fonte_url text not null,
  coletado_em date not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_benchmarks_produto_idx on public.product_benchmarks (product_id, grupo, ordem);

alter table public.product_benchmarks enable row level security;
create policy product_benchmarks_public_read on public.product_benchmarks for select using (true);
create policy product_benchmarks_admin_all on public.product_benchmarks for all using (is_admin()) with check (is_admin());
