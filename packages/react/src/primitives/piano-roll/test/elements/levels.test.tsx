import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { PianoRoll } from "../../../../entries/piano-roll.ts";
import { Timeline } from "../../../../entries/timeline.ts";

const NOTES = [
  {
    chance: 0.25,
    deviation: -0.1,
    id: "a",
    length: 2,
    pitch: 60,
    start: 0,
    velocity: 0.5,
  },
  { id: "b", length: 2, pitch: 62, start: 4 },
];

const renderLevels = () =>
  render(
    <Timeline.Root duration={16} snapStep={1}>
      <PianoRoll.Root defaultSelection={["a", "b"]} defaultValue={NOTES}>
        <PianoRoll.Grid aria-label="Notes">
          <PianoRoll.SelectionSpan data-testid="span">
            <PianoRoll.StretchHandle data-testid="stretch-end" edge="end" />
          </PianoRoll.SelectionSpan>
        </PianoRoll.Grid>
        <PianoRoll.VelocityLane
          aria-label="Chance"
          data-testid="lane"
          level="chance"
        >
          <PianoRoll.Notes>
            {(note) => (
              <PianoRoll.Velocity
                data-testid={`bar-${note.id}`}
                key={note.id}
                note={note}
              />
            )}
          </PianoRoll.Notes>
        </PianoRoll.VelocityLane>
      </PianoRoll.Root>
    </Timeline.Root>
  );

describe("PianoRoll.VelocityLane with a level", () => {
  test("stands each bar at the note's chance, and says what it shows", () => {
    const view = renderLevels();
    expect(view.getByTestId("lane").getAttribute("data-level")).toBe("chance");
    const a = view.getByTestId("bar-a");
    expect(a.style.getPropertyValue("--piano-roll-level")).toBe("0.25");
    expect(a.style.getPropertyValue("--piano-roll-velocity")).toBe("0.5");
    expect(a.style.getPropertyValue("--piano-roll-deviation")).toBe("-0.1");
    expect(
      view.getByTestId("bar-b").style.getPropertyValue("--piano-roll-level")
    ).toBe("1");
    expect(a.querySelector("input")?.value).toBe("0.25");
  });
});

describe("PianoRoll.StretchHandle", () => {
  test("sits on its edge of the span, taking presses", () => {
    const view = renderLevels();
    const handle = view.getByTestId("stretch-end");
    expect(view.getByTestId("span").contains(handle)).toBe(true);
    expect(handle.style.right).toBe("0px");
    expect(handle.style.pointerEvents).toBe("auto");
    expect(handle.getAttribute("data-edge")).toBe("end");
  });
});
