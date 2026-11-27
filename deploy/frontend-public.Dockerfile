# syntax=docker/dockerfile:1
FROM node:24.22.3-trixie-slim AS build
WORKDIR /app
ENV CYPRESS_INSTALL_BINARY=0 \
    NUXT_PUBLIC_API_GATEWAY_URL=/
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# The Nuxt server only needs Node.js and its runtime libraries.
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=65532:65532 /app/.output ./.output
USER 65532:65532
EXPOSE 3000
CMD [".output/server/index.mjs"]
