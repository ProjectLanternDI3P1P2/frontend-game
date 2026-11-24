/// <reference types="cypress" />

/** A Keycloak session obtained by `cy.login()` for a freshly created user. */
export interface KeycloakSession {
  token: string;
  refreshToken: string;
  idToken: string;
  username: string;
}

declare global {
  namespace Cypress {
    interface Chainable {
      /** Select elements by their `data-cy` attribute. */
      getByCy(name: string): Chainable<JQuery<HTMLElement>>;

      /**
       * Create a unique user in realm `lantern` through the Keycloak admin API, then
       * sign it in with a password grant on `lantern-public`.
       */
      login(): Chainable<KeycloakSession>;

      /**
       * Visit an app route (relative to `baseUrl`, which already holds `/game`) with the
       * session restored from sessionStorage, as `plugins/keycloak.client.ts` reads it.
       */
      visitAs(session: KeycloakSession, path: string): Chainable<AUTWindow>;

      /** Call the Gateway (`gatewayUrl` + path) with the session's bearer token. */
      apiAs<T = unknown>(
        session: KeycloakSession,
        method: HttpMethod,
        path: string,
        body?: RequestBody,
      ): Chainable<Response<T>>;
    }
  }
}
