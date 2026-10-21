const callbackParameterNames = [
  "code",
  "state",
  "session_state",
  "iss",
  "error",
  "error_description",
  "error_uri",
] as const;

export function withoutKeycloakCallbackFragment(url: URL): string | null {
  const parameters = new URLSearchParams(url.hash.slice(1));
  if (!parameters.has("code") || !parameters.has("state")) {
    return null;
  }

  for (const name of callbackParameterNames) {
    parameters.delete(name);
  }

  url.hash = parameters.toString();
  return url.toString();
}
