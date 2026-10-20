/**
 * ADR-FE-012 — The end-to-end harness, proven on the application shell.
 *
 * The standard public-web journeys belong to the squads that ship the routes.
 * This spec keeps the harness and the axe integration wired, and it asserts the
 * one thing that is true of every public route: it must be readable before
 * JavaScript runs (ADR-FE-003).
 */

describe("public shell", () => {
  it("boots and renders the shell landmarks", () => {
    cy.visit("/");
    cy.get("main#main").should("exist");
    cy.contains("a", "Skip to main content").should("exist");
  });

  it("serves the landing route as HTML before JavaScript runs", () => {
    // ADR-FE-003: if this fails, a route rule has drifted towards CSR.
    cy.request("/").its("body").should("contain", "Project Lantern");
  });

  it("has no detectable accessibility violation", () => {
    cy.visit("/");
    cy.injectAxe();
    cy.checkA11y();
  });
});
