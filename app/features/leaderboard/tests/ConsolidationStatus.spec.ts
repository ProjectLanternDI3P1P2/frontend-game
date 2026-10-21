import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ConsolidationStatus from "../components/ConsolidationStatus.vue";
import { formatConsolidationAge } from "../statisticsRules";

function mountStatus(consolidatedAt: string | null, isConsolidating = false) {
  return mount(ConsolidationStatus, {
    props: {
      consolidation: {
        consolidatedAt,
        label: formatConsolidationAge(consolidatedAt),
        isConsolidating,
      },
    },
  });
}

describe("ConsolidationStatus", () => {
  it("renders a machine-readable time for a valid date", () => {
    const wrapper = mountStatus("2026-10-21T11:57:00Z");
    expect(wrapper.get("time").attributes("datetime")).toBe("2026-10-21T11:57:00Z");
  });

  it("does not crash on an invalid date and reads as never consolidated", () => {
    const wrapper = mountStatus("not a date");
    expect(wrapper.find("time").exists()).toBe(false);
    expect(wrapper.text()).toContain("Not consolidated yet");
  });

  it("mentions a running consolidation as a status, not an alert", () => {
    const wrapper = mountStatus(null, true);
    expect(wrapper.find('[role="status"]').text()).toContain("being consolidated");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
