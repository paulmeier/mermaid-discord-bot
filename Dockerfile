# ── Base image ─────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

# ── System dependencies ─────────────────────────────────────────────────────────
# Install Chromium (used by @mermaid-js/mermaid-cli via Puppeteer) and fonts.
# Using the distro-packaged Chromium avoids downloading a separate binary during
# npm install and keeps the image size reasonable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       chromium \
       fonts-liberation \
       fonts-noto \
       fonts-noto-cjk \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Puppeteer environment ───────────────────────────────────────────────────────
# Tell Puppeteer (used by mmdc internally) to skip downloading its own Chrome
# bundle and to use the system-installed Chromium instead.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# ── Application setup ──────────────────────────────────────────────────────────
WORKDIR /app

# Copy manifests first so npm install is cached as a separate layer.
# Only re-runs when package.json or package-lock.json changes.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the source code
COPY . .

# ── Security: run as a non-root user ───────────────────────────────────────────
RUN groupadd -r botuser \
    && useradd -r -g botuser -d /app botuser \
    && chown -R botuser:botuser /app
USER botuser

# ── Health check ───────────────────────────────────────────────────────────────
# The bot writes /tmp/bot-ready when it successfully connects to Discord.
# Docker will mark the container unhealthy if this file is absent after startup.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD test -f /tmp/bot-ready || exit 1

# ── Entrypoint ─────────────────────────────────────────────────────────────────
CMD ["node", "src/index.js"]
