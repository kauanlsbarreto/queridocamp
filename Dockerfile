# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@10.11.1 && apk add --no-cache git

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Tenta o build
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["pnpm", "start"]