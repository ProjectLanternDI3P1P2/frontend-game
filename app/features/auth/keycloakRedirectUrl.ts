export function keycloakRedirectUrl(
  location: Pick<Location, "origin">,
  baseURL: string,
  path: string,
): string {
  const applicationURL = new URL(baseURL, location.origin);
  const relativePath = path.replace(/^\/+/, "");

  return new URL(relativePath, applicationURL).toString();
}
