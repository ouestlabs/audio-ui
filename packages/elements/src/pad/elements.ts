import {
  createPadController,
  type PadController,
  type PadOffEventDetails,
  type PadOnEventDetails,
  type PadSnapshot,
} from "@audio-ui/core/pad";
import { listAttribute, numberAttribute } from "../internal/element.ts";
import { ControlPart, ControlRoot, type Painted } from "../internal/parts.ts";

/** The names the pad's elements are registered under, frozen: a page cannot rename them by accident. */
export const PAD_TAGS = Object.freeze({
  item: "audio-ui-pad-item",
  root: "audio-ui-pad",
} as const);

/** What a `padon` event carries: the pad struck, how hard, and how. */
export interface PadOnDetail {
  /** `press` for a pointer, `keyboard` for Enter or Space. */
  reason: PadOnEventDetails["reason"];
  value: string;
  /** How hard it was struck, from 0 to 1. */
  velocity: number;
}

/** What a `padoff` event carries: the pad released, and why. */
export interface PadOffDetail {
  /** `press`, `keyboard` (a key released, or the focus lost while held), or `choke`: another pad of its group was struck. */
  reason: PadOffEventDetails["reason"];
  value: string;
}

/** Fired when a pad is struck. Cancel it, with `preventDefault()`, to keep it silent. */
export type PadOnEvent = CustomEvent<PadOnDetail>;
/** Fired when a pad stops sounding. */
export type PadOffEvent = CustomEvent<PadOffDetail>;

/** The events a pad grid fires, as `addEventListener` types them. */
export interface PadElementEventMap extends HTMLElementEventMap {
  padoff: PadOffEvent;
  padon: PadOnEvent;
}

/**
 * A grid of pads to strike: each one sounds while held, by pointer or from
 * the keyboard, and each pointer holds its own pad, so several can be played
 * at once on a touch screen. A strike is harder where a pen or screen
 * presses harder, or else toward the top of the pad. The pads are one tab
 * stop: the left and right arrows walk them in reading order, the up and
 * down arrows by a row of `columns` (4 by default). A strike fires `padon`,
 * which `preventDefault()` keeps silent, and a release fires `padoff`.
 * `active-pads` (or the `activePads` property) lights pads from elsewhere,
 * such as a sequencer. It is a group.
 */
export class PadElement extends ControlRoot<PadSnapshot> {
  static readonly observedAttributes = ["active-pads", "columns", "disabled"];

  /** The framework-agnostic grid behind its pads: which ones sound, how hard, and the tab stop. */
  readonly controller: PadController = createPadController({
    columns: 4,
    values: [],
  });

  readonly #items = new Set<PadItemElement>();
  #activePads: readonly string[] | undefined;
  #order: { disabledValues: string[]; values: string[] } = {
    disabledValues: [],
    values: [],
  };

  attributeChangedCallback() {
    this.configure();
    this.paint();
  }

  override addEventListener<K extends keyof PadElementEventMap>(
    type: K,
    listener: (this: PadElement, event: PadElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    super.addEventListener(type, listener, options);
  }

  /** Pads lit from elsewhere, on top of the ones held here. Takes over from the `active-pads` attribute. */
  get activePads(): readonly string[] {
    return this.#activePads ?? listAttribute(this, "active-pads");
  }

  set activePads(pads: readonly string[] | undefined) {
    this.#activePads = pads;
    this.configure();
    this.paint();
  }

  override attach(part: Painted<PadSnapshot>) {
    if (part instanceof PadItemElement) {
      this.#items.add(part);
      this.reorder();
    }
    super.attach(part);
  }

  override detach(part: Painted<PadSnapshot>) {
    if (part instanceof PadItemElement) {
      this.#items.delete(part);
      this.reorder();
    }
    super.detach(part);
  }

  /** Reads the pads' order again: their order in the document, and which are disabled. */
  reorder() {
    const items = [...this.#items].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    this.#order = {
      disabledValues: items
        .filter((item) => item.hasAttribute("disabled"))
        .map((item) => item.value),
      values: items.map((item) => item.value),
    };
    this.configure();
    this.paint();
  }

  /** Focuses the pad `value`, and moves the tab stop to it: the focus ring shows unless a pointer moved it. */
  focusPad(value: string, focusVisible = true) {
    this.controller.focusPad(value);
    for (const item of this.#items) {
      if (item.value === value) {
        item.focus({ focusVisible, preventScroll: true });
      }
    }
  }

  protected snapshot() {
    return this.controller.getSnapshot();
  }

  protected subscribe(listener: () => void) {
    return this.controller.subscribe(listener);
  }

  protected rootAttributes(snapshot: PadSnapshot) {
    return { "data-disabled": snapshot.disabled ? "" : null, role: "group" };
  }

  protected configure() {
    this.controller.setOptions({
      activePads: this.activePads,
      columns: numberAttribute(this, "columns") ?? 4,
      disabled: this.hasAttribute("disabled"),
      disabledValues: this.#order.disabledValues,
      onPadOff: (value, details) =>
        reportPadEvent(this, "padoff", { reason: details.reason, value }),
      onPadOn: (value, details) => {
        const sounds = reportPadEvent(this, "padon", {
          reason: details.reason,
          value,
          velocity: details.velocity,
        });
        if (!sounds) {
          details.cancel();
        }
      },
      values: this.#order.values,
    });
  }
}

