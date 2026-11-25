/**
 * ADR-FE-012 — Critical path of a solo run, against the real Gateway, PlayerHub and
 * DungeonHub: a fresh player with one selected hero creates a lobby, starts the
 * game and lands in the dungeon.
 */
const heroesPath = "/api/player/v1/me/heroes";

// Player accepts letters, spaces, hyphens and apostrophes only: no digits in the name.
const letters = (count: number) =>
  Array.from({ length: count }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join("");

describe("solo run", () => {
  it("creates a lobby, starts the game and enters the dungeon", () => {
    const heroName = `Eto ${letters(8)}`;

    cy.login();
    cy.api<{ id: string }>("POST", heroesPath, {
      name: heroName,
      classCode: "warrior",
      idempotencyKey: crypto.randomUUID(),
    })
      // A new hero is not selected: the play screen needs one to enable the lobby.
      .then(({ body }) => cy.api("PUT", `${heroesPath}/${body.id}/selection`));
    cy.visitSignedIn("/players/play");

    cy.contains("h2", heroName).should("be.visible");
    cy.getByCy("create-lobby").should("be.enabled").click();

    cy.location("pathname").should(
      "match",
      /^\/game\/players\/[^/]+\/play\/lobbies\/[^/]+$/,
    );
    cy.getByCy("start-game").should("be.enabled").click();

    cy.location("pathname").should("match", /^\/game\/dungeon\/[^/]+$/);
    cy.getByCy("dungeon-view")
      .should("be.visible")
      .and("have.attr", "role", "application")
      .and("have.attr", "aria-label", "Dungeon");
  });
});
