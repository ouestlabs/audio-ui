import { webAudio } from "@/lib/web-audio";

/** How the audio context trades latency for steadiness: what the browser makes it with. */
export type Latency = "interactive" | "balanced" | "playback";

export const LATENCIES: readonly {
  description: string;
  label: string;
  value: Latency;
}[] = [
  {
    description: "Plays a key the soonest, with the most to compute in time.",
    label: "Lowest",
    value: "interactive",
  },
  {
    description: "Between the two.",
    label: "Balanced",
    value: "balanced",
  },
  {
    description: "Waits longest, so a heavy set plays without breaking up.",
    label: "Steadiest",
    value: "playback",
  },
];

/** The workstation's own settings, kept in this browser, not in a project. */
export interface Settings {
  latency: Latency;
  /** The MIDI devices switched off, by name. */
  mutedMidi: readonly string[];
  /** The audio output, by device id: empty for the system's. */
  output: string;
}

const DEFAULTS: Settings = {
  latency: "interactive",
  mutedMidi: [],
  output: "",
};
const KEPT = "audio-ui-daw:settings";

export function readSettings(): Settings {
  if (typeof localStorage === "undefined") {
    return DEFAULTS;
  }
  try {
    return {
      ...DEFAULTS,
      ...(JSON.parse(localStorage.getItem(KEPT) ?? "{}") as Partial<Settings>),
    };
  } catch {
    return DEFAULTS;
  }
}

export function keepSettings(change: Partial<Settings>) {
  try {
    localStorage.setItem(
      KEPT,
      JSON.stringify({ ...readSettings(), ...change })
    );
  } catch {
    // Refused: the settings just won't come back.
  }
}

/** Gives the audio context the latency kept: call it before anything asks for the context, as the page opens. */
export function configureAudio() {
  webAudio.configure({ latencyHint: readSettings().latency });
}

/** An audio context that can play on another output than the system's: not every browser can. */
type Routable = AudioContext & { setSinkId: (id: string) => Promise<void> };

const routable = (ctx: AudioContext | null): ctx is Routable =>
  ctx !== null && "setSinkId" in ctx;

/** Whether this browser can pick the output the workstation plays on. */
export const canPickOutput = () =>
  typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype;

/** Plays on the output `id`, the system's when empty. A device gone since plays on the system's. */
export async function playOn(id: string) {
  const ctx = webAudio.getContext();
  if (!routable(ctx)) {
    return;
  }
  try {
    await ctx.setSinkId(id);
  } catch {
    await ctx.setSinkId("").catch(() => undefined);
  }
}
