import type { AuthUser } from "../types";

export const useAuth = () => {
  const getKeycloak = () => {
    if (!import.meta.client) {
      return null;
    }

    return useNuxtApp().$keycloak;
  };

  const isAuthenticated = computed(() => {
    return getKeycloak()?.authenticated === true;
  });

  const user = computed<AuthUser | null>(() => {
    const token = getKeycloak()?.tokenParsed;

    if (!token?.sub) {
      return null;
    }

    return {
      id: token.sub,
      username: token.preferred_username ?? "",
      email: token.email ?? "",
      firstName: token.given_name ?? "",
      lastName: token.family_name ?? "",
    };
  });

  const login = async (redirectUri?: string) => {
    const keycloak = getKeycloak();

    if (!keycloak) {
      return;
    }

    await keycloak.login({
      redirectUri: redirectUri ?? window.location.origin,
    });
  };

  const register = async (redirectUri?: string) => {
    const keycloak = getKeycloak();

    if (!keycloak) {
      return;
    }

    await keycloak.register({
      redirectUri: redirectUri ?? window.location.origin,
    });
  };

  const logout = async () => {
    const keycloak = getKeycloak();

    if (!keycloak) {
      return;
    }

    await keycloak.logout({
      redirectUri: window.location.origin,
    });
  };

  return {
    isAuthenticated,
    user,
    login,
    register,
    logout,
  };
};
