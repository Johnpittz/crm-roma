-- Adiciona coluna ack_status na tabela atendimento_mensagens
-- Status de entrega real do WhatsApp via WAHA (evento message.ack)
-- Fase 7 — docs/plano-implementacao-waha.md
-- Valores: pending|server|device|read|played|error

ALTER TABLE atendimento_mensagens ADD COLUMN IF NOT EXISTS ack_status TEXT DEFAULT NULL;

COMMENT ON COLUMN atendimento_mensagens.ack_status IS 'Status de entrega WhatsApp via WAHA (message.ack): pending|server|device|read|played|error';
