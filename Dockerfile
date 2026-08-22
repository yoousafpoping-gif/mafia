FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Hugging Face Spaces بتتواصل مع الحاوية على 7860
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server/index.js"]
