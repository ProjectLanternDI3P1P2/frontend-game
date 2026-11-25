# Container application logs

Nuxt 4.5.2 / Nitro 2.13.4 runs a Node server. The Nitro error handler writes
server request failures to stderr as one JSON object per event and delegates the
HTTP response to Nitro silently. The browser telemetry reporter posts to the
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
when deeper paths might contain user data. Browser event names, ratings, values,
and versions have allowlists or bounds. No token, cookie, personal identifier,
raw payload, client message, or client stack is logged.

No `NUXT_PUBLIC_TELEMETRY_ENDPOINT` variable is needed: telemetry is enabled
by the code's same-origin route. Ops should keep the existing ingress forwarding
`/game/api/telemetry` to this frontend's Node server and collect its stdout/stderr. Nitro's
own startup announcement is a plain-text framework line; the application events
above use JSON lines.
