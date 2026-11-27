import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PublicProfileView from "../components/PublicProfileView.vue";
import {
  LOADING_PUBLIC_PROFILE,
  PUBLIC_PROFILE_ERROR,
  PublicProfileStatus,
  type PublicProfileState,
} from "../composables/usePublicProfile";
import type { PublicProfile } from "../types";
import { publicProfileFixture } from "./fixtures/publicProfileFixtures";

function ready(profile = publicProfileFixture()): PublicProfileState {
  return { status: PublicProfileStatus.READY, profile, errorMessage: "" };
}

function render(state: PublicProfileState, refreshing = false) {
  return mount(PublicProfileView, {
    props: { state, refreshing },
    global: { stubs: { UiIconButton: true } },
  });
}

describe("PublicProfileView", () => {
  it("shows the display name as the only h1, with the public handle", () => {
    const wrapper = render(ready());

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.get("h1").text()).toBe("Maelis Rune");
    expect(wrapper.get(".public-profile__handle").text()).toBe("@maelisrune-00000000");
  });

  it("shows the NG+ level and the three public counters", () => {
    const wrapper = render(ready());

    expect(
      wrapper
        .findAll(".ui-stat")
        .map((stat) => [
          stat.get(".ui-stat__label").text(),
          stat.get(".ui-stat__value").text(),
        ]),
    ).toEqual([
      ["New Game+ level", "2"],
      ["Heroes", "2"],
      ["Highest hero level", "12"],
      ["Completed sessions", "0"],
    ]);
  });

  it("lists the heroes in the order received, with name, class and level", () => {
    const wrapper = render(ready());
    const list = wrapper.get(".public-profile__heroes");
    const items = list.findAll("li");

    expect(list.attributes("role")).toBe("list");
    expect(items.map((item) => item.get("h3").text())).toEqual(["Aldric", "Sylwen"]);
    expect(items[0]!.text()).toContain("Warrior");
    expect(items[0]!.text()).toContain("Level 12");
    expect(items[1]!.text()).toContain("Mage");
    expect(items[1]!.text()).toContain("Level 9");
  });

  it("shows an explicit empty state when the player has no hero", () => {
    const wrapper = render(
      ready(
        publicProfileFixture({
          heroes: [],
          counters: { heroCount: 0, highestHeroLevel: 0, completedSessionCount: 0 },
        }),
      ),
    );

    expect(wrapper.get(".public-profile__empty").text()).toBe(
      "This player has no hero yet.",
    );
    expect(wrapper.find(".public-profile__heroes").exists()).toBe(false);
  });

  it("never renders an e-mail, even when the object carries one", () => {
    const profile = {
      ...publicProfileFixture(),
      email: "maelis@example.test",
    } as PublicProfile;
    const wrapper = render(ready(profile));

    expect(wrapper.html()).not.toContain("maelis@example.test");
  });

  it("shows the error with Retry, which is emitted", async () => {
    const wrapper = render({
      status: PublicProfileStatus.ERROR,
      profile: null,
      errorMessage: PUBLIC_PROFILE_ERROR,
    });

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("The profile could not be loaded");
    expect(alert.text()).toContain(PUBLIC_PROFILE_ERROR);
    expect(wrapper.get("h1").text()).toBe("Player profile");

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Retry")!
      .trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });

  it("announces loading, then a refresh", async () => {
    const loading = render(LOADING_PUBLIC_PROFILE as PublicProfileState);
    expect(loading.get('[aria-live="polite"]').text()).toBe("Loading profile…");

    const refreshing = render(
      {
        status: PublicProfileStatus.ERROR,
        profile: null,
        errorMessage: PUBLIC_PROFILE_ERROR,
      },
      true,
    );
    expect(refreshing.get('[aria-live="polite"]').text()).toBe("Refreshing profile…");
  });

  it("marks every list with role=list", () => {
    const wrapper = render(ready());

    expect(wrapper.findAll('ul[role="list"]')).toHaveLength(2);
  });
});
