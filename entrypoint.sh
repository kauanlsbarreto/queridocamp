#!/bin/sh
# Entrypoint script para auto-update do Git e iniciar a app

set -e

echo "🔄 Checking for updates from Git..."

# Configurar Git (necessário para pull sem credenciais SSH)
git config --global --add safe.directory /app

# Tentar fazer git pull
if git pull origin main > /dev/null 2>&1; then
    echo "✅ Git pull completed successfully"
    
    # Se houve mudanças, reinstalar dependências
    if [ -f pnpm-lock.yaml ]; then
        echo "📦 Reinstalling dependencies..."
        pnpm install --frozen-lockfile > /dev/null 2>&1
        
        echo "🔨 Building application..."
        pnpm run build > /dev/null 2>&1
        echo "✅ Build completed"
    fi
else
    echo "⚠️  Git pull failed (offline or no changes)"
fi

echo "🚀 Starting application..."
exec pnpm start
