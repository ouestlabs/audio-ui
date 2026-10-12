import { describe, expect, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { drag, lastCall, notesById, renderRoll } from "../helpers.tsx";

// The lane is 50px tall, from y 50 to 100. Note a is at full velocity, b at half.

describe("PianoRoll.VelocityLane", () => {
  test("is a group placed as a timeline lane", () => {
    const { view } = renderRoll();
    const lane = view.getByTestId("velocities");
    expect(lane.getAttribute("role")).toBe("group");
    expect(lane.style.getPropertyValue("--timeline-unit")).toBe(
      "calc(100% / 16)"
    );
  });
});

describe("PianoRoll.Velocity", () => {
  test("stands at the note's start, as tall as its velocity", () => {
    const { velocity } = renderRoll();
    const b = velocity("b");
    expect(b.style.getPropertyValue("--timeline-offset")).toBe("4");
    expect(b.style.getPropertyValue("--piano-roll-velocity")).toBe("0.5");
    expect(b.style.bottom).toBe("0px");
  });

  test("holds a slider named after the note", () => {
    const { velocity } = renderRoll();
    const input = velocity("b").querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("D4, 4 to 8");
    expect(input.value).toBe("0.5");
    expect(input.getAttribute("aria-valuetext")).toBe("50%");
  });

  test("follows the pointer up and down, committing once", () => {
    const { onValueCommitted, velocity } = renderRoll();
    drag(velocity("b"), [41, 75], [41, 65]);
    const [value, details] = lastCall(onValueCommitted);
    expect(notesById(value).b?.velocity).toBeCloseTo(0.7);
    expect(details).toMatchObject({ edit: "velocity", reason: "drag" });
  });

  test("moves the selection by the same amount, each within 0 to 1", () => {
    const { onValueCommitted, velocity } = renderRoll({
      defaultSelection: ["a", "b"],
    });
    drag(velocity("b"), [41, 75], [41, 60]);
    const moved = notesById(lastCall(onValueCommitted)[0]);
    expect(moved.a?.velocity).toBe(1);
    expect(moved.b?.velocity).toBeCloseTo(0.8);
  });

  test("toggles the note in the selection with Shift", () => {
    const { onSelectionChange, onValueChange, velocity } = renderRoll();
    drag(velocity("b"), [41, 75], [41, 60], { shiftKey: true });
    expect(lastCall(onSelectionChange)[0]).toEqual(["b"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("steps with the arrow keys and jumps with Home and End", () => {
    const { onValueCommitted, velocity } = renderRoll();
    const input = velocity("b").querySelector("input") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(notesById(lastCall(onValueCommitted)[0]).b?.velocity).toBeCloseTo(
      0.55
    );
    expect(lastCall(onValueCommitted)[1]).toMatchObject({
      edit: "velocity",
      reason: "keyboard",
    });
    fireEvent.keyDown(input, { key: "Home" });
    expect(notesById(lastCall(onValueCommitted)[0]).b?.velocity).toBe(0);
  });

  test("takes changes made through the input", () => {
    const { onValueCommitted, velocity } = renderRoll();
    const input = velocity("b").querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0.25" } });
    expect(notesById(lastCall(onValueCommitted)[0]).b?.velocity).toBe(0.25);
    expect(lastCall(onValueCommitted)[1].reason).toBe("input-change");
  });

  test("gives the next note drawn the velocity set last", () => {
    const { grid, onValueCommitted, velocity } = renderRoll({ mode: "draw" });
    const input = velocity("b").querySelector("input") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "PageDown" });
    drag(grid, [125, 25], [125, 25]);
    expect(lastCall(onValueCommitted)[0].at(-1)?.velocity).toBe(0.25);
  });
});
