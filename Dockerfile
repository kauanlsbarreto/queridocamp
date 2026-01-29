# ---------- ETAPA 1: DEPENDÊNCIAS ----------
FROM node:18-alpine AS deps
# libc6-compat é necessária para bibliotecas específicas do Next.js no Alpine 
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar apenas arquivos de definição de pacotes 
COPY package.json package-lock.json ./

# Instalar com cache agressivo
RUN npm ci --legacy-peer-deps

# ---------- ETAPA 2: BUILD ----------
FROM node:18-alpine AS builder
WORKDIR /app

# Reutilizar node_modules da etapa anterior 
COPY --from=deps /app/node_modules ./node_modules
# Copiar o código fonte (agora filtrado pelo .dockerignore) [cite: 3]
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# Build otimizado
RUN npm run build

# ---------- ETAPA 3: RUNNER (PRODUÇÃO) ----------
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

# Segurança: Rodar como usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar apenas o necessário do standalone (Next.js 12+) 
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]