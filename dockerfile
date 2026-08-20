# Usa la imagen oficial de Node.js 18 LTS
FROM node:18-alpine

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala dependencias
RUN npm install --production

# Copia el resto del código
COPY . .

# Expone el puerto (Coolify lo asigna automáticamente)
EXPOSE 3000

# Comando de inicio
CMD ["node", "server.js"]
