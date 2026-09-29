/**
 * ADR-FE-011 — The public site makes only a small number of API calls, so it
 * owns a minimal hand-written client rather than a generated or shared one.
 * No access token is involved: every route consumed here is public.
 */
import { createGatewayClient, type GatewayClient } from "~/shared/utils/gateway";

export function useGateway(): GatewayClient {
  const config = useRuntimeConfig();
  return createGatewayClient({
    baseUrl: config.public.apiGatewayUrl,
    apiVersion: config.public.apiVersion,
  });
}
