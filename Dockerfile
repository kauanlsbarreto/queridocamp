# ETAPA ÚNICA DE BUILD PARA NÃO TRAVAR A RAM
FROM node:18-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Desativar telemetria e limitar memória
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_OPTIONS="--max-old-space-size=512"

COPY package.json package-lock.json ./

# TROCADO: npm install consome muito menos RAM que npm ci
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

# Build (Standalone)
RUN npm run build

# ETAPA FINAL: RUNNER
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]