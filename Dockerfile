# Produkční image pro hosting (Render, Railway, Fly.io, VPS…)
# Obsahuje Node.js + Chromium ve verzi odpovídající balíčku playwright.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Vytvoří/aktualizuje tabulky, spustí worker (fronta + inbox) a webovou aplikaci
CMD ["bash", "scripts/start.sh"]
