/**
 * ADR-FE-011 — The public site makes only a small number of API calls, so it
 * owns a minimal hand-written client rather than a generated or shared one.
 * No access token is involved: every route consumed here is public.
 */
import { createGatewayClient, type GatewayClient } from "~/shared/utils/gateway";

let redirectingToAuthentication = false;

export function useGateway(): GatewayClient {
  const config = useRuntimeConfig();
  const router = useRouter();
  return createGatewayClient({
    baseUrl: config.public.apiGatewayUrl,
    apiVersion: config.public.apiVersion,
    getToken: () =>
      import.meta.client ? (useNuxtApp().$keycloak.token ?? null) : null,
    onUnauthorized: async (afterRefreshRetry) => {
      if (!import.meta.client || redirectingToAuthentication) return false;

      const keycloak = useNuxtApp().$keycloak;
      if (!afterRefreshRetry) {
        try {
          await keycloak.updateToken(-1);
          return true;
        } catch {
          // A failed refresh means the Keycloak session is no longer usable.
        }
      }

      redirectingToAuthentication = true;
      const redirect = router.currentRoute.value.fullPath;
      keycloak.clearToken();
      localStorage.removeItem("lantern.keycloak.tokens");
      await router.replace({ path: "/auth", query: { redirect } });
      return false;
    },
  });
}
