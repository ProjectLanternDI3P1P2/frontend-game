/**
 * ADR-FE-012 — Shared setup for every end-to-end spec.
 * ADR-FE-015 — `cy.injectAxe()` / `cy.checkA11y()` are the automated
 * accessibility check that is part of acceptance for the main journeys.
 *
 * Specs run against the real Gateway and Keycloak (docs/e2e/identite.md): each
 * test signs in a fresh user with `cy.login()`, so no state is shared. The
 * session is kept as an alias: `cy.visitSignedIn()` and `cy.api()` read it.
 */
import "cypress-axe";
import type { KeycloakSession } from "./index";

// Same defaults as compose.backend.yaml and scripts/e2e/config.py.
const KEYCLOAK_ADMIN = { username: "admin", password: "admin" };
const E2E_PASSWORD = "e2e-Password-1";
// Read by app/plugins/keycloak.client.ts to restore the session.
const TOKENS_STORAGE_KEY = "lantern.keycloak.tokens";
const SESSION_ALIAS = "session";

const keycloakUrl = () => Cypress.env("keycloakUrl") as string;

const passwordGrant = (realm: string, body: Record<string, string>) =>
  cy.request({
    method: "POST",
    url: `${keycloakUrl()}/realms/${realm}/protocol/openid-connect/token`,
    form: true,
    body: { grant_type: "password", ...body },
  });

Cypress.Commands.add("getByCy", (name: string) => cy.get(`[data-cy="${name}"]`));

Cypress.Commands.add("login", () => {
  const username = `e2e-${crypto.randomUUID()}`;

  passwordGrant("master", { client_id: "admin-cli", ...KEYCLOAK_ADMIN })
    .then(({ body }) =>
      cy.request({
        method: "POST",
        url: `${keycloakUrl()}/admin/realms/lantern/users`,
        headers: { Authorization: `Bearer ${body.access_token}` },
        body: {
          username,
          // The user profile requires these, otherwise the account is "not fully set up".
          email: `${username}@e2e.lantern.test`,
          firstName: "E2E",
          lastName: "Player",
          enabled: true,
          emailVerified: true,
          requiredActions: [],
          credentials: [{ type: "password", value: E2E_PASSWORD, temporary: false }],
        },
      }),
    )
    .then(() =>
      passwordGrant("lantern", {
        client_id: "lantern-public",
        scope: "openid",
        username,
        password: E2E_PASSWORD,
      }),
    )
    .then(({ body }) => {
      const session: KeycloakSession = {
        token: body.access_token,
        refreshToken: body.refresh_token,
        idToken: body.id_token,
      };
      // Aliases are cleared between tests: a session never leaks into the next one.
      cy.wrap(session, { log: false }).as(SESSION_ALIAS);
    });
});

const currentSession = () =>
  cy.get<KeycloakSession>(`@${SESSION_ALIAS}`, { log: false });

Cypress.Commands.add("visitSignedIn", (path: string) =>
  currentSession().then((session) =>
    cy.visit(path, {
      onBeforeLoad(win) {
        win.sessionStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(session));
      },
    }),
  ),
);

Cypress.Commands.add(
  "api",
  (method: Cypress.HttpMethod, path: string, body?: Cypress.RequestBody) =>
    currentSession().then((session) =>
      cy.request({
        method,
        url: `${Cypress.env("gatewayUrl")}${path}`,
        headers: { Authorization: `Bearer ${session.token}` },
        body,
      }),
    ),
);
