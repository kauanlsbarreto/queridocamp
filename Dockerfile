FROM node:22 AS builder

WORKDIR /app

RUN npm install -g pnpm@10.11.1

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV CI=true

RUN NODE_OPTIONS="--max-old-space-size=1024" pnpm build

FROM node:22 AS runner

WORKDIR /app

RUN npm install -g pnpm@10.11.1

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app ./

EXPOSE 3001

CMD ["pnpm", "start"]