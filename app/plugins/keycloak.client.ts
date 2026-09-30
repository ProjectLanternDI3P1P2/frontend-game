import Keycloak from "keycloak-js";

export default defineNuxtPlugin(async () => {
    const config = useRuntimeConfig();

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

    await keycloak.init({
        pkceMethod: "S256",
        checkLoginIframe: false,
    });

    return {
        provide: {
            keycloak,
        },
    };
});