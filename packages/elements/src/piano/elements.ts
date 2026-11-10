import { pitchName } from "@audio-ui/core";
import {
  createPianoController,
  type KeyLayout,
  type PianoController,
  type PianoNoteOffEventDetails,
  type PianoNoteOnEventDetails,
  type PianoSnapshot,
} from "@audio-ui/core/piano";
import {
  listAttribute,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import { ControlPart, ControlRoot, type Painted } from "../internal/parts.ts";
import { Stamp } from "../internal/stamp.ts";

/** The names the piano's elements are registered under, frozen: a page cannot rename them by accident. */
export const PIANO_TAGS = Object.freeze({
  key: "audio-ui-piano-key",
  keyLabel: "audio-ui-piano-key-label",
  keys: "audio-ui-piano-keys",
  root: "audio-ui-piano",
});

/** What a `noteon` event carries: the pitch played, how hard, and how. */
export interface PianoNoteOnDetail {
  /** The pointer or key event that played it. */
  event: Event;
  /** MIDI pitch: 60 is middle C. */
  pitch: number;
  /** `press` for a pointer, `glide` when it slid onto the key, `keyboard` for Enter or Space. */
  reason: PianoNoteOnEventDetails["reason"];
  /** How hard it was played, from 0 to 1. */
  velocity: number;
}

/** What a `noteoff` event carries: the pitch released, and why. */
export interface PianoNoteOffDetail {
  /** The pointer, key or focus event that released it. */
  event: Event;
  pitch: number;
  /** `press` (released), `glide` (slid off it), or `keyboard` (a key released, or the focus lost while held). */
  reason: PianoNoteOffEventDetails["reason"];
}

/** Fired when a key starts sounding. Cancel it, with `preventDefault()`, to keep it silent. */
export type PianoNoteOnEvent = CustomEvent<PianoNoteOnDetail>;
/** Fired when a key stops sounding. */
export type PianoNoteOffEvent = CustomEvent<PianoNoteOffDetail>;

/** The events a piano fires, as `addEventListener` types them. */
export interface PianoElementEventMap extends HTMLElementEventMap {
  noteoff: PianoNoteOffEvent;
  noteon: PianoNoteOnEvent;
}

const pitchList = (element: Element, name: string) =>
  listAttribute(element, name)
    .map(Number)
    .filter((pitch) => Number.isFinite(pitch));

/**
 * The root of a playable keyboard, with `role="group"`. A key sounds while
 * pressed, by pointer or keyboard; dragging glides across keys, and each
 * pointer holds its own key for multi-touch chords. `layout` is `keyboard`
 * (piano proportions) or `even` (equal shares, as on a piano roll);
 * `orientation="vertical"` places the low end at the bottom. The keys share
 * one tab stop, navigated with the arrow keys. `min-pitch` and `max-pitch`
 * (48 and 72) or `pitches` set the keys; `active-notes` and the
 * `activeNotes` property light keys externally. Fires `noteon` when a key
 * starts sounding, cancelable with `preventDefault()`, and `noteoff` when it
 * stops.
 */
export class PianoElement extends ControlRoot<PianoSnapshot> {
  static readonly observedAttributes = [
    "active-notes",
    "disabled",
    "layout",
    "max-pitch",
    "min-pitch",
    "orientation",
    "pitches",
  ];

  /** The framework-agnostic keyboard behind its keys: which ones sound, where each sits, and the tab stop. */
  readonly controller: PianoController = createPianoController({
    layout: "keyboard",
    maxPitch: 72,
    minPitch: 48,
    orientation: "horizontal",
  });

  readonly #keys = new Map<number, PianoKeyElement>();
  #activeNotes: readonly number[] | undefined;
  #pitches: readonly number[] | undefined;
  #release: AbortController | undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.#release ??= new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        this.controller.press(event, this);
      },
      { signal: this.#release.signal }
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#release?.abort();
    this.#release = undefined;
  }

  attributeChangedCallback() {
    this.configure();
    this.paint();
  }

  override addEventListener<K extends keyof PianoElementEventMap>(
    type: K,
    listener: (this: PianoElement, event: PianoElementEventMap[K]) => unknown,
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

  /** Pitches lit from elsewhere, such as a MIDI input, on top of the keys pressed here. Overrides `active-notes`. */
  get activeNotes(): readonly number[] {
    return this.#activeNotes ?? pitchList(this, "active-notes");
  }

  set activeNotes(pitches: readonly number[] | undefined) {
    this.#activeNotes = pitches;
    this.configure();
    this.paint();
  }

  /** Only these pitches get keys, instead of `min-pitch` to `max-pitch`. Overrides `pitches`. */
  get pitches(): readonly number[] | undefined {
    if (this.#pitches) {
      return this.#pitches;
    }
    return this.hasAttribute("pitches")
      ? pitchList(this, "pitches")
      : undefined;
  }

  set pitches(pitches: readonly number[] | undefined | string) {
    // A framework may set the attribute's text form as the property.
    if (typeof pitches === "string") {
      this.setAttribute("pitches", pitches);
      return;
    }
    this.#pitches = pitches;
    this.configure();
    this.paint();
  }

  override attach(part: Painted<PianoSnapshot>) {
    if (part instanceof PianoKeyElement) {
      this.#keys.set(part.pitch, part);
    }
    super.attach(part);
  }

  override detach(part: Painted<PianoSnapshot>) {
    if (
      part instanceof PianoKeyElement &&
      this.#keys.get(part.pitch) === part
    ) {
      this.#keys.delete(part.pitch);
    }
    super.detach(part);
  }

  /** Focuses the key of `pitch`, and moves the tab stop to it. */
  focusKey(pitch: number, focusVisible = true) {
    this.controller.focusKey(pitch);
    this.#keys.get(pitch)?.focus({ focusVisible, preventScroll: true });
  }

  protected snapshot() {
    return this.controller.getSnapshot();
  }

  protected subscribe(listener: () => void) {
    return this.controller.subscribe(listener);
  }

  protected rootAttributes(snapshot: PianoSnapshot) {
    return {
      "data-disabled": snapshot.disabled ? "" : null,
      "data-layout": snapshot.layout,
      "data-orientation": snapshot.orientation,
      role: "group",
    };
  }

  protected configure() {
    const layout = this.getAttribute("layout");
    this.controller.setOptions({
      activeNotes: this.activeNotes,
      disabled: this.hasAttribute("disabled"),
      layout: (layout === "even" ? "even" : "keyboard") satisfies KeyLayout,
      maxPitch: numberAttribute(this, "max-pitch") ?? 72,
      minPitch: numberAttribute(this, "min-pitch") ?? 48,
      onNoteOff: (pitch, details) =>
        this.dispatchEvent(
          new CustomEvent("noteoff", {
            bubbles: true,
            composed: true,
            detail: { event: details.event, pitch, reason: details.reason },
          })
        ),
      onNoteOn: (pitch, details) => {
        const sounds = this.dispatchEvent(
          new CustomEvent("noteon", {
            bubbles: true,
            cancelable: true,
            composed: true,
            detail: {
              event: details.event,
              pitch,
              reason: details.reason,
              velocity: details.velocity,
            },
          })
        );
        if (!sounds) {
          details.cancel();
        }
      },
      orientation:
        this.getAttribute("orientation") === "vertical"
          ? "vertical"
          : "horizontal",
      pitches: this.pitches,
    });
  }
}

/** What every part of the piano does: find its piano. */
abstract class PianoPartElement extends ControlPart<
  PianoElement,
  PianoSnapshot
> {
  protected readonly rootTag = PIANO_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof PianoElement;
  }

  protected state(snapshot: PianoSnapshot): Record<string, string | null> {
    return {
      "data-disabled": snapshot.disabled ? "" : null,
      "data-orientation": snapshot.orientation,
    };
  }
}

