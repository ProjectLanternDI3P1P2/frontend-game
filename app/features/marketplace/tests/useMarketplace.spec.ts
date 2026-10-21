import { effectScope } from "vue";
import { describe, expect, it, vi } from "vitest";
import { createMarketplaceApi } from "../api/marketplaceApi";
import { useMarketplace } from "../composables/useMarketplace";
import type { ActiveMarketplaceListing } from "../types";
import { createGatewayClient } from "~/shared/utils/gateway";

const listing: ActiveMarketplaceListing = {
  id: "listing-1",
  itemInstanceId: "item-1",
  itemName: "Iron sword",
  category: "Weapon",
  rarity: "Common",
  quantity: 1,
  price: 42,
  sellerId: "seller-1",
};

function setup(listActiveListings = vi.fn().mockResolvedValue([listing])) {
  const scope = effectScope();
  const marketplace = scope.run(() => useMarketplace({ listActiveListings }))!;
  return { marketplace, scope, listActiveListings };
}

describe("Marketplace", () => {
  it("only reads the active-listings endpoint without caching", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([listing])));
    const gateway = createGatewayClient({
      baseUrl: "https://gateway.test",
      apiVersion: "v1",
      fetchImpl: fetcher,
    });
    const signal = new AbortController().signal;

    expect(await createMarketplaceApi(gateway).listActiveListings(signal)).toEqual([
      listing,
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://gateway.test/api/v1/marketplace/listings",
      expect.objectContaining({ method: "GET", signal, cache: "no-store" }),
    );
  });

  it("loads lazily and reloads on every opening, clearing previous listings", async () => {
    const { marketplace, scope, listActiveListings } = setup();
    expect(listActiveListings).not.toHaveBeenCalled();
    marketplace.open();
    expect(marketplace.status.value).toBe("loading");
    await vi.waitFor(() => expect(marketplace.listings.value).toEqual([listing]));
    marketplace.close();
    listActiveListings.mockResolvedValue([]);
    marketplace.open();
    expect(marketplace.listings.value).toEqual([]);
    await vi.waitFor(() => expect(marketplace.status.value).toBe("ready"));
    expect(marketplace.listings.value).toEqual([]);
    expect(listActiveListings).toHaveBeenCalledTimes(2);
    scope.stop();
  });

  it("shows a retryable error without retaining old listings", async () => {
    const { marketplace, scope, listActiveListings } = setup();
    marketplace.open();
    await vi.waitFor(() => expect(marketplace.status.value).toBe("ready"));
    listActiveListings.mockRejectedValueOnce(new Error("Offline"));
    await marketplace.refresh();
    expect(marketplace.status.value).toBe("error");
    expect(marketplace.listings.value).toEqual([]);
    await marketplace.refresh();
    expect(marketplace.listings.value).toEqual([listing]);
    scope.stop();
  });

  it("ignores late responses after closing and cancels on disposal", async () => {
    let resolveRequest!: (value: ActiveMarketplaceListing[]) => void;
    const listActiveListings = vi.fn().mockImplementation(
      () =>
        new Promise<ActiveMarketplaceListing[]>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { marketplace, scope } = setup(listActiveListings);
    marketplace.open();
    const signal = listActiveListings.mock.calls[0]![0] as AbortSignal;
    marketplace.close();
    resolveRequest([listing]);
    await Promise.resolve();
    expect(signal.aborted).toBe(true);
    expect(marketplace.listings.value).toEqual([]);
    expect(marketplace.status.value).toBe("idle");
    marketplace.open();
    const nextSignal = listActiveListings.mock.calls[1]![0] as AbortSignal;
    scope.stop();
    expect(nextSignal.aborted).toBe(true);
  });
});
