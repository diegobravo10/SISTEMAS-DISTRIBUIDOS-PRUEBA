FROM node:18-slim

WORKDIR /app

# Instalar dependencias
RUN npm install ws express pg

# Copiar archivos
COPY server.js .
COPY public ./public

# Exponer puertos
EXPOSE 9000 3000

CMD ["node", "server.js"]