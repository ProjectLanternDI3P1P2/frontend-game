import type { ServerResponse } from "node:http";
import { defineNitroErrorHandler } from "nitropack/runtime";
import { safeRoute, writeApplicationLog } from "./utils/application-log";

export default defineNitroErrorHandler(async (error, event, { defaultHandler }) => {
  const fatal = "fatal" in error && error.fatal === true;
  if (error.unhandled || fatal || error.statusCode >= 500) {
    const route = safeRoute(event.path);
    writeApplicationLog(
      fatal ? "fatal" : "error",
      "server",
      "Server request failed",
      route ? { route } : {},
      error,
    );
  }

  // Nitro keeps ownership of the HTTP error response; silent avoids its second,
  // text-formatted console entry for the same exception.
  const response = await defaultHandler(error, event, { silent: true });
  const nodeResponse = event.node?.res as ServerResponse | undefined;
  if (!nodeResponse) throw new Error("Node response unavailable");
  nodeResponse.writeHead(response.status, response.statusText, response.headers);
  nodeResponse.end(
    typeof response.body === "string" ? response.body : JSON.stringify(response.body),
  );
});
