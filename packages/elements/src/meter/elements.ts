import {
  channelView,
  createMeterConfig,
  type LevelScale,
  type MeterChannelNodes,
  type MeterConfig,
  type MeterFrame,
  type MeterOrientation,
  paintChannel,
} from "@audio-ui/core/meter";
import {
  ensureId,
  hideVisually,
  jsonAttribute,
  listAttribute,
  localeOf,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import { ValueText } from "../internal/input.ts";
import { ControlPart, ControlRoot } from "../internal/parts.ts";

/** The names the meter's elements are registered under, frozen: a page cannot rename them by accident. */
export const METER_TAGS = Object.freeze({
  channel: "audio-ui-meter-channel",
  channels: "audio-ui-meter-channels",
  indicator: "audio-ui-meter-indicator",
  label: "audio-ui-meter-label",
  mark: "audio-ui-meter-mark",
  peak: "audio-ui-meter-peak",
  root: "audio-ui-meter",
  track: "audio-ui-meter-track",
  value: "audio-ui-meter-value",
} as const);

/** A live signal, in the shape of an external store: `subscribe` calls back on each new frame, `getSnapshot` returns the latest. */
export interface MeterSource {
  getSnapshot: () => MeterFrame;
  subscribe: (listener: () => void) => () => void;
}

/** What the meter's parts draw from. */
export interface MeterSnapshot {
  config: MeterConfig;
  frame: MeterFrame;
  orientation: MeterOrientation;
}

const numberList = (element: Element, name: string) =>
  listAttribute(element, name)
    .map(Number)
    .filter((level) => !Number.isNaN(level));

/**
 * Groups the channels of a level meter, a group. Levels come from `value`
 * (and `peak`), a level per channel separated by spaces, or the `value` and
 * `peak` properties as arrays; or from a live `source` property, whose
 * frames are written straight to the parts, so a signal updating sixty times
 * a second touches only what changed. `min` and `max` (-60 and 6 by
 * default), `scale` (`linear` or `iec`), `clip-threshold` (0),
 * `warn-threshold`, `orientation` (vertical), `format` and `locale` set how
 * a level reads, and `unit` what each channel says after it ("-6 dB"). A
 * click anywhere on it clears the clips a live source latched.
 */
export class MeterElement extends ControlRoot<MeterSnapshot> {
  static readonly observedAttributes = [
    "clip-threshold",
    "format",
    "locale",
    "max",
    "min",
    "orientation",
    "peak",
    "scale",
    "unit",
    "value",
    "warn-threshold",
  ];

  /** Returns each channel's `aria-valuetext`, e.g. `"-6 dB"`, for the channels with none of their own. */
  getAriaValueText:
    | ((formatted: string, value: number, index: number) => string)
    | undefined;

  #snapshot: MeterSnapshot | undefined;
  #value: readonly number[] | undefined;
  #peak: readonly number[] | undefined;
  #source: MeterSource | undefined;
  #format: Intl.NumberFormatOptions | undefined;
  #scale: LevelScale | undefined;
  #unsubscribe: (() => void) | undefined;
  #release: AbortController | undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.#listen();
    this.#release ??= new AbortController();
    // A click anywhere on the meter clears what the live source latched, as in a DAW.
    this.addEventListener(
      "click",
      () => {
        for (const node of this.querySelectorAll("[data-clipped]")) {
          node.removeAttribute("data-clipped");
        }
      },
      { signal: this.#release.signal }
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#release?.abort();
    this.#release = undefined;
  }

  attributeChangedCallback() {
    this.configure();
    this.paint();
  }

  /** The level per channel; the length is the channel count. Takes over from the `value` attribute. */
  get value(): readonly number[] {
    return this.#value ?? numberList(this, "value");
  }

  set value(levels: readonly number[] | undefined) {
    this.#value = levels;
    this.configure();
    this.paint();
  }

  /** The peak-hold level per channel. Takes over from the `peak` attribute. */
  get peak(): readonly number[] | undefined {
    return (
      this.#peak ??
      (this.hasAttribute("peak") ? numberList(this, "peak") : undefined)
    );
  }

  set peak(levels: readonly number[] | undefined) {
    this.#peak = levels;
    this.configure();
    this.paint();
  }

  /** A live signal painted frame by frame; takes precedence over `value` and `peak`. */
  get source(): MeterSource | undefined {
    return this.#source;
  }

  set source(source: MeterSource | undefined) {
    this.#source = source;
    this.#listen();
    this.configure();
    this.paint();
  }

  /** How each level is written: `Intl.NumberFormat` options. Takes over from the `format` attribute. */
  get format(): Intl.NumberFormatOptions | undefined {
    return this.#format ?? jsonAttribute(this, "format");
  }

  set format(format: Intl.NumberFormatOptions | undefined) {
    this.#format = format;
    this.configure();
    this.paint();
  }

  /** How levels spread along the length: `linear`, `iec`, or your own increasing curve. Takes over from the `scale` attribute. */
  get scale(): LevelScale {
    if (this.#scale) {
      return this.#scale;
    }
    return this.getAttribute("scale") === "iec" ? "iec" : "linear";
  }

  set scale(scale: LevelScale | undefined) {
    this.#scale = scale;
    this.configure();
    this.paint();
  }

  protected snapshot(): MeterSnapshot {
    if (!this.#snapshot) {
      this.configure();
    }
    return this.#snapshot as MeterSnapshot;
  }

  protected subscribe() {
    // The source is listened to by the meter itself, since it can change while connected.
    return () => undefined;
  }

  protected rootAttributes(snapshot: MeterSnapshot) {
    return { "data-orientation": snapshot.orientation, role: "group" };
  }

  protected configure() {
    const config = createMeterConfig({
      clipThreshold: numberAttribute(this, "clip-threshold") ?? 0,
      format: this.format,
      locale: localeOf(this),
      max: numberAttribute(this, "max") ?? 6,
      min: numberAttribute(this, "min") ?? -60,
      scale: this.scale,
      warnThreshold:
        numberAttribute(this, "warn-threshold") ?? Number.POSITIVE_INFINITY,
    });
    this.#snapshot = {
      config,
      frame: this.#source
        ? this.#source.getSnapshot()
        : { levels: this.value, peaks: this.peak },
      orientation:
        this.getAttribute("orientation") === "horizontal"
          ? "horizontal"
          : "vertical",
    };
  }

  /** Listens to the source while connected: each frame is painted as it comes. */
  #listen() {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    const source = this.#source;
    if (!(source && this.isConnected)) {
      return;
    }
    this.#unsubscribe = source.subscribe(() => {
      const snapshot = this.#snapshot;
      if (snapshot) {
        this.#snapshot = { ...snapshot, frame: source.getSnapshot() };
      }
      this.paint();
    });
  }
}

