# Keycloak — Local setup and Lantern theme

Keycloak is part of the local Docker Compose stack. It imports the Lantern
realm and mounts the custom Lantern login theme automatically; no manual realm
import, `docker cp`, or container restart is needed for the normal workflow.

## Start with Docker Compose

From `frontend-game`, start either the complete stack or the backend-only
variant:

```sh
docker compose --env-file .env.compose up -d --build --wait --wait-timeout 240
# or
docker compose --env-file .env.compose -f compose.backend.yaml up -d --build --wait --wait-timeout 240
```

If `.env.compose` does not exist, copy `.env.compose.example` first. Its
defaults are intended only for local development.

Keycloak is available at [http://localhost:8081](http://localhost:8081):

- Admin Console: [http://localhost:8081/admin/](http://localhost:8081/admin/)
- Realm: `lantern`
- Local administrator: `admin` / `admin` by default; configure
  `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD` in `.env.compose` to change
  this before exposing the stack.
- Demo player: `demo` / `demo`

The Game frontend waits for Keycloak's healthcheck and is built with
`NUXT_PUBLIC_KEYCLOAK_URL=http://localhost:8081`. The realm defines the public
client `lantern-public`, its redirect URI for `http://localhost:3000`, and the
demo player account.

## Run Nuxt outside Docker

`compose.backend.yaml` also starts Keycloak. When the Game frontend is run with
`npm run dev` on the host, retain the following settings in `.env`:

```dotenv
NUXT_PUBLIC_KEYCLOAK_URL=http://localhost:8081
NUXT_PUBLIC_KEYCLOAK_REALM=lantern
NUXT_PUBLIC_KEYCLOAK_CLIENT_ID=lantern-public
```

## Update the Lantern theme

The theme directory is bind-mounted into the Keycloak container. After editing
the SCSS source, rebuild the generated CSS:

```sh
npx sass keycloak/themes/lantern/login/resources/css/lantern.scss keycloak/themes/lantern/login/resources/css/lantern.css
```

Refresh the login page afterwards. If Keycloak has cached a template during a
development session, restart only that service:

```sh
docker compose --env-file .env.compose restart keycloak
```

## Realm changes

Edit `keycloak/realm/lantern-realm.json` for versioned local defaults. The
`start-dev --import-realm` command imports it whenever a new Keycloak container
starts; changes are therefore picked up by recreating the service:

```sh
docker compose --env-file .env.compose up -d --force-recreate keycloak
```

The local development server intentionally uses Keycloak's development mode.
Do not reuse its default administrator credentials or this configuration in a
shared or production environment.
