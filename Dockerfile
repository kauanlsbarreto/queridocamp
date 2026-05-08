FROM node:22 AS builder

WORKDIR /app

RUN npm install -g pnpm@10.11.1

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile

COPY . .

ARG DB_HOST
ARG DB_USER
ARG DB_PASSWORD
ARG DB_PORT
ARG DB_NAME

ENV DB_HOST=$DB_HOST
ENV DB_USER=$DB_USER
ENV DB_PASSWORD=$DB_PASSWORD
ENV DB_PORT=$DB_PORT
ENV DB_NAME=$DB_NAME

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV CI=true

RUN NODE_OPTIONS="--max-old-space-size=1024" pnpm build

FROM node:22 AS runner

WORKDIR /app

RUN npm install -g pnpm@10.11.1

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app ./

EXPOSE 3000

CMD ["pnpm", "start"]