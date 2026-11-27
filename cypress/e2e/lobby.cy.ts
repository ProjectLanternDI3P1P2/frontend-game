/** "Join a game" and the solo lobby, against the real Player service and PlayerHub. */
describe("lobby", () => {
  beforeEach(() => cy.login());

  it("asks for a hero before creating a lobby", () => {
    cy.createHero();
    cy.visitSignedIn("/players/play");
    cy.contains("h2", "No hero selected").should("be.visible");
    cy.getByCy("create-lobby").should("be.disabled");
  });

  it("selects a hero from the hero picker", () => {
    cy.createHero().then(({ name }) => {
      cy.visitSignedIn("/players/play");
      cy.contains("button", "Choose a hero").click();
      cy.get("dialog").contains("button", name).click();
      cy.contains("h2", name).should("be.visible");
    });
    cy.getByCy("create-lobby").should("be.enabled");
  });

  it("blocks the lobby on a replay seed that cannot exist", () => {
    cy.createHero({ select: true });
    cy.visitSignedIn("/players/play");
    cy.get("#dungeon-seed").type("z");
    cy.get("#dungeon-seed-hint").should("contain", "A seed starts with");
    cy.getByCy("create-lobby").should("be.disabled");
  });

  it("counts the characters a replay seed still lacks", () => {
    cy.createHero({ select: true });
    cy.visitSignedIn("/players/play");
    cy.get("#dungeon-seed").type("0KX4");
    cy.get("#dungeon-seed-hint").should("contain", "9 more characters.");
  });

  it("opens a solo lobby led by the selected hero", () => {
    cy.createHero({ select: true }).then(({ name }) => {
      cy.visitSignedIn("/players/play");
      cy.getByCy("create-lobby").should("be.enabled").click();
      cy.contains("h1", `${name}’s game`).should("be.visible");
    });
    cy.contains("h2", "1 / 1 player").should("be.visible");
    cy.contains("Lobby creator").should("be.visible");
  });

  it("goes back to Join a game from the lobby", () => {
    cy.createHero({ select: true });
    cy.visitSignedIn("/players/play");
    cy.getByCy("create-lobby").should("be.enabled").click();
    cy.getByCy("start-game").should("be.visible");
    cy.contains("a", "Join a game").click();
    cy.contains("h1", "Join a game").should("be.visible");
  });
});
