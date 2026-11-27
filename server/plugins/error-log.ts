import { defineNitroPlugin } from "nitropack/runtime";
import { safeRoute, writeApplicationLog } from "../utils/application-log";

/**
 * Server request failures as one JSON line each (docs/container-logging.md).
 * Only logs: the HTTP response is left to Nuxt's error handler, which renders
 * app/error.vue for page requests. Expected client errors (a 404 such as
 * « Player not found ») are not logged.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("error", (error, { event }) => {
    const details = error as Error & {
      statusCode?: number;
      fatal?: boolean;
      unhandled?: boolean;
    };
    const fatal = details.fatal === true;
    const statusCode = details.statusCode ?? 500;
    if (!details.unhandled && !fatal && statusCode < 500) return;
    const route = safeRoute(event?.path);
    writeApplicationLog(
      fatal ? "fatal" : "error",
      "server",
      "Server request failed",
      route ? { route } : {},
      error,
    );
  });
});
