import { createParts, wrappedButton, wrappedChild } from "@ui-sdk/web";
import { type SequencerState, sequencer, viewOf } from "@/primitives/sequencer";

const ROW = "audio-ui-sequencer-row";
const CELL = "audio-ui-sequencer-cell";
const VELOCITY = "audio-ui-sequencer-velocity";
const INPUT = "audio-ui-sequencer-velocity-input";

/** Makes, or takes away, the children of `parent` named `tag` so there are `count`, one for each index, made by `make`. */
function syncChildren(
  parent: Element,
  tag: string,
  count: number,
  make: (index: number) => Element
) {
  const present = [...parent.children].filter(
    (child) => child.localName === tag && child.hasAttribute("data-generated")
  );
  for (let index = present.length; index < count; index += 1) {
    const element = make(index);
    element.setAttribute("data-generated", "");
    parent.appendChild(element);
  }
  for (let index = present.length - 1; index >= count; index -= 1) {
    present[index]?.remove();
  }
}

/** A cell: the wrapper, and the button inside it that is the step. */
function makeCell(row: number, step: number) {
  const element = document.createElement(CELL);
  element.setAttribute("cell", `${row}:${step}`);
  element.setAttribute("row", String(row));
  element.setAttribute("step", String(step));
  const button = document.createElement("button");
  button.setAttribute("aria-label", `Row ${row + 1}, step ${step + 1}`);
  element.appendChild(button);
  return element;
}

/** A velocity bar, and the native range input inside it that takes the keys. */
function makeVelocity(row: number, step: number) {
  const element = document.createElement(VELOCITY);
  element.setAttribute("data-slot", "sequencer-velocity");
  element.setAttribute("cell", `${row}:${step}`);
  element.setAttribute("row", String(row));
  element.setAttribute("step", String(step));
  const part = document.createElement(INPUT);
  part.setAttribute("cell", `${row}:${step}`);
  part.setAttribute("row", String(row));
  part.setAttribute("step", String(step));
  const input = document.createElement("input");
  input.setAttribute("aria-label", `Step ${step + 1}`);
  for (const type of ["input", "change"]) {
    input.addEventListener(type, (event) => event.stopPropagation());
  }
  part.appendChild(input);
  element.appendChild(part);
  return element;
}

// A row and a velocity bar are made with the `data-slot` they get: `data-slot`
// is a prop of every part (`nameSlots`), so the element observes it, and the
// kernel writing it first re-renders every part from inside the last: a
// 16-step pattern's bars would run past the call stack.

/**
 * What React renders as children, the sequencer draws here: a row for each
 * row of the pattern, a cell for each step, and under the cells a velocity bar
 * for each step when the sequencer has the `velocity-bars` attribute. The
 * sequencer connects before its parts are parsed, so it draws again once they
 * bind.
 */
function draw(
  el: HTMLElement,
  instance: {
    get: () => object;
    subscribe: (listener: () => void) => () => void;
  }
) {
  const paint = () => {
    const { rows, steps } = viewOf(instance.get() as SequencerState);
    const bars = el.hasAttribute("velocity-bars");
    syncChildren(el, ROW, rows, (row) => {
      const element = document.createElement(ROW);
      element.setAttribute("data-slot", "sequencer-row");
      element.setAttribute("index", String(row));
      element.setAttribute("aria-label", `Row ${row + 1}`);
      return element;
    });
    for (const row of el.querySelectorAll(ROW)) {
      const index = Number(row.getAttribute("index"));
      syncChildren(row, CELL, steps, (step) => makeCell(index, step));
      syncChildren(row, VELOCITY, bars ? steps : 0, (step) =>
        makeVelocity(index, step)
      );
    }
  };
  paint();
  queueMicrotask(paint);
  return instance.subscribe(paint);
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/**
 * The whole web adapter of the sequencer: a tag for each part. The rows, the
 * cells and the velocity bars are made by the sequencer, one for each step of
 * its pattern. A cell's own element is a wrapper, and the button inside it is
 * the step.
 */
export const parts = createParts(sequencer, {
  cell: {
    display: "contents",
    tag: CELL,
    target: wrappedButton,
  },
  root: {
    display: "block",
    events: {
      onValueChange: "input",
      onValueCommitted: "change",
      onVelocityChange: "velocitychange",
      onVelocityCommitted: "velocitycommit",
    },
    kinds: {
      defaultValue: jsonAttribute,
      defaultVelocities: jsonAttribute,
      value: jsonAttribute,
      velocities: jsonAttribute,
    },
    // A live step is set as a property: it is a source, not an attribute.
    properties: ["source"],
    render: draw,
    tag: "audio-ui-sequencer",
  },
  row: { display: "block", tag: ROW },
  velocity: { display: "block", tag: VELOCITY },
  velocityInput: {
    display: "contents",
    tag: INPUT,
    target: wrappedChild("input"),
  },
});
