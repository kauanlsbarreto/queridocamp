# syntax=docker/dockerfile:1.7

FROM node:22 AS builder

WORKDIR /app

RUN npm install -g pnpm@10.11.1

ENV PNPM_STORE_DIR=/pnpm/store

COPY package.json pnpm-lock.yaml* ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV CI=true

RUN --mount=type=cache,id=next-cache,target=/app/.next/cache NODE_OPTIONS="--max-old-space-size=2048" pnpm build

FROM node:22 AS runner

WORKDIR /app

RUN npm install -g pnpm@10.11.1

ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

COPY --from=builder /app ./

EXPOSE 3001

CMD ["pnpm", "start"]