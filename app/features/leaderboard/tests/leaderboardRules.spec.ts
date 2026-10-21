import { describe, expect, it } from "vitest";
import { buildLeaderboardView, LEADERBOARD_LIMIT } from "../leaderboardRules";
import { entry, ME } from "./fixtures/leaderboardFixtures";

describe("buildLeaderboardView", () => {
  it("sorts by ascending rank and keeps at most 50 rows", () => {
    const entries = Array.from({ length: 60 }, (_, index) => entry(60 - index));

    const view = buildLeaderboardView({ entries, me: null }, ME);

    expect(LEADERBOARD_LIMIT).toBe(50);
    expect(view.rows).toHaveLength(50);
    expect(view.rows.map((row) => row.rank)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
  });

  it("flags my line in the top 50 and pins nothing", () => {
    const me = entry(3, ME);
    const view = buildLeaderboardView({ entries: [entry(1), entry(2), me], me }, ME);

    expect(view.rows.filter((row) => row.isMe)).toEqual([{ ...me, isMe: true }]);
    expect(view.me).toEqual({ ...me, isMe: true });
    expect(view.pinnedMe).toBeNull();
  });

  it("pins my line with my real rank when I am outside the top 50", () => {
    const me = entry(132, ME);
    const view = buildLeaderboardView(
      { entries: Array.from({ length: 50 }, (_, i) => entry(i + 1)), me },
      ME,
    );

    expect(view.rows.some((row) => row.isMe)).toBe(false);
    expect(view.pinnedMe).toEqual({ ...me, isMe: true });
  });

  it("pins me when my top-50 line was cut by the limit", () => {
    const me = entry(51, ME);
    const entries = Array.from({ length: 51 }, (_, i) =>
      entry(i + 1, i === 50 ? ME : undefined),
    );
    expect(buildLeaderboardView({ entries, me }, ME).pinnedMe?.rank).toBe(51);
  });

  it("handles an empty leaderboard", () => {
    expect(buildLeaderboardView({ entries: [], me: null }, ME)).toEqual({
      rows: [],
      me: null,
      pinnedMe: null,
    });
    expect(buildLeaderboardView(null, ME).rows).toEqual([]);
  });

  it("breaks rank ties by player name for a stable order", () => {
    const view = buildLeaderboardView(
      {
        entries: [
          { rank: 1, playerId: "b", playerName: "Zed", score: 5 },
          { rank: 1, playerId: "a", playerName: "Abe", score: 5 },
        ],
        me: null,
      },
      ME,
    );
    expect(view.rows.map((row) => row.playerName)).toEqual(["Abe", "Zed"]);
  });
});
