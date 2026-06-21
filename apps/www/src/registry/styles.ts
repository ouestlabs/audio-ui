// The canonical source tree all styles fall back to (base-luma look).
export const BASE_STYLE_DIR = "default";

// Base UI styles audio/ui serves. Each maps to a public/r/<style>/ output folder.
// A style only differs from base-luma if override files exist under
// src/registry/<style>/...; otherwise it falls back to BASE_STYLE_DIR.
export const STYLES = [
  "base-luma",
  "base-nova",
  "base-vega",
  "base-maia",
  "base-lyra",
  "base-mira",
] as const;

export type Style = (typeof STYLES)[number];
