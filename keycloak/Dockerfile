# The production database remains the source of truth for realms, clients and
# users. This image only packages the Lantern login theme.
FROM quay.io/keycloak/keycloak:26.7.4

# Keycloak's unprivileged image user owns the theme and runs the server.
USER keycloak

COPY --chown=keycloak:keycloak themes/lantern /opt/keycloak/themes/lantern

RUN /opt/keycloak/bin/kc.sh build
