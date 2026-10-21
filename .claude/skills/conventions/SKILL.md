---
name: conventions
description: Conventions de ce projet (commandes, structure, règles de code et de tests). À lire avant de coder, tester ou relire.
---
# Git
- Branche principale : `dev` (base des worktrees et cible des merges). `main` = code publié, alimentée uniquement par PR de promotion depuis `dev` et par release-please.
- Branches : `feature/…`, `fix/…`, `chore/…`, `docs/…` depuis `dev`. Merge par merge commit uniquement (pas de squash/rebase merge).
- Commits : Conventional Commits `<type>(<scope>)!: <sujet>` (types `feat|fix|perf|refactor|revert|docs|test|chore|ci|build|style`), en-tête ≤ 100 caractères. Hooks husky : `commit-msg` (format), `pre-commit` (lint-staged : eslint --fix + prettier).
- Règles complètes : `docs/GIT_RULES.md`.
- Workflow d'agents : l'orchestrator et l'integrator committent sur leur branche à chaque étape validée ; jamais de push.

# Commandes
- Installer : `npm install` (Node ≥ 20.19 ; CI en Node 24) puis `cp .env.example .env`. Le `postinstall` lance `nuxt prepare` (génère `.nuxt/`, requis par ESLint et le typecheck).
- Lancer : `npm run dev` (http://localhost:3000). Stack complète : Docker Compose, voir `docs/local-stack.md`.
- Suite complète (une fois en fin de fiche, en parallèle) : `npm run lint`, `npm run typecheck`, `npm run test:unit`. E2E à part : `npm run build && node .output/server/index.mjs` puis `CYPRESS_BASE_URL=http://localhost:3000 npm run test:e2e` (non bloquant en CI).
- Tests ciblés (pendant les boucles) : `npx vitest run app/features/<feature>` ; si `app/shared` est touché, toujours aussi `npx vitest run app/shared`.
- Un seul fichier de test : `npx vitest run <chemin>.spec.ts` (`-t "<nom>"` pour un test) ; Cypress : `npx cypress run --spec cypress/e2e/<fichier>.cy.ts`.
- Lint et formatage : `npm run lint` / `npm run lint:fix`, `npm run format:check` / `npm run format` (oxlint en plus en CI).
- Vérification de types : `npm run typecheck` (`nuxt typecheck`, vue-tsc).

# Structure
- `app/features/<feature>/` : feature-first (ADR-FE-009) — `api/`, `components/`, `composables/`, `tests/`, `types.ts`, règles pures `*Rules.ts`, `utils/`, `README.md`. Modèle : `app/features/_template`.
- `app/shared/` : `ui/` (primitives `Ui*.vue`, seuls composants auto-importés), `composables/` (`useGateway`, `useToast`), `utils/` (`gateway.ts`, `idempotency.ts`, `telemetry.ts`), `api/signalRHubClient.ts`.
- `app/pages/` : routes qui assemblent les features. `app/layouts/` (`default`, `game`). `app/assets/styles/` (tokens, breakpoints, base). `server/routes/healthz.ts`.
- Pas de Pinia : état partagé via composables et utils de feature (ex. `player/utils/selectedHero.ts`).

# Règles de code
- TypeScript strict. Prettier : printWidth 88, guillemets doubles, trailingComma all.
- Clients HTTP manuels (ADR-FE-011) : types requête/réponse écrits à la main dans `types.ts` ; seul `api/` appelle le Gateway ; les composants reçoivent leurs données en props, jamais d'appel HTTP dedans.
- État (ADR-FE-008) : le backend est la source de vérité ; état d'UI local ; états explicites (chargement, vide, erreur) ; stockage navigateur uniquement pour préférences non sensibles.
- Rendu (ADR-FE-003) : toute nouvelle route déclare son mode dans `nuxt.config.ts` → `routeRules` et le justifie dans `docs/rendering-modes.md`. Statique par défaut ; SSR avec `swr` ou `cache: false` ; `/dungeon/**` en CSR.
- Styles (ADR-FE-010) : SCSS + BEM ; uniquement tokens sémantiques `--color-*` (jamais `--palette-*`), aucune couleur ni espacement en dur ; `@include bp.from('md')` ; listes avec `role="list"`.
- Rien dans `shared/` sans deux consommateurs réels.
- Accessibilité RGAA (ADR-FE-015, `docs/accessibility.md`) : un seul `h1` par page, landmarks, focus visible, `prefers-reduced-motion`, information jamais portée par la seule couleur.

# Règles de tests
- Framework : Vitest (happy-dom, globals, `@vue/test-utils`) ; Cypress + cypress-axe pour les parcours critiques.
- Emplacement et nommage : `app/**/tests/**/*.spec.ts` ; PascalCase pour un composant (`HeroDeletionModal.spec.ts`), camelCase pour logique/API (`playerApi.spec.ts`) ; fixtures dans `tests/fixtures/`. E2E : `cypress/e2e/**/*.cy.ts`.
- Fichier d'acceptation d'une fiche : `app/features/<feature>/tests/<Id>AcceptanceTest.spec.ts` (suffixe `.spec.ts` obligatoire), `describe("<Id>")` ; si un vrai navigateur est requis : `cypress/e2e/<Id>AcceptanceTest.cy.ts`.
- Chaque critère d'acceptation a au moins un test, rattaché à son identifiant (CA1, CA2…).

# Zones sensibles propres au projet
- Transport partagé : `app/shared/utils/gateway.ts`, `app/shared/api/signalRHubClient.ts`, `idempotency.ts`, `telemetry.ts`, `useGateway` (impact sur toutes les features).
- Config : `nuxt.config.ts` (`runtimeConfig` public `NUXT_PUBLIC_*` → jamais de secret, `routeRules`), `.env*.example`, Docker/Compose, `deploy/`.
- Styles globaux et layouts : `app/assets/styles/_tokens.scss`, `app/layouts/*`.
- CI et outillage : `.github/workflows/`, `.husky/`, release-please (`CHANGELOG.md` et version de `package.json` jamais modifiés à la main), `lighthouse-budget.json`.
- Auth : pas encore dans `dev` (branche `feature/keycloak-implementation` en cours).
