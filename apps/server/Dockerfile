# syntax=docker/dockerfile:1.7
# ---- build -----------------------------------------------------------------
FROM node:24-alpine AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY packages/doc/package.json packages/doc/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @forkcast/server... --config.confirmModulesPurge=false
COPY packages packages
COPY apps/server apps/server
RUN pnpm turbo run build --filter=@forkcast/server...
# Self-contained production tree (workspace packages included)
RUN pnpm --filter=@forkcast/server --prod deploy --legacy /out

# ---- runtime ---------------------------------------------------------------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
