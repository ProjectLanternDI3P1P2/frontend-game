/**
 * US-PLAYER-06 — public profile in a real browser (ADR-FE-012, ADR-FE-015).
 *
 * The profile is read by the Nuxt server, so `cy.intercept` cannot stub it:
 * this journey needs the real Player service behind the Gateway, with its
 * development seed (handle `maelisrune-00000000`), and a Nuxt server whose
 * NUXT_PUBLIC_API_GATEWAY_URL is absolute (http://localhost:8088 with the
 * backend-only stack, docs/local-stack.md). With app.baseURL `/game/`, run it
 * with CYPRESS_BASE_URL=http://localhost:3000/game.
 */
const KNOWN_HANDLE = "maelisrune-00000000";
const UNKNOWN_HANDLE = "unknown-handle-xyz";

describe("US-PLAYER-06", () => {
  it("CA1: serves the profile in the server HTML, before JavaScript runs", () => {
    cy.request(`/profiles/${KNOWN_HANDLE}`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include("<h1");
      expect(response.body).to.include("public-profile__heroes");
    });
  });

  it("CA1: shows the profile with one heading and no accessibility violation", () => {
    cy.visit(`/profiles/${KNOWN_HANDLE}`);
    cy.get("h1").should("have.length", 1).and("be.visible");
    cy.injectAxe();
    cy.checkA11y();
  });

  it("CA3: an unknown player answers a real HTTP 404", () => {
    cy.request({
      url: `/profiles/${UNKNOWN_HANDLE}`,
      failOnStatusCode: false,
      headers: { accept: "text/html" },
    })
      .its("status")
      .should("eq", 404);
  });

  it("CA3: the 404 is an HTML « Player not found » page", () => {
    cy.request({
      url: `/profiles/${UNKNOWN_HANDLE}`,
      failOnStatusCode: false,
      headers: { accept: "text/html" },
    }).then((response) => {
      expect(response.status).to.eq(404);
      expect(response.headers["content-type"]).to.include("text/html");
      expect(response.body).to.include("Player not found");
    });
    cy.visit(`/profiles/${UNKNOWN_HANDLE}`, { failOnStatusCode: false });
    cy.get("h1").should("have.text", "Player not found");
    cy.injectAxe();
    cy.checkA11y();
  });
});
