import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage, selectAtom } from "jotai/utils";

import type {
  BaseColorName,
  BaseName,
  ChartColorName,
  FontHeadingValue,
  FontValue,
  IconLibraryName,
  MenuAccentValue,
  MenuColorValue,
  RadiusValue,
  StyleName,
  ThemeName,
} from "@/registry/config";

export type Config = {
  // App preferences (not synced with URL)
  packageManager: "npm" | "yarn" | "pnpm" | "bun";
  installationType: "agent" | "cli" | "manual";

  // Design system params (synced with URL)
  base: BaseName;
  style: StyleName;
  theme: ThemeName;
  baseColor: BaseColorName;
  chartColor: ChartColorName;
  font: FontValue;
  fontHeading: FontHeadingValue;
  iconLibrary: IconLibraryName;
  menuAccent: MenuAccentValue;
  menuColor: MenuColorValue;
  radius: RadiusValue;
  item: string;
  template: "next" | "start" | "vite";
  size: number;
  custom: boolean;
  customizerOpen: boolean;
};

export const DEFAULT_CONFIG: Config = {
  // Design system defaults (matching DEFAULT_CONFIG from registry/config.ts)
  base: "ui-sdk",
  baseColor: "neutral",
  chartColor: "neutral",
  custom: false,
  customizerOpen: true,
  font: "geist",
  fontHeading: "geist-mono",
  iconLibrary: "lucide",
  installationType: "cli",
  item: "preview",
  menuAccent: "subtle",
  menuColor: "default",
  // App preferences
  packageManager: "pnpm",
  radius: "default",
  size: 100,
  style: "nova",
  template: "next",
  theme: "neutral",
};

export const configAtom = atomWithStorage<Config>(
  "config",
  DEFAULT_CONFIG,
  undefined,
  { getOnInit: true }
);

/** The base the reader chose, kept in their browser: null on the server, where the pages are prerendered for the default one. */
export function keptBase(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem("config") ?? "null");
    return typeof stored?.base === "string" ? stored.base : null;
  } catch {
    return null;
  }
}

const baseAtom = selectAtom(configAtom, (config) => config?.base);

/** Only the component library: a change to anything else in the config leaves the reader alone. */
export function useConfigBase() {
  return useAtomValue(baseAtom);
}

export function useConfig() {
  return useAtom(configAtom);
}

export interface ComponentsLayoutState {
  activeCategory?: string;
  sidebarOpen: boolean;
}

const componentsLayoutStateAtom = atomWithStorage<ComponentsLayoutState>(
  "components-layout",
  {
    sidebarOpen: true,
  },
  undefined,
  { getOnInit: true }
);

export function useComponentsLayoutState() {
  return useAtom(componentsLayoutStateAtom);
}

// Blocks states configuration
export interface BlocksState {
  activeCategory?: string;
  sidebarOpen: boolean;
}

const blocksStateAtom = atomWithStorage<BlocksState>("blocks-state", {
  sidebarOpen: true,
});

export function useBlocksState() {
  return useAtom(blocksStateAtom);
}
