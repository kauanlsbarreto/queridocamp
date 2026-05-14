# syntax=docker/dockerfile:1.7

FROM node:22 AS builder

WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm@10.11.1

# Definir diretório de cache do pnpm
ENV PNPM_STORE_DIR=/pnpm/store

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instalar dependências com cache (BuildKit)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Copiar todo o código
COPY . .

# Variáveis de ambiente para build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV CI=true

# Build do Next.js com cache
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    NODE_OPTIONS="--max-old-space-size=2048" \
    pnpm build

# --- Runner ---
FROM node:22 AS runner

WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm@10.11.1

ENV NODE_ENV=production
ENV PORT=3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Copiar build do stage anterior
COPY --from=builder /app ./

EXPOSE 3001

CMD ["pnpm", "start"]