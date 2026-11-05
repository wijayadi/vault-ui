FROM node:24-alpine AS build
RUN npm install -g pnpm@10.28.0
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
WORKDIR /app

COPY . .
# Install and build in a single layer, then remove dev dependencies so the
# layer does not persist hundreds of thousands of pnpm files.
RUN pnpm install --frozen-lockfile --config.node-linker=hoisted \
    && pnpm build \
    && rm -rf node_modules

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8000
WORKDIR /app

RUN npm install -g pnpm@10.28.0 \
    && addgroup -S vaultui \
    && adduser -S vaultui -G vaultui

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --config.node-linker=hoisted \
    && pnpm store prune \
    && rm -rf /root/.cache

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --chown=vaultui:vaultui bin/entrypoint.sh ./bin/entrypoint.sh

RUN chmod +x ./bin/entrypoint.sh && chown vaultui:vaultui ./bin/entrypoint.sh
USER vaultui

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./bin/entrypoint.sh"]
CMD ["node", "dist-server/index.js"]
