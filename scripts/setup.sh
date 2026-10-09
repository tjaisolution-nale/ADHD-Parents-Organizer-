#!/usr/bin/env bash
# Instalacja bota „Dom” na Macu: zależności, workflow n8n i ich import do n8n w Dockerze.
# Własny, już działający kontener n8n: N8N_CONTAINER=<nazwa-kontenera> scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo "Brak Dockera. Zainstaluj i uruchom Docker Desktop."; exit 1; }
command -v node >/dev/null || { echo "Brak Node.js. Zainstaluj Node.js 20 lub nowszy."; exit 1; }
major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 20 ]; then
  echo "Potrzebny Node.js 20 lub nowszy (masz $(node -v))."
  exit 1
fi

if [ ! -f n8n/.env ]; then
  cp n8n/.env.example n8n/.env
  echo "Utworzono n8n/.env. Uzupełnij go według docs/setup.md i uruchom ten skrypt ponownie."
  exit 1
fi

npm ci
npm run build:n8n

WORKFLOWS=(dom-bot.json dom-bledy.json)
if [ -n "${N8N_CONTAINER:-}" ]; then
  for wf in "${WORKFLOWS[@]}"; do
    docker cp "n8n/workflows/$wf" "$N8N_CONTAINER:/tmp/$wf"
    docker exec "$N8N_CONTAINER" n8n import:workflow --input="/tmp/$wf"
  done
else
  COMPOSE=(docker compose -f n8n/docker-compose.yml)
  "${COMPOSE[@]}" up -d
  echo "Czekam, aż n8n wystartuje..."
  for _ in $(seq 1 30); do
    if curl -fs http://127.0.0.1:5678/healthz >/dev/null; then break; fi
    sleep 2
  done
  for wf in "${WORKFLOWS[@]}"; do
    "${COMPOSE[@]}" exec -T n8n n8n import:workflow --input="/workflows/$wf"
  done
fi

cat <<'EOT'

Gotowe. Dalej w n8n (http://localhost:5678):
  1. Otwórz workflow „Dom – bot” → Settings i sprawdź, że Error workflow to „Dom – błędy”.
  2. Włącz „Dom – bot” (n8n 1.x: przełącznik Active; n8n 2.x: przycisk Publish).
  3. Napisz w grupie „Dom”: „jutro 18 test”. Bot powinien odpowiedzieć w kilka sekund.
EOT