/**
 * Generates an `<audio-ui-piano-key>` per pitch, lowest first, filled from
 * its `<template>`, such as with an `<audio-ui-piano-key-label>`. Renders
 * with `display: contents`.
 */
export class PianoKeysElement extends PianoPartElement {
  readonly #stamp = new Stamp(this, PIANO_TAGS.key, "pitch");
  #pitches: readonly number[] = [];

  override paint(snapshot: PianoSnapshot) {
    if (snapshot.pitches !== this.#pitches) {
      this.#pitches = snapshot.pitches;
      this.#stamp.update(snapshot.pitches);
    }
  }

  protected override attached() {
    this.#stamp.connect();
  }

  protected override detached() {
    this.#stamp.disconnect();
  }

  protected override state() {
    return {};
  }
}

/**
 * A key, positioned for its `pitch`. Sounds while pressed, by pointer or
 * with Enter and Space when focused. A button labelled with its pitch name
 * ("C4") unless it has an `aria-label`. Carries `data-color` (`black` or
 * `white`) and `data-active` while it sounds.
 */
export class PianoKeyElement extends PianoPartElement {
  #release: AbortController | undefined;

  /** The MIDI pitch this key plays, from its `pitch` attribute. */
  get pitch(): number {
    return numberAttribute(this, "pitch") ?? 0;
  }

