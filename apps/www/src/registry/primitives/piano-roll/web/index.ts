import { createParts } from "@ui-sdk/web";
import { type PianoRollState, pianoRoll } from "@/primitives/piano-roll";

/** Makes, or takes away, the children of `parent` named `tag` so there is one for each key, in the order they came. */
function syncChildren(
  parent: Element,
  tag: string,
  keys: readonly string[],
  make: (key: string) => Element
) {
  const wanted = new Set(keys);
  const present = new Map<string, Element>();
  for (const child of [...parent.children]) {
    if (child.localName !== tag || !child.hasAttribute("data-generated")) {
      continue;
    }
    const key = child.getAttribute("data-key") ?? "";
    if (wanted.has(key)) {
      present.set(key, child);
    } else {
      child.remove();
    }
  }
  for (const key of keys) {
    if (!present.has(key)) {
      const element = make(key);
      element.setAttribute("data-generated", "");
      element.setAttribute("data-key", key);
      parent.appendChild(element);
    }
  }
}

/**
 * A part that belongs to a note or a row, with the attribute that names it.
 * It is made with the `data-slot` it gets: `data-slot` is a prop of every
 * part (`nameSlots`), so the element observes it, and the kernel writing it
 * first re-renders every part from inside the last: a roll's notes and rows
 * would run past the call stack.
 */
function part(tag: string, attribute: string, key: string, extra = {}) {
  const element = document.createElement(tag);
  element.setAttribute("data-slot", tag.slice("audio-ui-".length));
  element.setAttribute(attribute, key);
  for (const [name, value] of Object.entries(extra)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

/** What the roll's own containers hold, one for each note or pitch. */
function drawParts(
  el: HTMLElement,
  instance: {
    get: () => object;
    subscribe: (listener: () => void) => () => void;
  }
) {
  const paint = () => {
    const { view } = instance.get() as PianoRollState;
    // The notes keep the order they came in: a note moved past another keeps its place in the DOM, which keeps a drag going.
    for (const notes of el.querySelectorAll("audio-ui-piano-roll-notes")) {
      syncChildren(
        notes,
        "audio-ui-piano-roll-note",
        view.notes.map((note) => String(note.id)),
        (key) => {
          const note = part("audio-ui-piano-roll-note", "note", key);
          if (notes.hasAttribute("handles")) {
            for (const edge of ["start", "end"]) {
              note.appendChild(
                part(`audio-ui-piano-roll-note-${edge}`, "note", key)
              );
            }
          }
          return note;
        }
      );
    }
    for (const rows of el.querySelectorAll("audio-ui-piano-roll-rows")) {
      syncChildren(
        rows,
        "audio-ui-piano-roll-row",
        view.rows.pitches.map(String),
        (key) => part("audio-ui-piano-roll-row", "pitch", key)
      );
    }
    for (const lane of el.querySelectorAll(
      "audio-ui-piano-roll-velocity-lane"
    )) {
      const level = lane.getAttribute("level") ?? "velocity";
      syncChildren(
        lane,
        "audio-ui-piano-roll-velocity",
        view.notes.map((note) => String(note.id)),
        (key) => {
          const bar = part("audio-ui-piano-roll-velocity", "note", key, {
            level,
          });
          const holder = part(
            "audio-ui-piano-roll-velocity-input",
            "note",
            key,
            { level }
          );
          const input = document.createElement("input");
          input.setAttribute("aria-label", `Note ${key}`);
          for (const type of ["input", "change"]) {
            input.addEventListener(type, (event) => event.stopPropagation());
          }
          holder.appendChild(input);
          bar.appendChild(holder);
          return bar;
        }
      );
    }
  };
  paint();
  queueMicrotask(paint);
  // A container written later is drawn into too.
  const observer = new MutationObserver(paint);
  observer.observe(el, { childList: true, subtree: true });
  const unsubscribe = instance.subscribe(paint);
  return () => {
    observer.disconnect();
    unsubscribe();
  };
}

/** An attribute that is not JSON, such as a list written as text, is left unset instead of throwing while the element upgrades. */
const jsonAttribute = (value: string | null) => {
  try {
    return value ? JSON.parse(value) : undefined;
  } catch {
    // Not JSON: the option stays unset.
  }
};

const numberAttribute = (value: string | null) =>
  value === null ? undefined : Number(value);

/** `folded` is on, off, or `"scale"`. */
const foldedAttribute = (value: string | null) => {
  if (value === null || value === "false") {
    return;
  }
  return value === "scale" ? "scale" : true;
};

/**
 * The whole web adapter of the piano roll: a tag for each part. The notes, the
 * rows and the velocity bars are made for you, one for each note or pitch.
 */
export const parts = createParts(pianoRoll, {
  grid: { display: "block", tag: "audio-ui-piano-roll-grid" },
  keys: { display: "block", tag: "audio-ui-piano-roll-keys" },
  marquee: { display: "block", tag: "audio-ui-piano-roll-marquee" },
  note: { display: "block", tag: "audio-ui-piano-roll-note" },
  noteEnd: { display: "block", tag: "audio-ui-piano-roll-note-end" },
  noteStart: { display: "block", tag: "audio-ui-piano-roll-note-start" },
  notes: {
    display: "contents",
    tag: "audio-ui-piano-roll-notes",
  },
  root: {
    display: "block",
    events: {
      onNoteOff: "noteoff",
      onNoteOn: "noteon",
      onSelectionChange: "selectionchange",
      onValueChange: "input",
      onValueCommitted: "change",
    },
    kinds: {
      activePitches: jsonAttribute,
      defaultSelection: jsonAttribute,
      defaultValue: jsonAttribute,
      folded: foldedAttribute,
      scale: jsonAttribute,
      selection: jsonAttribute,
      snapPoints: jsonAttribute,
      value: jsonAttribute,
      zoom: numberAttribute,
    },
    // A live position, the label of a note and the id of a new one are set as properties.
    properties: ["createNoteId", "getNoteLabel", "source"],
    render: drawParts,
    tag: "audio-ui-piano-roll",
  },
  row: { display: "block", tag: "audio-ui-piano-roll-row" },
  rows: {
    display: "contents",
    tag: "audio-ui-piano-roll-rows",
  },
  selectionSpan: {
    display: "block",
    tag: "audio-ui-piano-roll-selection-span",
  },
  stretchEnd: { display: "block", tag: "audio-ui-piano-roll-stretch-end" },
  stretchStart: { display: "block", tag: "audio-ui-piano-roll-stretch-start" },
  velocity: { display: "block", tag: "audio-ui-piano-roll-velocity" },
  velocityInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-piano-roll-velocity-input",
    target: (el) => el.querySelector("input"),
  },
  velocityLane: {
    display: "block",
    tag: "audio-ui-piano-roll-velocity-lane",
  },
});
