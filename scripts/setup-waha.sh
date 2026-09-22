#!/bin/bash
# ============================================================
# Setup do WAHA (WhatsApp HTTP API) na VPS
# 
# Uso: bash scripts/setup-waha.sh
# 
# Pré-requisitos:
# - Docker instalado na VPS
# - Porta 3001 livre
# ============================================================

set -e

echo "🚀 Instalando WAHA (WhatsApp HTTP API)..."
echo ""

# Configurações
WAHA_PORT=${WAHA_PORT:-3001}
WAHA_SESSION=${WAHA_SESSION:-ROMA_1}
WAHA_IMAGE="devlikeapro/waha:gows"  # GOWS: sem browser, mais leve

echo "📦 Configurações:"
echo "   Porta: $WAHA_PORT"
echo "   Session: $WAHA_SESSION"
echo "   Engine: GOWS (WebSocket, sem browser)"
echo ""

# 1. Parar container existente (se houver)
echo "🔄 Parando container existente..."
docker stop waha 2>/dev/null || true
docker rm waha 2>/dev/null || true

# 2. Criar diretório de dados persistentes
echo "📁 Criando diretório de dados..."
mkdir -p /opt/waha/sessions

# 3. Baixar imagem
echo "⬇️  Baixando imagem WAHA..."
docker pull $WAHA_IMAGE

# 4. Iniciar container
echo "🐳 Iniciando WAHA..."
docker run -d \
  --name waha \
  --restart unless-stopped \
  -p $WAHA_PORT:3000 \
  -v /opt/waha/sessions:/app/.sessions \
  -e "WHATSAPP_DEFAULT_ENGINE=GOWS" \
  -e "WAHA_CLIENT_DEVICE_NAME=CRM ROMA" \
  $WAHA_IMAGE

# 5. Aguardar inicialização
echo "⏳ Aguardando WAHA iniciar..."
sleep 5

# 6. Verificar se está rodando
if curl -s http://localhost:$WAHA_PORT/api/sessions > /dev/null 2>&1; then
  echo ""
  echo "✅ WAHA instalado com sucesso!"
  echo ""
  echo "📊 Dashboard: http://localhost:$WAHA_PORT/dashboard"
  echo "📚 Swagger: http://localhost:$WAHA_PORT/swagger/"
  echo ""
  echo "🔗 Para conectar um número:"
  echo "   1. Acesse o Dashboard: http://localhost:$WAHA_PORT/dashboard"
  echo "   2. Clique em 'New Session'"
  echo "   3. Digite o nome: $WAHA_SESSION"
  echo "   4. Escaneie o QR code com seu WhatsApp"
  echo ""
  echo "📝 Variáveis de ambiente para o CRM:"
  echo "   WAHA_URL=http://$(hostname -I | awk '{print $1}'):$WAHA_PORT"
  echo "   WAHA_SESSION=$WAHA_SESSION"
  echo ""
  echo "🔗 Para configurar o webhook (quando o CRM estiver rodando):"
  echo "   curl -X PUT http://localhost:$WAHA_PORT/api/sessions/$WAHA_SESSION \\"
  echo "     -H 'Content-Type: application/json' \\"
  echo "     -d '{\"config\": {\"webhooks\": [{\"url\": \"https://SEU-CRM/api/webhooks/waha\", \"events\": [\"message\"]}]}}'"
  echo ""
else
  echo ""
  echo "❌ Erro: WAHA não está respondendo."
  echo "   Verifique os logs: docker logs waha"
  echo ""
fi
