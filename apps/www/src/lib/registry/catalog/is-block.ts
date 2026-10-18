import { audio } from "../../../registry-audio/bases/base/audio/_registry";
import { components } from "../../../registry-audio/bases/base/components/_registry";
import { hooks } from "../../../registry-audio/bases/base/hooks/_registry";
import { lib } from "../../../registry-audio/bases/base/lib/_registry";

/** A block is laid out for a page, not a card: its preview is as tall as it is. */
export const isBlock = (name: string) => name.startsWith("block-");

/**
 * The previews that can be opened at full size: the editors made to take a
 * whole screen, and the plots, which are all the better for the room. A block
 * that fits a card does not need it.
 */
const EXPANDABLE = new Set([
  "block-piano-roll",
  "block-timeline",
  "plot-compressor-demo",
  "plot-demo",
  "plot-filter-demo",
]);

export const isExpandable = (name: string) => EXPANDABLE.has(name);

/** The previews that play from a keyboard: their bar gets a button to connect a MIDI one. */
const MIDI = new Set([
  "block-piano-roll",
  "piano-size-default-demo",
  "spectrum-analyzer-demo",
]);

export const takesMidi = (name: string) => MIDI.has(name);

const NAMESPACE = "@audio-ui/";
const PLAY_SWITCH = "use-play-switch";

/** Every registry item by name: what a preview installs is what tells how it is played. */
const ITEMS = new Map(
  [...audio, ...components, ...hooks, ...lib].map((item) => [item.name, item])
);

/** Whether an item, or anything it installs, is `target`. */
function reaches(
  name: string,
  target: string,
  seen = new Set<string>()
): boolean {
  if (name === target) {
    return true;
  }
  if (seen.has(name)) {
    return false;
  }
  seen.add(name);
  return (ITEMS.get(name)?.registryDependencies ?? []).some(
    (dependency) =>
      dependency.startsWith(NAMESPACE) &&
      reaches(dependency.slice(NAMESPACE.length), target, seen)
  );
}

/**
 * The previews that follow the play switch of their session, which is to say
 * the ones that install `use-play-switch`: a device with a loop, a plot with
 * a noise. They show a signal and make no button of their own, so their bar
 * gets the one that plays it. Read from the registry, so a new preview that
 * installs the hook has its button without a list to keep.
 */
export const takesPlay = (name: string) => reaches(name, PLAY_SWITCH);

/** The previews that can show your own sound: their bar gets a button that turns the microphone on. */
const MICROPHONE = new Set([
  "needle-meter-demo",
  "tuner-demo",
  "waveform-live-demo",
]);

export const takesMicrophone = (name: string) => MICROPHONE.has(name);
