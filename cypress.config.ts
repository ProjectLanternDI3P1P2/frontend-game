/**
 * ADR-FE-012 — Cypress covers the user journeys in a real browser and asserts
 * visible outcomes, not internals. The suite is deliberately small: the
 * critical journeys only, never one spec per visual variation.
 */
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // app.baseURL is /game/ (nuxt.config.ts): specs visit app routes such as "/auth".
    baseUrl: process.env.CYPRESS_BASE_URL || "http://localhost:3000/game",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    video: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    retries: { runMode: 2, openMode: 0 },
    // scripts/e2e passes the same values with --env.
    env: {
      gatewayUrl: "http://localhost:8088",
      keycloakUrl: "http://localhost:8081",
    },
  },
});
