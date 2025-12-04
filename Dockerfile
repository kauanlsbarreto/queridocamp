# front-end/Dockerfile

# Etapa de build
FROM node:18 AS builder
WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps
ENV NEXT_BUILD_WORKERS=1
RUN npm run build

# Etapa final: serve com nginx
FROM nginx:alpine
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
