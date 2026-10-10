import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { installFrames } from "../../../test/helpers";
import { createFrameTask } from "./frame-task";

describe("createFrameTask", () => {
  let frames: ReturnType<typeof installFrames>;
  beforeEach(() => {
    frames = installFrames();
  });
  afterEach(() => {
    frames.restore();
  });

  test("sleeps until woken, then runs once per frame while the step asks for more", () => {
    let remaining = 2;
    let steps = 0;
    const task = createFrameTask(() => {
      steps += 1;
      remaining -= 1;
      return remaining > 0;
    });
    expect(frames.pendingCount()).toBe(0);

    task.wake();
    task.wake();
    expect(frames.pendingCount()).toBe(1);

    frames.fire(1000);
    expect(steps).toBe(1);
    expect(frames.pendingCount()).toBe(1);

    frames.fire(1016);
    expect(steps).toBe(2);
    expect(frames.pendingCount()).toBe(0);
  });

  test("passes the time since the previous step: zero after a sleep, capped at 100ms", () => {
    const elapsed: number[] = [];
    let more = true;
    const task = createFrameTask((ms) => {
      elapsed.push(ms);
      return more;
    });

    task.wake();
    frames.fire(1000);
    frames.fire(1016);
    frames.fire(5000);
    more = false;
    frames.fire(5016);
    expect(elapsed).toEqual([0, 16, 100, 16]);

    task.wake();
    frames.fire(9000);
    expect(elapsed.at(-1)).toBe(0);
  });

  test("flush runs a step now, in place of the pending frame", () => {
    let steps = 0;
    const task = createFrameTask(() => {
      steps += 1;
      return false;
    });
    task.wake();
    task.flush();
    expect(steps).toBe(1);
    expect(frames.pendingCount()).toBe(0);
  });

  test("a stopped task ignores wake and flush", () => {
    let steps = 0;
    const task = createFrameTask(() => {
      steps += 1;
      return true;
    });
    task.wake();
    task.stop();
    expect(frames.pendingCount()).toBe(0);
    task.wake();
    task.flush();
    expect(steps).toBe(0);
  });
});
