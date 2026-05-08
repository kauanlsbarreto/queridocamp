@echo off
REM Criar arquivo .env a partir de .env.docker se não existir
if not exist .env.local (
    copy .env.docker .env.local
    echo ✓ Arquivo .env.local criado a partir de .env.docker
    echo ⚠️  IMPORTANTE: Edite o arquivo .env.local com suas chaves e senhas!
)

REM Build das imagens
echo 🔨 Construindo imagens Docker...
docker-compose build

REM Start dos containers em background
echo 🚀 Iniciando containers em modo detached...
docker-compose up -d

REM Mostrar status
echo.
echo ✓ Container iniciado com sucesso!
echo.
echo 📊 Status dos containers:
docker-compose ps

echo.
echo 📝 Próximos passos:
echo 1. Edite .env.local com suas credenciais reais
echo 2. Reinicie: docker-compose restart
echo.
echo 🔗 URL da aplicação: http://localhost:3000
echo 📊 Ver logs: docker-compose logs -f app
