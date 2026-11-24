export async function restoreKeycloakSession(
  initialize: () => Promise<boolean>,
  clearPersistedTokens: () => void,
): Promise<boolean> {
  try {
    return await initialize();
  } catch {
    clearPersistedTokens();
    return false;
  }
}
