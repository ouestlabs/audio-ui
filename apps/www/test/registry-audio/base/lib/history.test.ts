import { describe, expect, test } from "bun:test";
import {
  beginChange,
  canRedo,
  canUndo,
  emptyHistory,
  recordChange,
  redo,
  undo,
} from "@/registry-audio/bases/base/lib/history";

describe("undo", () => {
  test("has nothing to take back on a fresh history", () => {
    expect(undo(emptyHistory<string>(), "a")).toBeNull();
    expect(canUndo(emptyHistory<string>())).toBe(false);
  });

  test("takes back the last change and offers it to redo", () => {
    const step = undo(recordChange(emptyHistory<string>(), "a"), "b");
    expect(step?.present).toBe("a");
    expect(step?.history.future).toEqual(["b"]);
    expect(canRedo(step?.history ?? emptyHistory<string>())).toBe(true);
  });

  test("takes back two changes when run twice without a render between", () => {
    let history = recordChange(emptyHistory<string>(), "a");
    history = recordChange(history, "b");
    const first = undo(history, "c");
    const second = first && undo(first.history, first.present);
    expect(first?.present).toBe("b");
    expect(second?.present).toBe("a");
    expect(second?.history.future).toEqual(["c", "b"]);
  });

  test("a burst is one entry, and undo reaches it before it settles", () => {
    const settled = recordChange(emptyHistory<string>(), "a");
    const dragging = beginChange(beginChange(settled, "b"), "b-mid");
    const step = undo(dragging, "b-end");
    expect(step?.present).toBe("b");
    expect(step?.history.past).toEqual(["a"]);
  });
});

describe("redo", () => {
  test("puts back what undo took, then runs out", () => {
    const history = recordChange(emptyHistory<string>(), "a");
    const back = undo(history, "b");
    const forward = back && redo(back.history, back.present);
    expect(forward?.present).toBe("b");
    expect(forward && redo(forward.history, forward.present)).toBeNull();
  });

  test("a new change drops the branch redo was holding", () => {
    const back = undo(recordChange(emptyHistory<string>(), "a"), "b");
    const changed = recordChange(back?.history ?? emptyHistory<string>(), "a");
    expect(canRedo(changed)).toBe(false);
  });
});

describe("limit", () => {
  test("keeps the newest entries", () => {
    let history = emptyHistory<number>();
    for (const index of [0, 1, 2, 3, 4]) {
      history = recordChange(history, index, 3);
    }
    expect(history.past).toEqual([2, 3, 4]);
  });
});
