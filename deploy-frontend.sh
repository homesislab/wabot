#!/bin/bash
# deploy-frontend.sh — Build dan deploy frontend tanpa masalah Docker cache
# Usage: ./deploy-frontend.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔨 Building frontend (local)..."
cd "$SCRIPT_DIR/client"

# Load env dari root .env
set -a
source "$SCRIPT_DIR/.env"
set +a

npm install
npm run build

echo "📦 Copying dist to container..."
docker cp dist/. wabot-frontend:/usr/share/nginx/html/

echo "🔄 Reloading nginx..."
docker exec wabot-frontend nginx -s reload

echo "✅ Frontend deployed successfully!"
echo "   Hard refresh browser: Ctrl+Shift+R"
