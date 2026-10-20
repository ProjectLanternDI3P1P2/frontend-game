import { onScopeDispose, ref, shallowRef } from "vue";
import { useMarketplaceApi } from "../api/marketplaceApi";
import type { ActiveMarketplaceListing } from "../types";

export function useMarketplace(api = useMarketplaceApi()) {
  const isOpen = ref(false);
  const listings = shallowRef<ActiveMarketplaceListing[]>([]);
  const status = ref<"idle" | "loading" | "ready" | "error">("idle");
  let request: AbortController | undefined;

  async function refresh() {
    if (!isOpen.value) return;
    request?.abort();
    const current = new AbortController();
    request = current;
    listings.value = [];
    status.value = "loading";

    try {
      const result = await api.listActiveListings(current.signal);
      if (current.signal.aborted) return;
      listings.value = result;
      status.value = "ready";
    } catch {
      if (!current.signal.aborted) status.value = "error";
    }
  }

  function open() {
    if (isOpen.value) return;
    isOpen.value = true;
    void refresh();
  }

  function close() {
    request?.abort();
    isOpen.value = false;
    listings.value = [];
    status.value = "idle";
  }

  onScopeDispose(close);

  return { isOpen, listings, status, open, close, refresh };
}
