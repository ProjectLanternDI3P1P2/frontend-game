[← README](README.md)

# Piste : récupérer des images déjà buildées

**Statut : non retenue (2026-11-24).** On builde depuis les sources, voir [stack.md](stack.md).

| Option                        | Pour                          | Contre                                                                                            |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Pull depuis Harbor            | Rien à builder                | `10.4.111.200` est une IP privée, injoignable depuis `ubuntu-latest`                              |
| Runner self-hosted sur le LAN | Pull rapide depuis Harbor     | Une machine à maintenir. Teste les images de `main`, pas la tête de `dev`                         |
| Publier aussi sur GHCR        | Pull rapide, runners hébergés | Il faut modifier les 4 `cd.yaml`. Images publiées seulement sur `main` et les tags, pas sur `dev` |

**Verdict** : le build depuis les sources ne demande ni secret ni infra, et teste exactement
`dev`.

**À revoir si** le build des 4 services dépasse le temps du reste du job E2E, ou si les backends
publient déjà des images `dev` sur un registry public.
