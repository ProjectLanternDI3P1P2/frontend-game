/**
 * ADR-FE-012 — The end-to-end harness, proven on the application shell.
 *
 * The standard public-web journeys belong to the squads that ship the routes.
 * This spec keeps the harness, the Keycloak session and the axe integration
 * wired. `/` is the authenticated home: without a session it redirects to `/auth`.
 */

describe("application shell", () => {
  it("boots and renders the shell landmarks for a signed-in player", () => {
    cy.login().then((session) => cy.visitAs(session, "/"));
    cy.location("pathname").should("eq", "/game/");
    cy.get("main#main").should("exist");
    cy.contains("a", "Skip to main content").should("exist");
  });

  it("serves the root route as the client-rendered app document", () => {
    // ADR-FE-003: `/` is declared `ssr: false`, so the server sends the SPA shell.
    cy.request("/")
      .its("body")
      .should("contain", 'lang="en"')
      .and("contain", '<div id="__nuxt"></div>');
  });

  it("has no detectable accessibility violation on the sign-in screen", () => {
    cy.visit("/auth");
    cy.contains("h1", "Sign in to access the game").should("be.visible");
    cy.injectAxe();
    cy.checkA11y();
  });
});
