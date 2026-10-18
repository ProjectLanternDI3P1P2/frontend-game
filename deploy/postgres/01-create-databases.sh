#!/bin/sh
# Sourced by the official Postgres entrypoint on the first initialization only.
set -eu

for service in player combat dungeon reward leaderboard; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    --set=service="$service" --set=password="$SERVICE_DB_PASSWORD" <<'SQL'
CREATE ROLE :"service" WITH LOGIN PASSWORD :'password';
CREATE DATABASE :"service" OWNER :"service";
REVOKE ALL ON DATABASE :"service" FROM PUBLIC;
SQL
done
