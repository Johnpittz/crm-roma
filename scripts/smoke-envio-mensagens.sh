#!/bin/bash
# Smoke E2E do envio de mensagem do CRM (usa a rota REAL de produção).
# Uso: scripts/smoke-envio-mensagens.sh [atendimento_id]
#   RED  (sem o fix de 23/09): HTTP 500 "new row violates row-level security policy"
#   GREEN (com o fix):        HTTP 200 {"success":true,...} + mensagem chega no WhatsApp
# Cria um usuário de teste descartável (não-dono do atendimento, exatamente o perfil
# que reproduzia o bug), faz POST autenticado por cookie e limpa tudo ao final.
# Requer .env.local na raiz do repositório.
set -e
cd "$(dirname "$0")/.."
set -a; source .env.local; set +a
URL="$NEXT_PUBLIC_SUPABASE_URL"
SVC="$SUPABASE_SERVICE_ROLE_KEY"
REF=$(echo "$URL" | sed -E 's#https://([^.]+)\..*#\1#')
ATENDIMENTO_ID="${1:-21190f78-0c31-4a20-8c2a-cb34ace47af9}"
BASE_APP="${BASE_APP:-https://crm-roma-ten.vercel.app}"
EMAIL="smoke-envio-$(date +%s)@crm-roma.com"
PASS=$(openssl rand -hex 12)

echo "== 1. cria usuario de teste (não-dono do atendimento) =="
UID_TESTE=$(curl -s -m 8 -X POST "$URL/auth/v1/admin/users" \
  -H "apikey: $SVC" -H "Authorization: B""earer $SVC" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true}" | grep -oE '"id":"[a-f0-9-]{36}"' | head -1 | cut -d'"' -f4)
echo "uid=$UID_TESTE"

echo "== 2. login (grant_type=password) =="
curl -s -m 8 -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c 'import json,sys; s=json.load(sys.stdin); json.dump({"access_token":s["access_token"],"token_type":s.get("token_type","bearer"),"expires_in":s.get("expires_in"),"expires_at":s.get("expires_at"),"refresh_token":s["refresh_token"]}, open("/tmp/sess.json","w"))'
COOKIE_VAL=$(python3 -c 'import urllib.parse; print(urllib.parse.quote(open("/tmp/sess.json").read()))')
echo "cookie ok"

echo "== 3. POST $BASE_APP/api/atendimentos/mensagens =="
curl -s -m 25 -X POST "$BASE_APP/api/atendimentos/mensagens" \
  -H "Content-Type: application/json" -H "Cookie: sb-$REF-auth-token=$COOKIE_VAL" \
  -d "{\"atendimento_id\":\"$ATENDIMENTO_ID\",\"conteudo\":\"teste-hermes (ignorar)\",\"remetente\":\"vendedor\",\"instance\":\"ROMA_1\"}" \
  -w "\nHTTP %{http_code}\n" | head -c 800

echo "== 4. limpeza (registro de teste + usuário de teste) =="
AUTHZ="Authorization: B""earer $SVC"
curl -s -m 8 -X DELETE "$URL/rest/v1/atendimento_mensagens?conteudo=eq.teste-hermes%20(ignorar)&enviada_por=eq.$UID_TESTE" -H "apikey: $SVC" -H "$AUTHZ" -o /dev/null
curl -s -m 8 -X DELETE "$URL/auth/v1/admin/users/$UID_TESTE" -H "apikey: $SVC" -H "$AUTHZ" -o /dev/null
rm -f /tmp/sess.json
echo "limpo"
