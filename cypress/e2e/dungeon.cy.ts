/** Starting a dungeon run from `/dungeon`, against the real Dungeon service. */
const SEED = "0KX4-M2T9-QZ7PA";

describe("dungeon", () => {
  beforeEach(() => cy.login());

  it("formats a seed as it is typed", () => {
    cy.visitSignedIn("/dungeon");
    cy.get("#dungeon-seed").type("0kx4m2t9qz7pa").should("have.value", SEED);
    cy.get("#dungeon-seed-hint").should("contain", "Ready to replay.");
    cy.contains("button", "Replay").should("be.enabled");
  });

  it("reads the letters O and I as digits", () => {
    cy.visitSignedIn("/dungeon");
    cy.get("#dungeon-seed").type("oi").should("have.value", "01");
  });

  it("refuses a seed that cannot exist", () => {
    cy.visitSignedIn("/dungeon");
    cy.get("#dungeon-seed").type("z");
    cy.get("#dungeon-seed-hint").should("contain", "A seed starts with");
    cy.contains("button", "Replay").should("be.disabled");
  });

  it("prefills the seed of a shared link", () => {
    cy.visitSignedIn("/dungeon?seed=0kx4m2t9qz7pa");
    cy.get("#dungeon-seed").should("have.value", SEED);
  });

  it("opens a new exploration", () => {
    cy.visitSignedIn("/dungeon");
    cy.contains("button", "New exploration").click();
    cy.getByCy("dungeon-view").should("be.visible");
  });

  it("replays a shared seed", () => {
    cy.visitSignedIn(`/dungeon?seed=${SEED}`);
    cy.contains("button", "Replay").click();
    cy.getByCy("dungeon-view").should("be.visible");
  });
});