/** What every part of the meter does: find its meter. */
abstract class MeterPartElement extends ControlPart<
  MeterElement,
  MeterSnapshot
> {
  protected readonly rootTag = METER_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof MeterElement;
  }

  protected state(): Record<string, string | null> {
    return {};
  }
}

/**
 * Makes one `<audio-ui-meter-channel>` per level, in order, each holding
 * what its `<template>` holds, and makes them again when the channel count
 * changes. `label` names each one, `{n}` its number from 1 ("Output {n}").
 * It takes no room of its own (`display: contents`).
 */
export class MeterChannelsElement extends MeterPartElement {
  #count = -1;
  #template: HTMLTemplateElement | undefined;
  #watch: MutationObserver | undefined;

  override paint(snapshot: MeterSnapshot) {
    const count = snapshot.frame.levels.length;
    if (count === this.#count) {
      return;
    }
    this.#count = count;
    const made = this.#channels();
    for (const gone of made.slice(count)) {
      gone.remove();
    }
    for (let index = made.length; index < count; index += 1) {
      const channel = document.createElement(METER_TAGS.channel);
      channel.setAttribute("index", String(index));
      const label = this.getAttribute("label");
      if (label) {
        channel.setAttribute(
          "aria-label",
          label.replaceAll("{n}", String(index + 1))
        );
      }
      this.#fill(channel);
      this.appendChild(channel);
    }
  }

  protected override attached() {
    // A page being read connects the element before its template: the channels take it once it is there.
    this.#watch = new MutationObserver(() => this.#takeTemplate());
    this.#watch.observe(this, { childList: true });
    this.#takeTemplate();
  }

  protected override detached() {
    this.#watch?.disconnect();
  }

  #channels() {
    return [...this.children].filter(
      (child) => child.localName === METER_TAGS.channel
    );
  }

  #takeTemplate() {
    const template = [...this.children].find(
      (child): child is HTMLTemplateElement =>
        child instanceof HTMLTemplateElement
    );
    if (template === this.#template) {
      return;
    }
    this.#template = template;
    for (const channel of this.#channels()) {
      this.#fill(channel);
    }
  }

  /** Puts in `channel` what the template holds, in place of what it held. */
  #fill(channel: Element) {
    // Imported, not cloned: a clone stays in the template's document, where no element upgrades.
    channel.replaceChildren(
      ...(this.#template
        ? [document.importNode(this.#template.content, true)]
        : [])
    );
  }
}

/**
 * One channel of the meter, a `role="meter"` for its `index` in the levels:
 * name it with `aria-label` or an `<audio-ui-meter-label>`. It carries
 * `data-warning` from the warning level up to the clip threshold, and
 * `data-clipping` at or above it; fed by a live source, `data-clipped` too,
 * from the first clip until a click on the meter clears it. Its
 * `getAriaValueText` property, `(formatted, value, index) => string`, says
 * the level, such as "-6 dB"; the formatted level by default.
 */
export class MeterChannelElement extends MeterPartElement {
  /** Returns the channel's `aria-valuetext`, e.g. `"-6 dB"`. Defaults to the formatted level. */
  getAriaValueText:
    | ((formatted: string, value: number, index: number) => string)
    | undefined;
  /** The label's id, which names the channel. */
  labelId: string | undefined;

