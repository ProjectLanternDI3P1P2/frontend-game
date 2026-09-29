/**
 * TEMPLATE — the feature's API boundary.
 *
 * ADR-FE-009 — This is the ONLY file in the feature allowed to reach the
 * Gateway. Components and pages never call it directly.
 * ADR-FE-011 — A small hand-written typed client over the versioned routes.
 */
import type { ExampleOutcome, ExampleResource } from "../types";
import { useGateway } from "~/shared/composables/useGateway";

/** Cache key for this resource. Namespace it so a prefix invalidation works. */
export const EXAMPLE_CACHE_KEY = "example";

/** GET /api/v1/example */
export function fetchExample(signal?: AbortSignal): Promise<ExampleResource[]> {
  return useGateway().get<ExampleResource[]>("example", { signal });
}

/** POST /api/v1/example/:id/act */
export function actOnExample(id: string): Promise<ExampleOutcome> {
  return useGateway().post<ExampleOutcome>(`example/${encodeURIComponent(id)}/act`);
}
