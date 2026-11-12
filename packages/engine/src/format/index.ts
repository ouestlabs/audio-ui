/**
 * Audio quantities as text, the way the standards and the tools write them:
 * levels as `-23.0 LUFS` (EBU R128, ITU-R BS.1770), `-1.0 dBTP`, `-6.0 dBFS`;
 * a number and its unit apart by a space (SI, ISO 80000); `kHz` with a small
 * k; times as `m:ss.mmm`; a middle C of `C4`; a pan as `L30`, `C`, `R30`.
 * Each is a function of the value and options, and `createFormatter` binds
 * the options you always want (a locale, a true minus, a thin space) once.
 */

/** What every formatter takes, over its own defaults. */
export interface FormatOptions {
  /** How many decimals. Each quantity has its own default; a trailing zero is kept, so a column lines up. */
  decimals?: number;
  /** The locale of the decimal mark: `"en"` writes a point, `"fr"` a comma. Defaults to a point, whatever the browser's. */
  locale?: Intl.LocalesArgument;
  /** `"unicode"` writes a negative with U+2212, the typographic minus, in place of the hyphen. Defaults to the hyphen, which is what a keyboard types and a file keeps. */
  minus?: "hyphen" | "unicode";
  /** Whether a positive value carries a `+`. Defaults to no, but for the quantities that are a difference (a gain, a pitch shift). */
  sign?: boolean;
  /** The text between a number and its unit. Defaults to a space; `" "` a narrow no-break one, `""` none. */
  space?: string;
  /** `false` writes the number alone, with no unit. */
  unit?: boolean;
}

const DEFAULTS = {
  locale: "en",
  minus: "hyphen",
  space: " ",
  unit: true,
} as const;

/** The options a call resolves to: its own over the formatter's. */
type Resolved = Required<
  Pick<FormatOptions, "locale" | "minus" | "space" | "unit">
> &
  Pick<FormatOptions, "decimals" | "sign">;

const resolve = (options: FormatOptions = {}): Resolved => ({
  decimals: options.decimals,
  locale: options.locale ?? DEFAULTS.locale,
  minus: options.minus ?? DEFAULTS.minus,
  sign: options.sign,
  space: options.space ?? DEFAULTS.space,
  unit: options.unit ?? DEFAULTS.unit,
});

const MINUS = "−";

/** The sign a negative is written with. */
const dash = (minus: "hyphen" | "unicode") =>
  minus === "unicode" ? MINUS : "-";

/** A flat in a note's name: a letter, then `b`. */
const FLAT_NAME = /(.)b/;

/** A number with `decimals` places, its sign as the options say. Never `-0.0`: a value that rounds to zero has no sign. */
function number(
  value: number,
  decimals: number,
  { locale, minus, sign }: Resolved,
  trim = false
): string {
  const text = new Intl.NumberFormat(locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: trim ? 0 : decimals,
    useGrouping: false,
  }).format(Math.abs(value));
  const isZero = Number(Math.abs(value).toFixed(decimals)) === 0;
  if (value < 0 && !isZero) {
    return `${dash(minus)}${text}`;
  }
  return sign && value > 0 && !isZero ? `+${text}` : text;
}

/** A number, then its unit with the space between, or the number alone. */
const withUnit = (text: string, unit: string, o: Resolved) =>
  o.unit ? `${text}${o.space}${unit}` : text;

// MARK: Levels

/** The units of a level: decibels of a gain, of full scale, of a true peak, of a voltage; loudness in LUFS and its range in LU. */
export type LevelUnit =
  | "dB"
  | "dBA"
  | "dBFS"
  | "dBTP"
  | "dBu"
  | "dBV"
  | "LU"
  | "LUFS";

/** The units a gain is shown with a sign in: a difference, not a level. */
const SIGNED = new Set<LevelUnit>(["dB", "LU"]);

/**
 * A level or a gain: `-6.0 dBFS`, `-23.0 LUFS`, `+3.0 dB`, `-1.0 dBTP`. One
 * decimal, as EBU R128 and audio meters write it. Silence, `-Infinity`, is
 * `-∞`; `NaN` is empty. A gain in `dB` or a range in `LU` carries a `+` when
 * positive, unless `sign: false`.
 */
export function formatLevel(
  value: number,
  unit: LevelUnit = "dB",
  options?: FormatOptions
): string {
  const o = resolve(options);
  if (Number.isNaN(value)) {
    return "";
  }
  const signed = { ...o, sign: o.sign ?? SIGNED.has(unit) };
  if (value === Number.NEGATIVE_INFINITY) {
    return withUnit(`${dash(o.minus)}∞`, unit, o);
  }
  if (value === Number.POSITIVE_INFINITY) {
    return withUnit("∞", unit, o);
  }
  return withUnit(number(value, o.decimals ?? 1, signed), unit, o);
}

