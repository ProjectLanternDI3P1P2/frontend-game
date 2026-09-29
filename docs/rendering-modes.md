# Rendering modes — public site

ADR-FE-003 requires that **every non-default route documents its rendering mode,
the reason for it, and the evidence that validates it.** This file is that
register. A route that is not listed below is statically generated.

The modes themselves are declared in `nuxt.config.ts` under `routeRules`; this
file explains them. If the two disagree, the code is the bug.

## The policy

**Static generation is the default.** It is cheap to serve, indexable, readable
before JavaScript runs, and it keeps working when the API Gateway does not.

**SSR is the exception**, and it has to be argued. The question is never "would
SSR be nicer here?" but "what changes between two requests that a build cannot
know?".

**CSR is never the default on this application.** It does not answer the SSR
requirement of the course, and it delays useful content until JavaScript has
loaded. The authenticated game client is the CSR application (ADR-FE-004); this
one is not.

## The two allowed SSR shapes

| Shape                   | Declaration                                       | When                                                                                                                                               |
| ----------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh-enough, indexable | `{ ssr: true, prerender: false, swr: <seconds> }` | The data changes while deployed, but a short shared cache window is acceptable. The window is what stops a traffic spike becoming a Gateway spike. |
| Never cached            | `{ ssr: true, prerender: false, cache: false }`   | A cached answer would be **wrong**, not merely stale — live availability, incident status.                                                         |

An SSR route without a stated caching strategy is not acceptable: ADR-FE-003
makes the caching strategy part of the decision, not an afterthought.

## Register of non-default routes

| Route        | Mode | Why not static | Why not CSR | Caching | How it is validated |
| ------------ | ---- | -------------- | ----------- | ------- | ------------------- |
| _(none yet)_ |      |                |             |         |                     |

`/demo` and its child routes intentionally follow the static default: their
component examples contain no request-specific data and remain usable when the
API Gateway is unavailable.

## Adding a route

1. Decide the mode. Static unless you can name the request-time concern in one
   sentence.
2. Declare it in `nuxt.config.ts` → `routeRules` (only if it is not the
   default).
3. If it is not static, add a row above. All six columns, including how you
   would notice if it silently drifted.
4. Add the assertion that proves it. For a static route, a `cy.request()` that
   finds the content in the raw HTML body is enough, and it fails loudly the day
   someone flips the route towards CSR.

Route ownership includes the rendering mode: the squad that owns the feature
owns this row (ADR-FE-003, ADR-FE-009).
