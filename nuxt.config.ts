import { fileURLToPath } from "node:url";

// ADR-FE-010: SCSS breakpoint helpers are injected so every component can use
// `bp.from(...)` without a fragile relative import path.
//
// The directory is given to sass as a LOAD PATH; it is never pasted into the
// injected SCSS source. A Windows absolute path inside an `@use "..."` string
// is a parsing hazard on both sides, and building it needed a backslash regex
// that broke the parser reading this very file.
const stylesDir = fileURLToPath(
  new URL("./app/assets/styles", import.meta.url),
);

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  // ADR-FE-003: hybrid rendering. The server runtime stays enabled so that the
  // routes listed in `routeRules` below can be rendered per request; everything
  // else is statically generated at build time. CSR is never the default.
  ssr: true,

  // ADR-FE-003: every non-default route declares its rendering mode here and is
  // justified in docs/rendering-modes.md.
  routeRules: {
    // Default: durable reference content is statically generated. It is cheap
    // to serve, indexable, readable before JavaScript runs, and it survives the
    // API Gateway being unavailable.
    "/": { prerender: true },
    "/demo": { prerender: true },
    "/demo/**": { prerender: true },

    // A route that genuinely needs a request-time render is declared here, one
    // entry per route, and justified in docs/rendering-modes.md. Two shapes are
    // allowed:
    //
    //   '/example':       { ssr: true, prerender: false, swr: 60 },
    //                     fresh-enough and indexable, with the shared cache
    //                     window bounding load on the service behind it;
    //
    //   '/example-live':  { ssr: true, prerender: false, cache: false },
    //                     correctness beats cost — a cached answer would be
    //                     wrong (incident status, live availability).
    //
    // An SSR route without a stated caching strategy is not acceptable
    // (ADR-FE-003). CSR is never the default on the public site.
  },

  nitro: {
    prerender: { crawlLinks: true, failOnError: false },
  },

  // ADR-FE-015: automated accessibility linting.
  modules: ["@nuxt/eslint"],

  // ADR-FE-009: only `shared/ui` is globally auto-imported.
  components: [{ path: "~/shared/ui", pathPrefix: false }],
  imports: { dirs: ["shared/composables", "shared/utils"] },

  css: ["~/assets/styles/main.scss"],

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "breakpoints" as bp;\n',
          loadPaths: [stylesDir],
        },
      },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: "en" },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
    },
  },

  // ADR-FE-011: the small number of public API calls goes through the Gateway.
  runtimeConfig: {
    public: {
      apiGatewayUrl:
        process.env.NUXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8080",
      apiVersion: process.env.NUXT_PUBLIC_API_VERSION || "v1",
      telemetryEndpoint: process.env.NUXT_PUBLIC_TELEMETRY_ENDPOINT || "",
      appName: "public-site",
      appVersion: process.env.NUXT_PUBLIC_APP_VERSION || "dev",
      commitSha: process.env.NUXT_PUBLIC_COMMIT_SHA || "local",
      builtAt: process.env.NUXT_PUBLIC_BUILT_AT || "local",
    },
  },

  typescript: { typeCheck: false, strict: true },
});
