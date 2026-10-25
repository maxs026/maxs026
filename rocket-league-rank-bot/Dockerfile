FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production DATABASE_PATH=/data/bot.sqlite
# /data doit être un volume persistant, sinon les rangs sont perdus à chaque déploiement.
VOLUME /data
USER node
CMD ["node", "src/index.js"]
