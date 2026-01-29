# ---------- ETAPA 1: DEPENDÊNCIAS ----------
FROM node:18-alpine AS deps

# Instalar ferramentas de compilação necessárias
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Copiar package.json e package-lock.json primeiro (para cache)
COPY package.json package-lock.json ./

# Instalar dependências ignorando peer-deps conflitantes
RUN npm ci --legacy-peer-deps

# ---------- ETAPA 2: BUILD ----------
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar node_modules da etapa de deps
COPY --from=deps /app/node_modules ./node_modules

# Copiar o resto do projeto
COPY . .

# Desabilitar telemetria Next.js
ENV NEXT_TELEMETRY_DISABLED 1

# Build do Next.js
RUN npm run build

# ---------- ETAPA 3: CONTAINER DE PRODUÇÃO ----------
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copiar apenas o necessário do build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# Rodar servidor
CMD ["node", "server.js"]
