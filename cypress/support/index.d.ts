/// <reference types="cypress" />

/** A Keycloak session obtained by `cy.login()` for a freshly created user. */
export interface KeycloakSession {
  token: string;
  refreshToken: string;
  idToken: string;
}

/** A hero created through the Player API by `cy.createHero()`. */
export interface CreatedHero {
  id: string;
  name: string;
}

declare global {
  namespace Cypress {
    interface Chainable {
      /** Select elements by their `data-cy` attribute. */
      getByCy(name: string): Chainable<JQuery<HTMLElement>>;

      /**
       * Create a unique user in realm `lantern` through the Keycloak admin API, then
       * sign it in with a password grant on `lantern-public`. The session is kept for
       * the rest of the test, for `visitSignedIn` and `api`.
       */
      login(): Chainable<void>;

      /**
       * Visit an app route (relative to `baseUrl`, which already holds `/game`) with the
       * `cy.login()` session restored from sessionStorage, as `plugins/keycloak.client.ts`
       * reads it.
       */
      visitSignedIn(path: string): Chainable<AUTWindow>;

      /** Call the Gateway (`gatewayUrl` + path) with the `cy.login()` bearer token. */
      api<T = unknown>(
        method: HttpMethod,
        path: string,
        body?: RequestBody,
      ): Chainable<Response<T>>;

      /** Create a warrior for the `cy.login()` player, selected when `select` is set. */
      createHero(options?: { select?: boolean }): Chainable<CreatedHero>;
    }
  }
}
