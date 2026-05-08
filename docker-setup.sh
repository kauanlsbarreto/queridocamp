#!/bin/bash
# Deploy do Sitequerido no Docker com BD Hostinger
# Este script automatiza o setup inicial

set -e

echo "======================================"
echo "🚀 Sitequerido Docker Setup"
echo "======================================"
echo ""

# 1. Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não instalado. Instale com: curl -fsSL https://get.docker.com | sh"
    exit 1
fi
echo "✅ Docker encontrado: $(docker --version)"
echo ""

# 2. Criar .env.local
if [ ! -f .env.local ]; then
    echo "📝 Criando .env.local a partir de .env.docker..."
    cp .env.docker .env.local
    echo "✅ .env.local criado"
    echo ""
    echo "⚠️  IMPORTANTE: Edite .env.local com suas credenciais:"
    echo ""
    cat .env.local | grep -E "^(DB_|TOKEN_|PAGBANK_|FACEIT_|API_|LOJA_|DATHOST_)" | head -20
    echo ""
    echo "Abra em seu editor favorito:"
    echo "  nano .env.local    # Linux/Mac"
    echo "  code .env.local    # VS Code"
    echo ""
    read -p "Pressione ENTER após editar o .env.local..."
fi

# 3. Build
echo "🔨 Construindo imagem Docker..."
docker-compose build

echo ""
echo "✅ Build concluído!"
echo ""

# 4. Perguntar qual config usar
echo "Qual configuração deseja usar?"
echo "1) Development/Staging   (sem Redis)"
echo "2) Production           (com Redis)"
read -p "Escolha (1 ou 2): " choice

case $choice in
    1)
        CONFIG_FILE="docker-compose.yaml"
        echo "📦 Usando: docker-compose.yaml"
        ;;
    2)
        CONFIG_FILE="docker-compose.prod.yaml"
        echo "📦 Usando: docker-compose.prod.yaml"
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac

echo ""
echo "🚀 Iniciando containers..."
docker-compose -f $CONFIG_FILE up -d

echo ""
echo "✅ Containers iniciados!"
echo ""
echo "📊 Status:"
docker-compose -f $CONFIG_FILE ps

echo ""
echo "🔗 Aplicação disponível em:"
if [ "$CONFIG_FILE" = "docker-compose.yaml" ]; then
    echo "   http://localhost:3000"
else
    echo "   http://localhost:3000 (via Nginx reverse proxy)"
fi

echo ""
echo "📝 Próximos passos:"
echo "   1. Teste: curl http://localhost:3000"
echo "   2. Ver logs: docker-compose logs -f app"
echo "   3. Configure Nginx como reverse proxy"
echo "   4. Instale SSL com Certbot"
echo ""
echo "💡 Dicas:"
echo "   - Ver logs: docker-compose -f $CONFIG_FILE logs -f"
echo "   - Entrar no container: docker-compose -f $CONFIG_FILE exec app sh"
echo "   - Parar: docker-compose -f $CONFIG_FILE down"
echo ""
echo "✅ Setup concluído!"
