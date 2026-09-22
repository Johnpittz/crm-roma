-- Permite o upload DIRETO de mídia pelos clientes autenticados (URLs assinadas),
-- usado pelo chat para arquivos maiores que o limite de 4,5 MB da Vercel
-- (Fase 8 — E2E; ver docs/plano-implementacao-waha.md).
-- Idempotente: seguro de rodar mais de uma vez.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'chat_media_insert_authenticated'
  ) THEN
    CREATE POLICY "chat_media_insert_authenticated" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'chat-media');
  END IF;
END $$;

COMMENT ON POLICY "chat_media_insert_authenticated" ON storage.objects IS
  'Upload de mídia do chat (enviados/) por usuários logados — envio por URL no WAHA';
