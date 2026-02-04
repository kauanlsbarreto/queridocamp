FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund 

FROM node:18-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# Mantém o limite de 1024MB para o build 
ENV NODE_OPTIONS="--max-old-space-size=1024"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build 

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat

# Copia apenas o necessário para rodar standalone 
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]