-- Amplia o CHECK de tipo_midia para aceitar video e sticker
-- (o valor 'video' era rejeitado e derrubava o insert de vídeos recebidos;
--  'document'/'image' em inglês do envio agora são mapeados no código)
-- Fase 8 — correção do E2E (docs/plano-implementacao-waha.md)

ALTER TABLE atendimento_mensagens DROP CONSTRAINT IF EXISTS atendimento_mensagens_tipo_midia_check;
ALTER TABLE atendimento_mensagens ADD CONSTRAINT atendimento_mensagens_tipo_midia_check
  CHECK (tipo_midia IN ('texto', 'imagem', 'audio', 'documento', 'video', 'sticker'));
