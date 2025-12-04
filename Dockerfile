# ----------------------------------------
# 1. ESTÁGIO DE BUILD (Manter o Next.js)
# ----------------------------------------
FROM node:18 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# Você deve manter a correção de dependências que fizemos:
RUN npm install --legacy-peer-deps 
# Copia o restante do código
COPY . .
# O build gera a pasta .next/
ENV NEXT_BUILD_WORKERS=1
ENV NODE_ENV production
RUN npm run build 

# ----------------------------------------
# 2. ESTÁGIO DE PRODUÇÃO (Node.js Server)
# ----------------------------------------
# Use uma imagem leve do Node.js (não a Nginx)
FROM node:18-alpine 
WORKDIR /app

# Copia apenas o que é necessário para rodar (O código compilado)
# O .next/ contém o código compilado necessário para o SSR.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
# (Opcional) Copie os arquivos de node_modules mínimos se for necessário
# RUN npm install --production

# Variáveis de ambiente
ENV NODE_ENV production
# Defina a porta que o Next.js usará
ENV PORT 3000

EXPOSE 3000

# Comando para iniciar o servidor Next.js
CMD ["npm", "start"]