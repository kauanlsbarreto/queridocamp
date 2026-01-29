# ETAPA ÚNICA DE BUILD PARA NÃO TRAVAR A RAM
FROM node:18-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Instalação direta
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copia o código (que já tem seus IDs fixos)
COPY . .

# Build (Standalone)
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# ETAPA FINAL: RUNNER
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]