/**
 * ADR-FE-012 — Critical path of a solo run, against the real Gateway, PlayerHub and
 * DungeonHub: a fresh player with one selected hero creates a lobby, starts the
 * game and lands in the dungeon.
 */
describe("solo run", () => {
  it("creates a lobby, starts the game and enters the dungeon", () => {
    cy.login();
    cy.createHero({ select: true }).then(({ name }) => {
      cy.visitSignedIn("/players/play");
      cy.contains("h2", name).should("be.visible");
    });

    // Each data-cy lives on one page only: finding it proves the navigation.
    cy.getByCy("create-lobby").should("be.enabled").click();
    cy.getByCy("start-game").should("be.enabled").click();
    cy.getByCy("dungeon-view")
      .should("be.visible")
      .and("have.attr", "role", "application")
      .and("have.attr", "aria-label", "Dungeon");
  });
});
