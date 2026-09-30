import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useToast, type Toast } from "../composables/useToast";

describe("useToast", () => {
  beforeEach(() => {
    vi.stubGlobal("useState", <T>(_key: string, initial: () => T) => ref(initial()));
    vi.stubGlobal("crypto", { randomUUID: () => "toast-id" });
  });

  it("adds typed notifications and lets callers dismiss them", () => {
    const { success, error, remove, toasts } = useToast();

    const id = success("Maëlle · Mage", { title: "Hero created", duration: 0 });
    error("Unable to select this hero.", { duration: 0 });

    expect(toasts.value).toEqual<Toast[]>([
      {
        id: "toast-id",
        message: "Maëlle · Mage",
        title: "Hero created",
        tone: "success",
      },
      {
        id: "toast-id",
        message: "Unable to select this hero.",
        title: undefined,
        tone: "danger",
      },
    ]);

    remove(id);

    expect(toasts.value).toHaveLength(0);
  });
});
