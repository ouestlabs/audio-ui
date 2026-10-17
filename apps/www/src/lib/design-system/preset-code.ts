import {
  decodePreset,
  encodePreset,
  isPresetCode,
  type PresetConfig,
} from "shadcn/preset";
import { DEFAULT_CONFIG } from "@/registry/config";

/** What a preset code holds: the design system choices, and nothing about the page. */
export const PRESET_KEYS = [
  "baseColor",
  "chartColor",
  "font",
  "fontHeading",
  "iconLibrary",
  "menuAccent",
  "menuColor",
  "radius",
  "style",
  "theme",
] as const satisfies readonly (keyof PresetConfig)[];

type PresetKey = (typeof PRESET_KEYS)[number];
export type PresetValues = Pick<PresetConfig, PresetKey>;

/** The code of a design: short, and the same one shadcn reads (`npx shadcn preset decode <code>`). */
export function getPresetCode(values: Partial<Record<PresetKey, string>>) {
  const full: Record<string, unknown> = {};
  for (const key of PRESET_KEYS) {
    full[key] = values[key] ?? DEFAULT_CONFIG[key];
  }
  return encodePreset(full as Partial<PresetConfig>);
}

export const DEFAULT_PRESET_CODE = getPresetCode({});

/** The design a code stands for, or null when it is not a code. */
export function readPresetCode(code: string): PresetValues | null {
  return isPresetCode(code) ? decodePreset(code) : null;
}

const PRESET_FLAG = /^--preset\s+(.+)$/i;

/** A code as a reader pastes it: bare, or with the `--preset` flag of the command. */
export function parsePresetInput(value: string) {
  const input = value.trim();
  const code = input.match(PRESET_FLAG)?.[1]?.trim() ?? input;
  return readPresetCode(code) ? code : null;
}
