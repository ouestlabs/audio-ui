import { hideVisually, reflect } from "./element.ts";

/** A thumb's attributes that name its input instead. */
export const INPUT_NAMES = [
  "aria-describedby",
  "aria-label",
  "aria-labelledby",
];

/** What a thumb writes onto its input on each paint. */
export interface InputState {
  disabled: boolean;
  /** The value as text, which the input announces. */
  formatted: string;
  /** The label part's id, which names the input when the thumb has no name of its own. */
  labelId: string | undefined;
  max: number;
  min: number;
  /** The form field's name, from the control's `name`. */
  name: string | null;
  step: number;
  value: number;
}

/**
 * The native `<input type="range">` a thumb holds, out of sight: it takes
 * focus, carries the accessible name and the form value, and gets the keys.
 * The names set on the thumb (`aria-label`, `aria-labelledby`,
 * `aria-describedby`) move onto it, so they are read once.
 */
export class ThumbInput {
  readonly element = document.createElement("input");
  readonly #names = new Map<string, string>();

  constructor() {
    this.element.type = "range";
    hideVisually(this.element);
  }

  /**
   * Takes a name just set on `thumb`, and removes it there. `""` takes it
   * away. Returns whether the input's names changed: a name never stays on
   * the thumb, so the only removal that arrives is the thumb's own.
   */
  take(thumb: Element, name: string, next: string | null): boolean {
    if (next === null) {
      return false;
    }
    if (next === "") {
      this.#names.delete(name);
    } else {
      this.#names.set(name, next);
    }
    thumb.removeAttribute(name);
    return true;
  }

  write(state: InputState) {
    const input = this.element;
    input.min = String(state.min);
    input.max = String(state.max);
    input.step = String(state.step);
    input.value = String(state.value);
    input.disabled = state.disabled;
    const label = this.#names.get("aria-label");
    reflect(input, {
      "aria-describedby": this.#names.get("aria-describedby") ?? null,
      "aria-label": label ?? null,
      "aria-labelledby":
        this.#names.get("aria-labelledby") ??
        (label ? null : (state.labelId ?? null)),
      "aria-valuetext": state.formatted,
      name: state.name,
    });
  }
}

/** The text of a value part: one text node, its data written when the text changes. */
export class ValueText {
  readonly #text = document.createTextNode("");

  /** Puts the text node in `element`, in place of what it held. */
  mount(element: Element) {
    if (this.#text.parentNode !== element) {
      element.replaceChildren(this.#text);
    }
  }

  write(text: string) {
    // One text node's data, not the children: a change of children restyles the whole page.
    if (this.#text.data !== text) {
      this.#text.data = text;
    }
  }
}

/** The hidden native range input a part holds: it takes focus and the keys, and carries the names set on the part. */
export function rangeInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "range";
  input.step = "any";
  hideVisually(input);
  return input;
}

/** Moves a name just set on `part` onto its input's names. Returns whether they changed. */
export function takeName(
  part: Element,
  names: Map<string, string>,
  name: string,
  next: string | null
): boolean {
  // A name never stays on the part, so only its own removal of it comes with no value.
  if (next === null) {
    return false;
  }
  if (next === "") {
    names.delete(name);
  } else {
    names.set(name, next);
  }
  part.removeAttribute(name);
  return true;
}

/** The names an input carries, from the ones its part was given. */
export const inputNames = (names: Map<string, string>) => ({
  "aria-describedby": names.get("aria-describedby") ?? null,
  "aria-label": names.get("aria-label") ?? null,
  "aria-labelledby": names.get("aria-labelledby") ?? null,
});
