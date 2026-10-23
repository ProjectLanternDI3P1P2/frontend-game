import { fileURLToPath } from "node:url";

// ADR-FE-010: SCSS breakpoint helpers are injected so every component can use
// `bp.from(...)` without a fragile relative import path.
//
// The directory is given to sass as a LOAD PATH; it is never pasted into the
// injected SCSS source. A Windows absolute path inside an `@use "..."` string
// is a parsing hazard on both sides, and building it needed a backslash regex
// that broke the parser reading this very file.
const stylesDir = fileURLToPath(new URL("./app/assets/styles", import.meta.url));
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  // The Node runtime stays enabled: deployed configuration is supplied by the
  // environment when the container starts, never while its image is built.
  ssr: true,

  // ADR-FE-003: every non-default route declares its rendering mode here and is
  // justified in docs/rendering-modes.md.
  routeRules: {
    // Authentication is restored from sessionStorage by Keycloak in the browser.
    // The root route stays static so its shell remains readable before hydration.
    "/": { ssr: false },
    "/auth": { ssr: false },
    "/home": { ssr: false },
    "/players": { ssr: false },
    "/players/**": { ssr: false },
    // Component demonstrations load the same client plugins as the game. Do
    // not prerender them, otherwise their public runtime configuration would
    // be frozen in the image.
    "/demo": { ssr: false },
    "/demo/**": { ssr: false },

    // The dungeon explorer is authenticated, interactive game state with no
    // SEO value: client-rendered, as the game client is (ADR-FE-004).
    // Justified in docs/rendering-modes.md.
    "/dungeon": { ssr: false },
    "/dungeon/**": { ssr: false },

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
    // Do not turn linked CSR routes into static HTML implicitly. A future
    // static route must opt in with `prerender: true` and use only portable
    // (relative) public URLs.
    prerender: { crawlLinks: false, failOnError: false },
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
    // The production ingress exposes this application under
    // https://groupe7.diiage.org/game.
    baseURL: process.env.NUXT_APP_BASE_URL || "/game/",
    head: {
      htmlAttrs: { lang: "en" },
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
    },
  },

  // ADR-FE-011: the small number of public API calls goes through the Gateway.
  runtimeConfig: {
    public: {
      // Nuxt maps NUXT_PUBLIC_* variables to these declared keys at server
      // startup. Never read process.env here: that would capture a build-time
      // value in generated output.
      //
      // The fallbacks are safe for a statically generated browser page behind
      // the production ingress. Local development supplies explicit values in
      // .env instead.
      apiGatewayUrl: "/",
      apiVersion: "v1",
      telemetryEndpoint: "",
      appName: "game-client",
      appVersion: "dev",
      commitSha: "local",
      builtAt: "local",
      keycloakUrl: "/auth",
      keycloakRealm: "lantern",
      keycloakClientId: "lantern-public",
      siteUrl: "",
    },
  },

  typescript: { typeCheck: false, strict: true },
});