/** Fires a pad's event on the grid; returns whether it stands (`padon` can be canceled). */
function reportPadEvent(
  element: Element,
  type: "padoff" | "padon",
  detail: PadOffDetail | PadOnDetail
) {
  return element.dispatchEvent(
    new CustomEvent(type, {
      bubbles: true,
      cancelable: type === "padon",
      composed: true,
      detail,
    })
  );
}

/**
 * One pad, a button: it sounds while held, by pointer, or with Enter or
 * Space while focused. Its accessible name comes from its content, or
 * `aria-label`. `value` names it in the events; pads sharing a
 * `choke-group` stop each other. How hard it was last struck is its
 * `--pad-velocity` CSS variable, from 0 to 1, and `data-active` is on while
 * it sounds.
 */
export class PadItemElement extends ControlPart<PadElement, PadSnapshot> {
  static readonly observedAttributes = ["choke-group", "disabled", "value"];

  protected readonly rootTag = PAD_TAGS.root;
  #release: AbortController | undefined;

  /** What identifies this pad in the events and in `active-pads`. */
  get value(): string {
    return this.getAttribute("value") ?? "";
  }

  set value(value: string) {
    this.setAttribute("value", value);
  }

  attributeChangedCallback() {
    this.root?.reorder();
  }

  override paint(snapshot: PadSnapshot) {
    const disabled = snapshot.disabled || this.hasAttribute("disabled");
    const velocity = snapshot.velocities.get(this.value);
    super.paint(snapshot);
    if (velocity === undefined) {
      this.style.removeProperty("--pad-velocity");
    } else {
      this.style.setProperty("--pad-velocity", String(velocity));
    }
    this.tabIndex = this.value === snapshot.tabStop ? 0 : -1;
    this.toggleAttribute("data-active", snapshot.active.has(this.value));
    this.toggleAttribute("data-disabled", disabled);
    if (disabled) {
      this.setAttribute("aria-disabled", "true");
    } else {
      this.removeAttribute("aria-disabled");
    }
  }

  protected isRoot(element: Element | null) {
    return element instanceof PadElement;
  }

  protected state() {
    return {};
  }

  protected override attached(pad: PadElement) {
    this.setAttribute("role", "button");
    this.style.touchAction = "none";
    this.#release = new AbortController();
    const { signal } = this.#release;
    const target = () => ({
      chokeGroup: this.getAttribute("choke-group") ?? undefined,
      value: this.value,
    });
    const disabled = () =>
      pad.controller.getSnapshot().disabled || this.hasAttribute("disabled");
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (disabled() || event.button !== 0) {
          return;
        }
        event.preventDefault();
        pad.focusPad(this.value, false);
        pad.controller.press(target(), event, this);
      },
      { signal }
    );
    this.addEventListener(
      "keydown",
      (event) => {
        if (disabled()) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          pad.controller.keyOn(target(), event);
          return;
        }
        const next = pad.controller.navigate(this.value, event);
        if (next !== null) {
          event.preventDefault();
          pad.focusPad(next);
        }
      },
      { signal }
    );
    this.addEventListener(
      "keyup",
      (event) => {
        if (event.key === "Enter" || event.key === " ") {
          pad.controller.keyOff(this.value, event);
        }
      },
      { signal }
    );
    this.addEventListener(
      "blur",
      (event) => pad.controller.keyOff(this.value, event),
      { signal }
    );
    this.addEventListener("focus", () => pad.controller.focusPad(this.value), {
      signal,
    });
  }

  protected override detached() {
    this.#release?.abort();
  }
}
