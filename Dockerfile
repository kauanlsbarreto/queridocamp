# ---------- ETAPA 1: DEPENDÊNCIAS ----------
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ---------- ETAPA 2: BUILD ----------
FROM node:18-alpine AS builder
WORKDIR /app

# DECLARAÇÃO DE VARIÁVEIS PARA O NAVEGADOR
# Sem isso, o FaceitLogin.tsx recebe 'undefined'
ARG NEXT_PUBLIC_FACEIT_CLIENT_ID
ARG NEXT_PUBLIC_FACEIT_REDIRECT_URI

ENV NEXT_PUBLIC_FACEIT_CLIENT_ID=$NEXT_PUBLIC_FACEIT_CLIENT_ID
ENV NEXT_PUBLIC_FACEIT_REDIRECT_URI=$NEXT_PUBLIC_FACEIT_REDIRECT_URI
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------- ETAPA 3: RUNNER ----------
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar apenas o necessário para rodar (Standalone mode)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]