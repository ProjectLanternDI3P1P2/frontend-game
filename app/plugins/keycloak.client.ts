import Keycloak from "keycloak-js";
import { restoreKeycloakSession } from "~/features/auth/keycloakSession";

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();
  const storageKey = "lantern.keycloak.tokens";
  const tokens = readPersistedTokens(storageKey);

  const keycloak = new Keycloak({
    url: config.public.keycloakUrl,
    realm: config.public.keycloakRealm,
    clientId: config.public.keycloakClientId,
  });

  // await keycloak.init({
  //     onLoad: "check-sso",
  //     pkceMethod: "S256",
  //     checkLoginIframe: false,
  // });

  // Pbleme avec check-sso ; ca fait http//localhost:3000-> nuxt -> keycloak.init -> check-sso -> Est-ce que cet utilisateur est déjà connecté à Keycloak ?

  await restoreKeycloakSession(
    () =>
      keycloak.init({
        pkceMethod: "S256",
        checkLoginIframe: false,
        token: tokens?.token,
        refreshToken: tokens?.refreshToken,
        idToken: tokens?.idToken,
      }),
    () => localStorage.removeItem(storageKey),
  );

  const persistTokens = () => {
    if (!keycloak.token || !keycloak.refreshToken) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        token: keycloak.token,
        refreshToken: keycloak.refreshToken,
        idToken: keycloak.idToken,
      }),
    );
  };
  keycloak.onAuthSuccess = persistTokens;
  keycloak.onAuthRefreshSuccess = persistTokens;
  keycloak.onAuthLogout = () => localStorage.removeItem(storageKey);
  keycloak.onTokenExpired = () => {
    void keycloak
      .updateToken(30)
      .then(persistTokens)
      .catch(() => localStorage.removeItem(storageKey));
  };
  if (keycloak.authenticated) persistTokens();

  return {
    provide: {
      keycloak,
    },
  };
});

type KeycloakTokens = { token?: string; refreshToken?: string; idToken?: string };

function readPersistedTokens(storageKey: string): KeycloakTokens | null {
  try {
    return JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    ) as KeycloakTokens | null;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}
