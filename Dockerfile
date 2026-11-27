# syntax=docker/dockerfile:1

FROM node:24.22.3-trixie-slim AS build

WORKDIR /app

# Cypress is only used by the end-to-end test command; its browser binary is
# not needed to compile or run the Nuxt application.
ENV CYPRESS_INSTALL_BINARY=0

# Install dependencies separately to make the layer reusable while the source
# code changes.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
# Public deployment settings are supplied when the Node server starts. Keeping
# them out of the build stage makes one image usable in every environment.
RUN npm run build

# The Nuxt server only needs Node.js and its runtime libraries.
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    PATH=/nodejs/bin:$PATH

WORKDIR /app

# Nuxt/Nitro packages its production server and its runtime dependencies in
# .output, so no development dependencies are carried into the final image.
COPY --from=build --chown=65532:65532 /app/.output ./.output

USER 65532:65532

EXPOSE 3000

CMD [".output/server/index.mjs"]