  override paint(snapshot: PianoSnapshot) {
    super.paint(snapshot);
    const { pitch } = this;
    const placement = snapshot.placements.get(pitch);
    const start = `${(placement?.start ?? 0) * 100}%`;
    const size = `${(placement?.size ?? 0) * 100}%`;
    const vertical = snapshot.orientation === "vertical";
    Object.assign(this.style, {
      bottom: vertical ? start : "",
      height: vertical ? size : "",
      left: vertical ? "" : start,
      position: "absolute",
      width: vertical ? "" : size,
    });
    this.tabIndex = !snapshot.disabled && pitch === snapshot.tabStop ? 0 : -1;
    reflect(this, {
      "aria-disabled": snapshot.disabled ? "true" : null,
      "data-active": snapshot.active.has(pitch) ? "" : null,
      "data-color": placement?.black ? "black" : "white",
    });
  }

  protected override attached(piano: PianoElement) {
    this.setAttribute("role", "button");
    if (!this.hasAttribute("aria-label")) {
      this.setAttribute("aria-label", pitchName(this.pitch));
    }
    this.#release = new AbortController();
    const { signal } = this.#release;
    const disabled = () => piano.controller.getSnapshot().disabled;
    this.addEventListener(
      "keydown",
      (event) => {
        if (disabled()) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          piano.controller.keyOn(this.pitch, event);
          return;
        }
        const next = piano.controller.navigate(this.pitch, event);
        if (next !== null) {
          event.preventDefault();
          piano.focusKey(next);
        }
      },
      { signal }
    );
    this.addEventListener(
      "keyup",
      (event) => {
        if (event.key === "Enter" || event.key === " ") {
          piano.controller.keyOff(this.pitch, event);
        }
      },
      { signal }
    );
    this.addEventListener(
      "blur",
      (event) => piano.controller.keyOff(this.pitch, event),
      { signal }
    );
    this.addEventListener(
      "focus",
      () => piano.controller.focusKey(this.pitch),
      {
        signal,
      }
    );
  }

  protected override detached() {
    this.#release?.abort();
  }
}

/**
 * The name of its key, such as "C4". Hidden from assistive technology, which
 * reads the key's own label.
 */
export class PianoKeyLabelElement extends PianoPartElement {
  override paint(snapshot: PianoSnapshot) {
    super.paint(snapshot);
    const key = this.closest(PIANO_TAGS.key);
    const name = pitchName(numberAttribute(key ?? this, "pitch") ?? 0);
    if (this.textContent !== name) {
      this.textContent = name;
    }
    this.setAttribute("aria-hidden", "true");
  }
}
