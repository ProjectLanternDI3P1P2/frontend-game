const isSafeRedirect = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

const requiresAuthentication = (path: string) =>
  path === "/" ||
  path === "/home" ||
  path === "/dungeon" ||
  path.startsWith("/dungeon/") ||
  path.startsWith("/players/");

/**
 * Gameplay routes are client-only protected because Keycloak's browser session
 * is initialized by the client plugin. The requested path is preserved so the
 * user returns to the intended screen after the Keycloak flow.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) {
    return;
  }

  const authenticated = useNuxtApp().$keycloak.authenticated === true;

  if (to.path === "/auth") {
    if (authenticated) {
      return navigateTo(
        isSafeRedirect(to.query.redirect) ? to.query.redirect : "/home",
      );
    }

    return;
  }

  if (requiresAuthentication(to.path) && !authenticated) {
    return navigateTo({
      path: "/auth",
      query: { redirect: to.fullPath },
    });
  }
});
