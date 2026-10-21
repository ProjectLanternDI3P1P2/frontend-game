import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import RankingRowDetail from "../components/RankingRowDetail.vue";

// F00 placeholder; F03 replaces the component and this test.
describe("RankingRowDetail (placeholder)", () => {
  it("takes the contract props and announces the detail to come", () => {
    const wrapper = mount(RankingRowDetail, {
      props: { heroId: "hero-1", currentPlayerId: "me" },
    });

    expect(wrapper.get("p").text()).toBe("Loading hero detail…");
    expect(wrapper.emitted()).toEqual({});
  });
});
