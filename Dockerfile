# ----------------------------------------
# 1. ESTÁGIO DE BUILD (Cria o código compilado)
# ----------------------------------------
FROM node:18 AS builder
WORKDIR /app
# Copia e instala dependências separadamente para aproveitar o cache
COPY package.json package-lock.json ./
<<<<<<< HEAD
RUN npm install --legacy-peer-deps --no-audit --no-fund 

FROM node:18-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_OPTIONS="--max-old-space-size=1024"

COPY --from=deps /app/node_modules ./node_modules
=======
# Mantenha a correção de dependências que fizemos
RUN npm install --legacy-peer-deps 
# Copia o restante do código
>>>>>>> d0be34ee2b100f5b9ac521a809ef0fec1987bfa0
COPY . .
ENV NEXT_BUILD_WORKERS=1
ENV NODE_ENV production
# O build Next.js compila o código na pasta .next/
RUN npm run build 

# ----------------------------------------
# 2. ESTÁGIO DE PRODUÇÃO (Servidor Node.js)
# ----------------------------------------
# Usar uma imagem Node.js leve para o ambiente de execução
FROM node:18-alpine 
WORKDIR /app
<<<<<<< HEAD
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./ 
COPY --from=builder /app/.next/static ./.next/static 
=======

# Copia apenas o que é necessário para a execução:
# 1. O package.json (para o npm start funcionar)
COPY --from=builder /app/package.json ./package.json
# 2. A pasta 'public' (assets como imagens)
COPY --from=builder /app/public ./public
# 3. O código compilado (.next)
COPY --from=builder /app/.next ./.next 
# 4. As dependências de produção para rodar 'next start'
# A pasta node_modules/.bin deve ser copiada para que o 'next' seja encontrado no PATH
COPY --from=builder /app/node_modules/ ./node_modules/ 
>>>>>>> d0be34ee2b100f5b9ac521a809ef0fec1987bfa0

# Variáveis e porta de execução
ENV NODE_ENV production
# Porta padrão que o Next.js usará
ENV PORT 3000
EXPOSE 3000
<<<<<<< HEAD
ENV PORT 3000

CMD ["node", "server.js"]
=======

# Comando para iniciar o servidor Next.js
CMD ["npm", "start"]
>>>>>>> d0be34ee2b100f5b9ac521a809ef0fec1987bfa0
