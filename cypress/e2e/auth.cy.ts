/** Route protection by `middleware/auth.global.ts`, against the real Keycloak. */
describe("authentication", () => {
  it("sends an anonymous visitor to the sign-in screen", () => {
    cy.visit("/players/me/heroes");
    cy.location("pathname").should("eq", "/game/auth");
    cy.url()
      .then((url) => new URL(url).searchParams.get("redirect"))
      .should("eq", "/players/me/heroes");
  });

  it("offers to sign in or to create an account", () => {
    cy.visit("/auth");
    cy.contains("button", "Sign in").should("be.enabled");
    cy.contains("button", "Create an account").should("be.enabled");
  });

  it("sends a signed-in player from the sign-in screen to the home", () => {
    cy.login();
    cy.visitSignedIn("/auth");
    cy.location("pathname").should("eq", "/game/home");
    cy.contains("h1", "Choose your hero").should("be.visible");
  });
});
