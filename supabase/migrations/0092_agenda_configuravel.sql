/*
 * 0092 — Agenda do Arthur configurável e tipos de reunião (pedido de 29/10/2026).
 *
 * ia_config.agenda: em que dias e faixas de horário a Lia pode oferecer reunião, a duração, a antecedência
 * mínima, quantas por dia, até quantos dias à frente e dias bloqueados. Antes era fixo no código
 * (dias úteis, 9h–18h, 30 min). Horários de Brasília. Dias da semana: 0 = domingo … 6 = sábado.
 *
 * reunioes.tipo: descoberta (venda), alinhamento (fechar pontos do projeto), fechamento (entrega/aprovação
 * final), rodada (ajustes) ou outra. reunioes.status ganha 'realizada'.
 */
alter table public.ia_config add column if not exists agenda jsonb not null default jsonb_build_object(
  'dias', jsonb_build_object(
    '1', jsonb_build_array(jsonb_build_array('09:00', '12:00'), jsonb_build_array('14:00', '18:00')),
    '2', jsonb_build_array(jsonb_build_array('09:00', '12:00'), jsonb_build_array('14:00', '18:00')),
    '3', jsonb_build_array(jsonb_build_array('09:00', '12:00'), jsonb_build_array('14:00', '18:00')),
    '4', jsonb_build_array(jsonb_build_array('09:00', '12:00'), jsonb_build_array('14:00', '18:00')),
    '5', jsonb_build_array(jsonb_build_array('09:00', '12:00'), jsonb_build_array('14:00', '18:00'))),
  'duracao_min', 30,
  'antecedencia_h', 2,
  'max_por_dia', 2,
  'horizonte_dias', 14,
  'bloqueios', '[]'::jsonb);
comment on column public.ia_config.agenda is 'Disponibilidade do Arthur para reuniões marcadas pela Lia: dias (0=dom..6=sáb) com faixas [inicio, fim] em horário de Brasília, duracao_min, antecedencia_h, max_por_dia, horizonte_dias, bloqueios (datas AAAA-MM-DD). 0092.';

alter table public.reunioes add column if not exists tipo text not null default 'descoberta'
  check (tipo in ('descoberta', 'alinhamento', 'fechamento', 'rodada', 'outra'));
alter table public.reunioes drop constraint if exists reunioes_status_check;
alter table public.reunioes add constraint reunioes_status_check check (status in ('marcada', 'cancelada', 'realizada'));
comment on column public.reunioes.tipo is 'descoberta (venda), alinhamento (pontos do projeto), fechamento (entrega/aprovação final), rodada (ajustes) ou outra. 0092.';
