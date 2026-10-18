import * as glyphs from "./glyphs.ts";
import { createIcon } from "./icon.tsx";

export type { Glyph, Shape } from "./glyph.ts";
export { createIcon, type IconProps, type IconWeight } from "./icon.tsx";
export { glyphs };

export const BotIcon = createIcon(glyphs.bot, "BotIcon");
export const RackIcon = createIcon(glyphs.rack, "RackIcon");
export const KnobIcon = createIcon(glyphs.knob, "KnobIcon");
export const WaveformIcon = createIcon(glyphs.waveform, "WaveformIcon");
export const BracesIcon = createIcon(glyphs.braces, "BracesIcon");
export const DownloadIcon = createIcon(glyphs.download, "DownloadIcon");
export const InfoIcon = createIcon(glyphs.info, "InfoIcon");
export const ShapesIcon = createIcon(glyphs.shapes, "ShapesIcon");
export const BoxIcon = createIcon(glyphs.box, "BoxIcon");
export const RouteIcon = createIcon(glyphs.route, "RouteIcon");
export const SparkleIcon = createIcon(glyphs.sparkle, "SparkleIcon");
export const FlagIcon = createIcon(glyphs.flag, "FlagIcon");
export const DropIcon = createIcon(glyphs.drop, "DropIcon");
export const TracksIcon = createIcon(glyphs.tracks, "TracksIcon");
