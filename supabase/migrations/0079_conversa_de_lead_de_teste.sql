-- Conversa ligada a um lead de teste (origem 'teste…') já nasce marcada como
-- teste: fica fora do placar, dos resultados e do aprendizado (28/10/2026,
-- quando o chat do Felipe foi reiniciado). Aditiva.

create or replace function public.ia_conversa_de_teste() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.lead_id is not null and exists (select 1 from leads l where l.id = new.lead_id and l.source like 'teste%') then
    new.is_test := true;
  end if;
  return new;
end $$;

create trigger ia_conversa_de_teste before insert or update of lead_id on public.ia_conversations
for each row execute function public.ia_conversa_de_teste();

revoke execute on function public.ia_conversa_de_teste() from public, anon, authenticated;
