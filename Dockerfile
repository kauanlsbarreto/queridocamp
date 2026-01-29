# ----------------------------------------
# 1. ESTÁGIO DE BUILD (Cria o código compilado)
# ----------------------------------------
FROM node:18 AS builder
WORKDIR /app
# Copia e instala dependências separadamente para aproveitar o cache
COPY package.json package-lock.json ./
# Mantenha a correção de dependências que fizemos
RUN npm install --legacy-peer-deps 
# Copia o restante do código
COPY . .
ENV NEXT_BUILD_WORKERS=1
ENV NODE_ENV production
# O build Next.js compila o código na pasta .next/
RUN npm run build 

# ----------------------------------------
# 2. ESTÁGIO DE PRODUÇÃO (Servidor Node.js)
# ----------------------------------------
# Usar uma imagem Node.js leve para o ambiente de execução
FROM node:18-alpine
WORKDIR /app

# Copia apenas o que é necessário para a execução:
# 1. O package.json (para o npm start funcionar)
COPY --from=builder /app/package.json ./package.json
# 2. A pasta 'public' (assets como imagens)
COPY --from=builder /app/public ./public
# 3. O código compilado (.next)
COPY --from=builder /app/.next ./.next 
# 4. As dependências de produção para rodar 'next start'
# A pasta node_modules/.bin deve ser copiada para que o 'next' seja encontrado no PATH
COPY --from=builder /app/node_modules/ ./node_modules/ 

# Variáveis e porta de execução
ENV NODE_ENV production
# Porta padrão que o Next.js usará
ENV PORT 3000
EXPOSE 3000

# Comando para iniciar o servidor Next.js
CMD ["npm", "start"]