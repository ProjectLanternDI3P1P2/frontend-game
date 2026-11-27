import type Keycloak from "keycloak-js";

declare module "#app" {
  interface NuxtApp {
    $keycloak: Keycloak;
  }
}

declare module "vue" {
  interface ComponentCustomProperties {
    $keycloak: Keycloak;
  }
}

export { };