// MARK: Frequency

/** How a frequency is written: by size (`auto`), always in hertz, or always in kilohertz. */
export type FrequencyStyle = "auto" | "hz" | "khz";

/**
 * A frequency: `120 Hz`, `1.2 kHz`, `12 kHz`. By size, as a meter or a plot
 * labels it: under 1 kHz in hertz, to 10 kHz with a decimal, above it whole.
 * `style` fixes the unit; `decimals` fixes the places.
 */
export function formatFrequency(
  hz: number,
  style: FrequencyStyle = "auto",
  options?: FormatOptions
): string {
  const o = resolve(options);
  if (!Number.isFinite(hz)) {
    return "";
  }
  const khz = style === "khz" || (style === "auto" && Math.abs(hz) >= 1000);
  if (!khz) {
    return withUnit(number(hz, o.decimals ?? 0, o), "Hz", o);
  }
  const places = o.decimals ?? (Math.abs(hz) >= 10_000 ? 0 : 1);
  return withUnit(number(hz / 1000, places, o), "kHz", o);
}

/** A sample rate: `44.1 kHz`, `48 kHz`, `11.025 kHz`: in kilohertz, with the places it needs and no more. */
export function formatSampleRate(
  rate: number,
  options?: FormatOptions
): string {
  const o = resolve(options);
  if (!Number.isFinite(rate)) {
    return "";
  }
  return withUnit(number(rate / 1000, o.decimals ?? 3, o, true), "kHz", o);
}

// MARK: Time

/** How a time is written: a clock to the second, a clock to the millisecond, or a length in seconds. */
export type TimeStyle = "clock" | "precise" | "seconds";

/**
 * A time: `1:05` (`clock`), `1:05.250` (`precise`, to the millisecond, with
 * hours past an hour: `1:02:03.500`), or `65.25 s` (`seconds`). Negative
 * times keep their sign; `NaN` is empty.
 */
export function formatTime(
  seconds: number,
  style: TimeStyle = "clock",
  options?: FormatOptions
): string {
  const o = resolve(options);
  if (!Number.isFinite(seconds)) {
    return "";
  }
  if (style === "seconds") {
    return withUnit(number(seconds, o.decimals ?? 2, o), "s", o);
  }
  const sign = seconds < 0 ? dash(o.minus) : "";
  const places = style === "precise" ? (o.decimals ?? 3) : 0;
  const scale = 10 ** places;
  const total = Math.round(Math.abs(seconds) * scale) / scale;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const whole = Math.floor(rest);
  const fraction =
    places > 0
      ? new Intl.NumberFormat(o.locale, {
          maximumFractionDigits: places,
          minimumFractionDigits: places,
          useGrouping: false,
        })
          .format(rest - whole)
          .slice(1)
      : "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const head = hours > 0 ? `${hours}:${pad(minutes)}` : String(minutes);
  return `${sign}${head}:${pad(whole)}${fraction}`;
}

/** A length of time by its size: `120 ms` under a second, `1.25 s` above. */
export function formatDuration(
  seconds: number,
  options?: FormatOptions
): string {
  const o = resolve(options);
  if (!Number.isFinite(seconds)) {
    return "";
  }
  if (Math.abs(seconds) < 1) {
    return withUnit(number(seconds * 1000, o.decimals ?? 0, o), "ms", o);
  }
  return withUnit(number(seconds, o.decimals ?? 2, o, true), "s", o);
}

// MARK: Music

/** The tempo, `120 BPM`, with a decimal only when it has one. */
export function formatTempo(bpm: number, options?: FormatOptions): string {
  const o = resolve(options);
  if (!Number.isFinite(bpm)) {
    return "";
  }
  return withUnit(number(bpm, o.decimals ?? 1, o, true), "BPM", o);
}

/** How a note is spelled: sharps or flats, the octave of the middle C (`4` in scientific pitch, `3` on Yamaha's), and the typographic ♯ and ♭ or plain `#` and `b`. */
export interface NoteOptions extends FormatOptions {
  accidentals?: "flat" | "sharp";
  /** The octave number of MIDI note 60. Defaults to 4, scientific pitch notation. */
  middleC?: number;
  /** Write ♯ and ♭ in place of `#` and `b`. */
  symbols?: boolean;
}

const SHARPS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** A MIDI note as a name: `60` is `C4`, `61` `C#4`, `69` `A4`. */
export function formatNote(midi: number, options: NoteOptions = {}): string {
  if (!Number.isFinite(midi)) {
    return "";
  }
  const rounded = Math.round(midi);
  const names = options.accidentals === "flat" ? FLATS : SHARPS;
  const octave = Math.floor(rounded / 12) - 1 + ((options.middleC ?? 4) - 4);
  const name = names[((rounded % 12) + 12) % 12] ?? "C";
  const written = options.symbols
    ? name.replace("#", "♯").replace(FLAT_NAME, "$1♭")
    : name;
  return `${written}${octave}`;
}

