# Container application logs

Nuxt 4.5.2 / Nitro 2.13.4 runs a Node server. The Nitro plugin
`server/plugins/error-log.ts` (hook `error`) writes server request failures to
stderr as one JSON object per event: unhandled errors, fatal errors and statuses
of 500 and above. Expected client errors, such as a 404 « Player not found », are
not logged. The HTTP response itself is left to Nuxt's own error handler, which
renders `app/error.vue` for page requests (there is no `nitro.errorHandler`: a
custom one would stop Nuxt from rendering the error page on the server). The
accepted cost: for unhandled or fatal errors, Nitro also prints its plain-text
`[request error]` line next to the JSON one. The browser telemetry reporter posts to the
same-origin `/game/api/telemetry` route. The Nitro route validates at most 16 KiB and 20
events per request, then logs accepted events; it never forwards the browser to
Loki. The client-supplied message, stack, app name, timestamp, and unknown
properties are ignored. Browser errors and server exceptions have different
`origin` values.

| Field        | Meaning                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| `timestamp`  | Server ISO 8601 time with `+00:00` offset                                     |
| `level`      | `debug`, `information`, `warning`, `error`, or `fatal`                        |
| `service`    | `frontend-game`                                                               |
| `origin`     | `server` for Nitro failures, `browser` for relayed signals                    |
| `message`    | Fixed browser event description or sanitized server description               |
| `properties` | Safe route and browser event type, name, value, rating, version as applicable |
| `exception`  | Server errors only: `type`, sanitized `message`, optional sanitized `stack`   |

Routes are restricted to known first segments and collapsed to that segment
when deeper paths might contain user data. The browser sends the Nuxt route
pattern, not the URL (for example `/profiles/:ref()`), so the server accepts the
characters `a-z A-Z 0-9 _ / * : . ( ) -` and logs `/profiles`. One invalid event
rejects the whole batch with 400: a route pattern rejected here silently drops
every Web Vital of that page. Browser event names, ratings, values,
and versions have allowlists or bounds. No token, cookie, personal identifier,
raw payload, client message, or client stack is logged.

No `NUXT_PUBLIC_TELEMETRY_ENDPOINT` variable is needed: telemetry is enabled
by the code's same-origin route. Ops should keep the existing ingress forwarding
`/game/api/telemetry` to this frontend's Node server and collect its stdout/stderr. Nitro's
own startup announcement is a plain-text framework line; the application events
above use JSON lines.
