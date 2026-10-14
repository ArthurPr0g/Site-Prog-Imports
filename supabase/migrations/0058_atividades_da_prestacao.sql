-- Atividades da prestação de serviço e modelos de trabalho (2026-10-14).
--
-- Pedido do dono: acompanhar o que falta e o que já foi feito em cada
-- prestação, com roteiros prontos ("modelos de trabalho") que ele mesmo edita,
-- e ver no Painel o que está atrasado ou programado.
--
-- Decisões do dono: toda atividade tem data prevista (sem ela não há
-- "atrasada"); o responsável é sempre ele, então não há coluna de responsável.
--
-- O modelo guarda o prazo como DIAS A PARTIR DO INÍCIO da prestação, não como
-- data: o mesmo roteiro serve para qualquer prestação. Aplicar o modelo COPIA
-- os itens para a prestação — editar o modelo depois não reescreve atividades
-- que já existem, nem as já concluídas.

create table if not exists public.work_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.work_templates(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  day_offset integer not null default 0 check (day_offset >= 0),
  position integer not null default 0
);
create index if not exists work_template_items_template_idx on public.work_template_items (template_id, position);

create table if not exists public.service_activities (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  due_date date not null,
  done boolean not null default false,
  done_at timestamptz,
  position integer not null default 0,
  -- De qual modelo veio, só para referência; apagar o modelo não apaga a atividade
  template_id uuid references public.work_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_activities_order_idx on public.service_activities (service_order_id, position);
create index if not exists service_activities_pending_idx on public.service_activities (due_date) where not done;

-- Só o admin, como o resto do ERP
alter table public.work_templates enable row level security;
alter table public.work_template_items enable row level security;
alter table public.service_activities enable row level security;

create policy work_templates_admin_all on public.work_templates for all using (public.is_admin()) with check (public.is_admin());
create policy work_template_items_admin_all on public.work_template_items for all using (public.is_admin()) with check (public.is_admin());
create policy service_activities_admin_all on public.service_activities for all using (public.is_admin()) with check (public.is_admin());
