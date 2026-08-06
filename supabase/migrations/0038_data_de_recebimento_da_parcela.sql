-- Quando a parcela foi RECEBIDA, e não quando ela vencia.
--
-- O lançamento no caixa usava o vencimento como data, inclusive depois de a
-- parcela ser baixada. Enquanto ela é previsão isso está certo: o dinheiro é
-- esperado naquele dia. Depois de recebida, não: pagamento atrasado entra num
-- mês e ficava arquivado noutro.
--
-- O efeito prático era o dono dar baixa numa parcela vencida e o Financeiro do
-- mês não se mexer — porque o valor tinha ido para o mês do vencimento, que já
-- passou. Parecia falta de sincronia; era data errada.
alter table public.payment_installments
  add column if not exists paid_at date;

comment on column public.payment_installments.paid_at is
  'Dia em que o dinheiro entrou. Só faz sentido com status Recebida; é a data que vale no caixa.';

-- Backfill conservador: para as já recebidas, vale o vencimento — que é o que o
-- sistema vinha usando. Assim nenhum número de mês fechado se move sozinho
-- agora. O dono corrige uma a uma o que tiver sido pago fora do prazo.
update public.payment_installments
set paid_at = due_date
where status = 'Recebida' and paid_at is null;

-- Parcela que não está recebida não pode carregar data de recebimento: seria
-- uma data de entrada de dinheiro que não entrou.
alter table public.payment_installments
  drop constraint if exists payment_installments_paid_at_check;
alter table public.payment_installments
  add constraint payment_installments_paid_at_check
  check (paid_at is null or status = 'Recebida');

NOTIFY pgrst, 'reload schema';
