# Next.js app + Crawlee/Playwright scraper in one image.
# Chromium (and its system libraries) is installed with Playwright itself so the
# browser version always matches the installed `playwright` package.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./
RUN npm install --no-audit --no-fund
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm", "start"]
