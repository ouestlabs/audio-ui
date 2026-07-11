import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { Sequencer } from "./sequencer";

/** 2 rows × 4 columns, all off, so paint/keyboard assertions stay exact. */
function renderSequencer(props: Sequencer.RootProps = {}) {
  const onValueChange = mock(() => undefined);
  const onValueCommit = mock(() => undefined);
  const view = render(
    <Sequencer.Root
      defaultValue={[
        [false, false, false, false],
        [false, false, false, false],
      ]}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      {...props}
    >
      <Sequencer.Track data-testid="track">
        <Sequencer.Cells>
          {(_state, row, column) => (
            <Sequencer.Cell
              column={column}
              key={`${row}-${column}`}
              row={row}
            />
          )}
        </Sequencer.Cells>
      </Sequencer.Track>
    </Sequencer.Root>
  );
  return {
    cells: view.getAllByRole("gridcell"),
    onValueChange,
    onValueCommit,
    track: view.getByTestId("track"),
    view,
  };
}

describe("Sequencer value semantics", () => {
  test("renders one cell per matrix entry with grid and gridcell semantics", () => {
    const { track, cells } = renderSequencer();
    expect(track.getAttribute("role")).toBe("grid");
    expect(track.getAttribute("aria-label")).toBe("Sequencer");
    expect(cells).toHaveLength(8);
    expect(cells[0]?.getAttribute("aria-selected")).toBe("false");
  });

  test("matrix shape follows the controlled value's rows and columns", () => {
    const { cells } = renderSequencer({
      value: [
        [true, false, true],
        [false, false, false],
        [true, true, true],
      ],
    });
    expect(cells).toHaveLength(9);
    expect(cells[0]?.getAttribute("aria-selected")).toBe("true");
    expect(cells[2]?.getAttribute("aria-selected")).toBe("true");
  });

  test("marks the active step across every row", () => {
    const { cells } = renderSequencer({ activeStep: 1 });
    expect(cells[1]?.getAttribute("data-active-step")).toBe("true");
    expect(cells[0]?.getAttribute("data-active-step")).toBe("false");
    expect(cells[5]?.getAttribute("data-active-step")).toBe("true");
  });
});

describe("Sequencer keyboard", () => {
  test("Enter toggles the focused cell and commits", () => {
    const { cells, onValueCommit } = renderSequencer();
    fireEvent.keyDown(cells[2] as HTMLElement, { key: "Enter" });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      [false, false, true, false],
      [false, false, false, false],
    ]);
  });

  test("Space toggles the focused cell and commits", () => {
    const { cells, onValueCommit } = renderSequencer();
    fireEvent.keyDown(cells[5] as HTMLElement, { key: " " });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      [false, false, false, false],
      [false, true, false, false],
    ]);
  });

  test("arrow keys move the roving focus across rows and columns", () => {
    const { cells } = renderSequencer();
    expect(cells[0]?.tabIndex).toBe(0);
    expect(cells[1]?.tabIndex).toBe(-1);

    fireEvent.keyDown(cells[0] as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(cells[1] as HTMLElement);
    expect(cells[1]?.tabIndex).toBe(0);
    expect(cells[0]?.tabIndex).toBe(-1);

    fireEvent.keyDown(cells[1] as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(cells[5] as HTMLElement);
  });

  test("Home/End jump to the row's first/last column", () => {
    const { cells } = renderSequencer();
    fireEvent.keyDown(cells[1] as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(cells[3] as HTMLElement);
    fireEvent.keyDown(cells[3] as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(cells[0] as HTMLElement);
  });

  test("focus movement clamps at the grid edges", () => {
    const { cells } = renderSequencer();
    fireEvent.keyDown(cells[0] as HTMLElement, { key: "ArrowUp" });
    expect(document.activeElement).toBe(cells[0] as HTMLElement);
  });

  test("ignores keys when disabled", () => {
    const { cells, onValueCommit } = renderSequencer({ disabled: true });
    fireEvent.keyDown(cells[0] as HTMLElement, { key: "Enter" });
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(cells[0]?.tabIndex).toBe(-1);
  });
});

describe("Sequencer paint (track 200×100, 2 rows × 4 columns)", () => {
  test("pointer down toggles the touched cell (off → on)", () => {
    const { track, onValueChange } = renderSequencer();
    mockRect(track, { height: 100, width: 200 });

    fireEvent.pointerDown(track, { clientX: 25, clientY: 25, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([
      [true, false, false, false],
      [false, false, false, false],
    ]);
  });

  test("pointer down on an active cell paints off, dragging across paints every touched cell to that state", () => {
    const { track, onValueChange, onValueCommit } = renderSequencer({
      value: [
        [true, false, false, false],
        [false, false, false, false],
      ],
    });
    mockRect(track, { height: 100, width: 200 });

    fireEvent.pointerDown(track, { clientX: 25, clientY: 25, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([
      [false, false, false, false],
      [false, false, false, false],
    ]);

    fireEvent.pointerMove(track, { clientX: 75, clientY: 25, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 175, clientY: 75, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([
      [false, false, false, false],
      [false, false, false, false],
    ]);

    fireEvent.pointerUp(track, { clientX: 175, clientY: 75, pointerId: 1 });
    expect(onValueCommit).toHaveBeenLastCalledWith([
      [false, false, false, false],
      [false, false, false, false],
    ]);
  });

  test("dragging across untouched cells paints them all on with the first cell's inverse state", () => {
    const { track, onValueChange } = renderSequencer();
    mockRect(track, { height: 100, width: 200 });

    fireEvent.pointerDown(track, { clientX: 25, clientY: 25, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 75, clientY: 25, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 125, clientY: 25, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith([
      [true, true, true, false],
      [false, false, false, false],
    ]);
  });

  test("ignores pointer input when disabled", () => {
    const { track, onValueChange } = renderSequencer({ disabled: true });
    mockRect(track, { height: 100, width: 200 });

    fireEvent.pointerDown(track, { clientX: 25, clientY: 25, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
