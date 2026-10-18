# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build

WORKDIR /app

# Cypress is only used by the end-to-end test command; its browser binary is
# not needed to compile or run the Nuxt application.
ENV CYPRESS_INSTALL_BINARY=0

# Install dependencies separately to make the layer reusable while the source
# code changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Nuxt embeds public config in prerendered HTML during this build.
# Compose overrides this default with '/' so browser requests use Traefik
# on the frontend's origin. Runtime ENV alone cannot rewrite static HTML.
ARG NUXT_PUBLIC_API_GATEWAY_URL=http://localhost:8080
ENV NUXT_PUBLIC_API_GATEWAY_URL=$NUXT_PUBLIC_API_GATEWAY_URL
RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

# Nuxt/Nitro packages its production server and its runtime dependencies in
# .output, so no development dependencies are carried into the final image.
COPY --from=build --chown=node:node /app/.output ./.output

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
