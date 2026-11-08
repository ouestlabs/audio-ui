import { describe, expect, test } from "bun:test";
import {
  DOCS_MENU_UPDATES,
  PATTERNS_MENU_UPDATES,
  shownMarks,
} from "@/lib/docs/menu/menu-updates";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

describe("the marks of the navigation", () => {
  const updates = {
    fresh: { mark: "New", on: "2026-11-01" },
    gone: { mark: "Updated", on: "2026-09-30" },
    last: { mark: "Updated", on: "2026-10-08" },
  } as const;

  test("a mark shows for 30 days after its day, then goes", () => {
    expect(shownMarks(updates, new Date("2026-11-07T12:00:00Z"))).toEqual([
      ["fresh", "New"],
      ["last", "Updated"],
    ]);
    expect(shownMarks(updates, new Date("2026-12-02T12:00:00Z"))).toEqual([]);
  });

  test("every entry has a day", () => {
    for (const { on } of [
      ...Object.values(DOCS_MENU_UPDATES),
      ...Object.values(PATTERNS_MENU_UPDATES),
    ]) {
      expect(on).toMatch(DAY);
      expect(Number.isNaN(Date.parse(on))).toBe(false);
    }
  });
});
