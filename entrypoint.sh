#!/bin/sh
# Entrypoint script para auto-update do Git e iniciar a app

set -e

echo "🔄 Checking for updates from Git..."

# Configurar Git (necessário para pull sem credenciais SSH)
git config --global --add safe.directory /app

# Configurar Git credentials se houver variáveis de ambiente
if [ -n "$GIT_TOKEN" ]; then
    echo "🔐 Configuring Git with authentication token..."
    git config --global url."https://${GIT_TOKEN}:x-oauth-basic@github.com/".insteadOf git@github.com:
    git config --global url."https://${GIT_TOKEN}:x-oauth-basic@github.com/".insteadOf https://github.com/
fi

# Muda para branch principal se não estiver
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo "📍 Switching to main branch..."
    git checkout main 2>/dev/null || git checkout master 2>/dev/null
fi

# Tentar fazer git pull
if git pull origin main > /dev/null 2>&1 || git pull origin master > /dev/null 2>&1; then
    echo "✅ Git pull completed successfully"
    
    # Se houve mudanças, reinstalar dependências
    if [ -f pnpm-lock.yaml ]; then
        echo "📦 Reinstalling dependencies..."
        pnpm install --frozen-lockfile > /dev/null 2>&1 || pnpm install > /dev/null 2>&1
        
        echo "🔨 Building application..."
        pnpm run build > /dev/null 2>&1
        echo "✅ Build completed"
    fi
else
    echo "⚠️  Git pull failed (offline, no changes, or authentication error)"
fi

echo "🚀 Starting application..."
exec pnpm start