// MARK: Mix

/** How a pan is written: `L30`, `C`, `R30` (`lr`), or a signed number, `-30`, `0`, `+30` (`signed`). */
export type PanStyle = "lr" | "signed";

/** A pan from -1 (left) to 1 (right) as a percentage of the way: `L50`, `C`, `R100`. A pan within half a percent of the middle is `C`. */
export function formatPan(
  pan: number,
  style: PanStyle = "lr",
  options?: FormatOptions
): string {
  const o = resolve(options);
  if (!Number.isFinite(pan)) {
    return "";
  }
  const percent = Math.round(Math.max(-1, Math.min(1, pan)) * 100);
  if (style === "signed") {
    return number(percent, 0, { ...o, sign: o.sign ?? true });
  }
  if (percent === 0) {
    return "C";
  }
  return `${percent < 0 ? "L" : "R"}${number(Math.abs(percent), 0, o)}`;
}

/** A share as a percentage. `from` says what the value is: a `ratio` (0.5) or already a `percent` (50). */
export function formatPercent(
  value: number,
  from: "percent" | "ratio" = "ratio",
  options?: FormatOptions
): string {
  const o = resolve(options);
  if (!Number.isFinite(value)) {
    return "";
  }
  const percent = from === "ratio" ? value * 100 : value;
  return withUnit(number(percent, o.decimals ?? 0, o), "%", o).replace(
    `${o.space}%`,
    o.unit ? "%" : ""
  );
}

/** A compressor's ratio: `4.0:1`, and `∞:1` for a limiter. */
export function formatRatio(ratio: number, options?: FormatOptions): string {
  const o = resolve(options);
  if (Number.isNaN(ratio)) {
    return "";
  }
  if (!Number.isFinite(ratio)) {
    return "∞:1";
  }
  return `${number(ratio, o.decimals ?? 1, o)}:1`;
}

/** The layout of a sound by its channel count: `mono`, `stereo`, `quad`, `5.1`, `7.1`; any other count as `N ch`. */
export function formatChannels(count: number): string {
  const names: Record<number, string> = {
    1: "mono",
    2: "stereo",
    4: "quad",
    6: "5.1",
    8: "7.1",
  };
  return names[count] ?? `${count} ch`;
}

// MARK: A formatter

/** The formatters of this module with options bound: each call may still override them. */
export interface Formatter {
  channels: typeof formatChannels;
  duration: (seconds: number, options?: FormatOptions) => string;
  frequency: (
    hz: number,
    style?: FrequencyStyle,
    options?: FormatOptions
  ) => string;
  level: (value: number, unit?: LevelUnit, options?: FormatOptions) => string;
  note: (midi: number, options?: NoteOptions) => string;
  pan: (pan: number, style?: PanStyle, options?: FormatOptions) => string;
  percent: (
    value: number,
    from?: "percent" | "ratio",
    options?: FormatOptions
  ) => string;
  ratio: (ratio: number, options?: FormatOptions) => string;
  sampleRate: (rate: number, options?: FormatOptions) => string;
  tempo: (bpm: number, options?: FormatOptions) => string;
  time: (seconds: number, style?: TimeStyle, options?: FormatOptions) => string;
}

/**
 * A set of formatters that share their options: a locale, a true minus, a
 * thin space, a note spelling. `createFormatter({ locale: "fr", minus:
 * "unicode" }).level(-23, "LUFS")` is `−23,0 LUFS`.
 */
export function createFormatter(defaults: NoteOptions = {}): Formatter {
  const over = <T extends FormatOptions>(options?: T) => ({
    ...defaults,
    ...options,
  });
  return {
    channels: formatChannels,
    duration: (seconds, options) => formatDuration(seconds, over(options)),
    frequency: (hz, style, options) =>
      formatFrequency(hz, style, over(options)),
    level: (value, unit, options) => formatLevel(value, unit, over(options)),
    note: (midi, options) => formatNote(midi, over(options)),
    pan: (pan, style, options) => formatPan(pan, style, over(options)),
    percent: (value, from, options) =>
      formatPercent(value, from, over(options)),
    ratio: (ratio, options) => formatRatio(ratio, over(options)),
    sampleRate: (rate, options) => formatSampleRate(rate, over(options)),
    tempo: (bpm, options) => formatTempo(bpm, over(options)),
    time: (seconds, style, options) =>
      formatTime(seconds, style, over(options)),
  };
}
