/** The hero roster, creation form and hero sheet, against the real Player service. */
import { heroName } from "../support/heroName";

const preview = () => cy.get('aside[aria-label="Hero preview"]');

describe("heroes", () => {
  beforeEach(() => cy.login());

  it("shows an empty roster to a new player", () => {
    cy.visitSignedIn("/players/me/heroes");
    cy.contains("h2", "No heroes yet").should("be.visible");
    cy.contains("strong", "0/10").should("be.visible");
  });

  it("rejects a hero name that is too short", () => {
    cy.visitSignedIn("/players/me/heroes/new");
    cy.get("#hero-name").type("Al").blur();
    cy.get("#hero-name").should("have.attr", "aria-invalid", "true");
    cy.get("#hero-name-description").should("contain", "Hero name must contain");
  });

  it("previews the name as it is typed", () => {
    const name = heroName();
    cy.visitSignedIn("/players/me/heroes/new");
    preview().find("h2").should("have.text", "Choose a name");
    cy.get("#hero-name").type(name);
    preview().find("h2").should("have.text", name);
  });

  it("keeps Confirm disabled until a class is chosen", () => {
    cy.visitSignedIn("/players/me/heroes/new");
    cy.get("#hero-name").type(heroName());
    preview().contains("button", "Confirm").should("be.disabled");
    cy.contains('[role="radio"] strong', "Warrior").click();
    cy.contains('[role="radio"]', "Chosen").should("contain", "Warrior");
    preview().contains("button", "Confirm").should("be.enabled");
  });

  it("creates a hero from the form", () => {
    const name = heroName();
    cy.visitSignedIn("/players/me/heroes/new");
    cy.get("#hero-name").type(name);
    cy.contains('[role="radio"] strong', "Mage").click();
    preview().contains("button", "Confirm").click();
    cy.contains("h1", `${name} has joined your heroes`).should("be.visible");
    cy.contains("1 of 10 heroes").should("be.visible");
  });

  it("lists a hero in the roster", () => {
    cy.createHero().then(({ name }) => {
      cy.visitSignedIn("/players/me/heroes");
      cy.get(`a[aria-label="View ${name}'s hero sheet"]`).should("be.visible");
    });
    cy.contains("strong", "1/10").should("be.visible");
  });

  it("selects a hero from its sheet", () => {
    cy.createHero().then(({ id }) => cy.visitSignedIn(`/players/me/heroes/${id}`));
    cy.get('button[aria-label="Select this hero"]').click();
    cy.get('button[aria-label="Deselect this hero"]').should(
      "contain",
      "Hero selected",
    );
  });

  it("deletes a hero once its name is typed", () => {
    cy.createHero().then(({ id, name }) => {
      cy.visitSignedIn(`/players/me/heroes/${id}`);
      cy.contains("button", "Delete this hero").click();
      cy.get("dialog").within(() => {
        cy.contains("button", "Delete permanently").should("be.disabled");
        cy.get("#hero-deletion-name").type(name);
        cy.contains("button", "Delete permanently").should("be.enabled").click();
      });
    });
    cy.location("pathname").should("eq", "/game/players/me/heroes");
    cy.contains("h2", "No heroes yet").should("be.visible");
  });
});
