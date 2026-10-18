import * as glyphs from "./glyphs.ts";
import { createIcon } from "./icon.tsx";

export type { Glyph, Shape } from "./glyph.ts";
export { createIcon, type IconProps, type IconWeight } from "./icon.tsx";
export { glyphs };

export const BotIcon = createIcon(glyphs.bot, "BotIcon");
export const DevicesIcon = createIcon(glyphs.devices, "DevicesIcon");
export const ElementsIcon = createIcon(glyphs.elements, "ElementsIcon");
export const EngineIcon = createIcon(glyphs.engine, "EngineIcon");
export const HeadlessIcon = createIcon(glyphs.headless, "HeadlessIcon");
export const InstallationIcon = createIcon(
  glyphs.installation,
  "InstallationIcon"
);
export const IntroductionIcon = createIcon(
  glyphs.introduction,
  "IntroductionIcon"
);
export const PrimitivesIcon = createIcon(glyphs.primitives, "PrimitivesIcon");
export const RegistryIcon = createIcon(glyphs.registry, "RegistryIcon");
export const RoadmapIcon = createIcon(glyphs.roadmap, "RoadmapIcon");
export const SparkleIcon = createIcon(glyphs.sparkle, "SparkleIcon");
export const StartIcon = createIcon(glyphs.start, "StartIcon");
export const TokensIcon = createIcon(glyphs.tokens, "TokensIcon");
export const WorkstationIcon = createIcon(
  glyphs.workstation,
  "WorkstationIcon"
);
