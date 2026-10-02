# syntax=docker/dockerfile:1.7
# ---- build -----------------------------------------------------------------
FROM node:24-alpine AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /repo
ARG VITE_API_URL=
ARG VITE_WS_URL=
ARG VITE_KOFI_URL=
ARG VITE_REPO_URL=
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL VITE_KOFI_URL=$VITE_KOFI_URL VITE_REPO_URL=$VITE_REPO_URL
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY packages/doc/package.json packages/doc/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @forkcast/web... --config.confirmModulesPurge=false
COPY packages packages
COPY apps/web apps/web
RUN pnpm turbo run build --filter=@forkcast/web...

# ---- runtime ---------------------------------------------------------------
FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
