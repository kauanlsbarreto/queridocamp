# --- ESTÁGIO 1: Dependências ---
FROM node:18-slim AS deps
WORKDIR /app

# Copia apenas os arquivos de pacotes para otimizar o cache
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund 

# --- ESTÁGIO 2: Build ---
FROM node:18-slim AS builder
WORKDIR /app

# Variáveis de ambiente para evitar travamentos em servidores com pouca RAM
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV NEXT_BUILD_WORKERS=1
ENV NODE_ENV production

# Traz as dependências do estágio anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Executa o build (compilação do Next.js)
RUN npm run build 

# --- ESTÁGIO 3: Produção ---
FROM node:18-slim AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000
ENV NEXT_TELEMETRY_DISABLED 1

# Copia apenas o necessário para rodar, mantendo a imagem leve
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next 
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]