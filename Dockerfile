FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# PORT بيحقنه المضيف (Back4App/Zeabur/HF) — السيرفر بيقراه من البيئة
EXPOSE 4000

CMD ["node", "server/index.js"]
