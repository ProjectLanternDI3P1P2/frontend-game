import { mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthLayout from "~/layouts/auth.vue";
import DefaultLayout from "~/layouts/default.vue";

const authenticated = vi.fn();
let currentPath = "/";

vi.mock("../composables/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: computed(() => authenticated()),
    user: computed(() => null),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("DefaultLayout authentication gate", () => {
  beforeEach(() => {
    authenticated.mockReturnValue(false);
    currentPath = "/";
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("useState", () => ref(false));
    vi.stubGlobal("useRuntimeConfig", () => ({ public: {} }));
    vi.stubGlobal("useRouter", () => ({ push: vi.fn() }));
    vi.stubGlobal("useRoute", () => ({ path: currentPath }));
  });

  it("keeps protected content mounted but hidden before authentication is known", () => {
    const wrapper = mount(DefaultLayout, {
      slots: { default: '<article data-testid="protected-page">Landing page</article>' },
      global: { stubs: { UiButton: true, UiTopNavigation: true } },
    });

    const protectedPage = wrapper.get('[data-testid="protected-page"]');

    expect(protectedPage.element.parentElement?.style.display).toBe("none");
    expect(wrapper.get('[data-testid="auth-loading"]').text()).toContain("Checking session");
  });

  it("uses a full-bleed layout for the authentication page", () => {
    currentPath = "/auth/";

    const wrapper = mount(AuthLayout, {
      global: { stubs: { UiButton: true, UiTopNavigation: true } },
    });

    expect(wrapper.get(".site-shell__main").classes()).toContain("site-shell__main--full-bleed");
  });
});