  readonly #presence = document.createElement("span");

  constructor() {
    super();
    // A meter with no text inside is skipped by some screen readers.
    this.#presence.setAttribute("role", "presentation");
    this.#presence.textContent = "x";
    hideVisually(this.#presence);
  }

  /** Its place in the levels, from its `index` attribute. */
  get index(): number {
    return numberAttribute(this, "index") ?? 0;
  }

  override paint(snapshot: MeterSnapshot) {
    const { config, frame, orientation } = snapshot;
    const { index } = this;
    const view = channelView(frame, index, config);
    reflect(this, {
      "aria-labelledby": this.labelId ?? null,
      "aria-valuemax": String(config.max),
      "aria-valuemin": String(config.min),
      "data-orientation": orientation,
      role: "meter",
    });
    const meter = this.root;
    const unit = meter?.getAttribute("unit");
    const nodes: MeterChannelNodes = {
      channel: this,
      getAriaValueText:
        this.getAriaValueText ??
        meter?.getAriaValueText ??
        (unit ? (formatted) => `${formatted} ${unit}` : undefined),
      indicator: this.#part(METER_TAGS.indicator),
      peak: this.#part(METER_TAGS.peak),
      value: this.#part(METER_TAGS.value),
    };
    paintChannel(nodes, view, index, orientation);
    for (const part of [nodes.indicator, nodes.peak]) {
      part?.setAttribute("data-orientation", orientation);
    }
    nodes.peak?.toggleAttribute("data-clipping", view.clipping);
    nodes.peak?.toggleAttribute("data-warning", view.warning);
  }

  protected override attached() {
    if (this.#presence.parentNode !== this) {
      this.appendChild(this.#presence);
    }
  }

  /** The first part of `tag` in this channel, not in a channel inside it. */
  #part(tag: string): HTMLElement | undefined {
    const part = this.querySelector<HTMLElement>(tag);
    return part?.closest(METER_TAGS.channel) === this ? part : undefined;
  }
}

/**
 * What a part inside a channel shares: its channel paints it, frame by
 * frame, and it asks for a paint when it arrives, so a part added later is
 * painted at once.
 */
abstract class MeterChannelPartElement extends MeterPartElement {
  protected get channel(): MeterChannelElement | null {
    const channel = this.closest(METER_TAGS.channel);
    return channel instanceof MeterChannelElement ? channel : null;
  }

  override paint(_snapshot: MeterSnapshot) {
    this.setAttribute("aria-hidden", "true");
  }

  protected override attached(meter: MeterElement) {
    meter.paint();
  }
}

/** The full range of a channel, behind the indicator. */
export class MeterTrackElement extends MeterPartElement {}

/** The lit part of the channel, scaled to the level along the meter's length. */
export class MeterIndicatorElement extends MeterChannelPartElement {
  override paint(snapshot: MeterSnapshot) {
    super.paint(snapshot);
    const horizontal = snapshot.orientation === "horizontal";
    Object.assign(this.style, {
      height: "100%",
      insetInlineStart: "0",
      transformOrigin: horizontal ? "left center" : "center bottom",
      width: "100%",
      willChange: "transform",
    });
  }
}

/** The peak-hold mark, at the channel's peak level; hidden while the channel has none. */
export class MeterPeakElement extends MeterChannelPartElement {}

/** The channel's formatted level (`format` and `locale` on the meter), as its text. */
export class MeterValueElement extends MeterChannelPartElement {
  readonly #text = new ValueText();

  protected override attached(meter: MeterElement) {
    this.#text.mount(this);
    super.attached(meter);
  }
}

/** The accessible label of the channel it sits in. */
export class MeterLabelElement extends MeterChannelPartElement {
  protected override attached(meter: MeterElement) {
    const { channel } = this;
    if (channel) {
      channel.labelId = ensureId(this, METER_TAGS.label);
      meter.paint();
    }
    this.setAttribute("role", "presentation");
  }

  protected override detached(meter: MeterElement) {
    const { channel } = this;
    if (channel?.labelId === this.id) {
      channel.labelId = undefined;
      meter.paint();
    }
  }
}

/**
 * A graduation of the level scale at `value`, such as -18 dB, placed along
 * the meter's length from its minimum: upward for a vertical meter,
 * rightward for a horizontal one. It sits directly in the meter, beside the
 * channels. Decorative: each channel says its own level.
 */
export class MeterMarkElement extends MeterPartElement {
  static readonly observedAttributes = ["value"];

  attributeChangedCallback() {
    this.root?.paint();
  }

  override paint(snapshot: MeterSnapshot) {
    const share = `${snapshot.config.position(numberAttribute(this, "value") ?? 0) * 100}%`;
    const vertical = snapshot.orientation === "vertical";
    Object.assign(this.style, {
      bottom: vertical ? share : "",
      insetInlineStart: vertical ? "" : share,
      position: "absolute",
    });
    reflect(this, {
      "aria-hidden": "true",
      "data-orientation": snapshot.orientation,
    });
  }
}
