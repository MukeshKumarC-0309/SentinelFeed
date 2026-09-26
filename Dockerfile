# SENTINEL FEED - no dependencies, so no build stage and no package install.
FROM node:22-alpine

# curl is only here so the container can report its own health.
RUN apk add --no-cache curl tzdata

WORKDIR /app

# Source is copied as-is; .dockerignore keeps data/ and logs out of the image.
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Editions, aggregates and the API token live on a volume so they survive
# a rebuild. The directory is owned by the unprivileged node user.
RUN mkdir -p /data && chown -R node:node /data /app
ENV DATA_DIR=/data \
    HOST=0.0.0.0 \
    PORT=4173 \
    NODE_ENV=production
VOLUME ["/data"]

USER node
EXPOSE 4173

HEALTHCHECK --interval=60s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/status" || exit 1

CMD ["node", "server.js"]
