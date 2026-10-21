import { useGateway } from "~/shared/composables/useGateway";
import type { GatewayClient } from "~/shared/utils/gateway";
import type { ActiveMarketplaceListing } from "../types";

export function createMarketplaceApi(gateway: GatewayClient) {
  return {
    listActiveListings(signal?: AbortSignal): Promise<ActiveMarketplaceListing[]> {
      return gateway.get<ActiveMarketplaceListing[]>("marketplace/listings", {
        signal,
        cache: "no-store",
      });
    },
  };
}

export function useMarketplaceApi() {
  return createMarketplaceApi(useGateway());
}
