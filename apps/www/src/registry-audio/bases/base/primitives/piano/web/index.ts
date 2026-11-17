import { createParts, wrappedButton } from "@ui-sdk/web";
import { type PianoState, piano, pitchName, viewOf } from "@/primitives/piano";

const KEY = "audio-ui-piano-key";

/**
 * Makes one key for each pitch, unless the author wrote some: the keys of a
 * long keyboard are many, and they follow `min-pitch` and `max-pitch`. A key
 * the author writes carries its own `pitch` and its own content.
 */
function syncKeys(root: HTMLElement, pitches: readonly number[]) {
  const written = [...root.children].some(
    (child) => child.localName === KEY && !child.hasAttribute("data-generated")
  );
  if (written) {
    // Keys made before the author's were parsed give way to them.
    for (const child of [...root.children]) {
      if (child.localName === KEY && child.hasAttribute("data-generated")) {
        child.remove();
      }
    }
    return;
  }
  const generated = new Map(
    [...root.children]
      .filter((child) => child.hasAttribute("data-generated"))
      .map((child) => [Number(child.getAttribute("pitch")), child] as const)
  );
  for (const [pitch, element] of generated) {
    if (!pitches.includes(pitch)) {
      element.remove();
    }
  }
  for (const pitch of pitches) {
    if (!generated.has(pitch)) {
      const element = document.createElement(KEY);
      element.setAttribute("data-generated", "");
      element.setAttribute("pitch", String(pitch));
      element.appendChild(document.createElement("button"));
      root.appendChild(element);
    }
  }
}

/** Writes each label's text, the name of the pitch of the key it sits in. */
function writeLabels(root: HTMLElement) {
  for (const label of root.querySelectorAll("audio-ui-piano-label")) {
    const pitch = Number(label.closest(KEY)?.getAttribute("pitch"));
    if (Number.isFinite(pitch) && label.textContent !== pitchName(pitch)) {
      label.textContent = pitchName(pitch);
    }
  }
}

/**
 * What React renders as children, the keyboard draws here: a key for each
 * pitch, and the name in each label. The keyboard connects before its parts are parsed, so it draws again
 * once they bind.
 */
function draw(
  el: HTMLElement,
  instance: {
    get: () => object;
    subscribe: (listener: () => void) => () => void;
  }
) {
  const paint = () => {
    syncKeys(el, viewOf(instance.get() as PianoState).pitches);
    writeLabels(el);
  };
  paint();
  queueMicrotask(paint);
  // The keys and labels an author writes may be parsed after the keyboard connects.
  const observer = new MutationObserver(paint);
  observer.observe(el, { childList: true, subtree: true });
  const unsubscribe = instance.subscribe(paint);
  return () => {
    observer.disconnect();
    unsubscribe();
  };
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/**
 * The whole web adapter of the piano: a tag for each part. A key's own
 * element is a wrapper, and the button inside it is the key: it takes the
 * focus, the keys and the state attributes.
 */
export const parts = createParts(piano, {
  key: {
    display: "contents",
    tag: KEY,
    target: wrappedButton,
  },
  label: "audio-ui-piano-label",
  root: {
    display: "block",
    events: { onNoteOff: "noteoff", onNoteOn: "noteon" },
    kinds: {
      activeNotes: jsonAttribute,
      layout: "string",
      orientation: "string",
      pitches: jsonAttribute,
    },
    render: draw,
    tag: "audio-ui-piano",
  },
});
