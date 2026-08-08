FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL=postgresql://unused:unused@localhost:5432/unused npx prisma generate

COPY --chown=node:node src ./src

USER node

EXPOSE 4000

CMD ["node", "src/server.js"]
