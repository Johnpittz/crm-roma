-- Tabela de configuração do AI Sales
CREATE TABLE IF NOT EXISTS ai_sales_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled BOOLEAN DEFAULT true NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

-- Insere registro padrão (bot ligado por padrão)
INSERT INTO ai_sales_config (enabled) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- RLS: qualquer um autenticado pode ler, só gestor pode alterar
ALTER TABLE ai_sales_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_sales_config_select" ON ai_sales_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ai_sales_config_update" ON ai_sales_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND cargo IN ('diretor', 'admin', 'gerente_comercial')
    )
  );
