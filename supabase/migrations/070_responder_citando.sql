-- 070_responder_citando.sql
-- Responder citando no chat (botão ↩ hoje é enfeite). Coluna opcional.
-- Aplicar no SQL editor do Supabase (projeto do CRM).

alter table public.atendimento_mensagens
  add column if not exists respondendo_a uuid
  references public.atendimento_mensagens (id)
  on delete set null;

create index if not exists atendimento_mensagens_respondendo_a_idx
  on public.atendimento_mensagens (respondendo_a)
  where respondendo_a is not null;

comment on column public.atendimento_mensagens.respondendo_a is
  'Mensagem citada ao responder no chat (null quando nao cita nada).';
