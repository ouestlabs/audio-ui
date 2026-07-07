import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

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

export type CatalogGridMode = 1 | 2;

export type Config = {
  // App preferences (not synced with URL)
  packageManager: "npm" | "yarn" | "pnpm" | "bun";
  installationType: "cli" | "manual";
  gridColumns: CatalogGridMode;

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
  base: "base",
  baseColor: "neutral",
  chartColor: "sky",
  custom: false,
  customizerOpen: true,
  font: "inter",
  fontHeading: "inherit",
  gridColumns: 2,
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

export function useConfig() {
  return useAtom(configAtom);
}

export interface ComponentsLayoutState {
  activeCategory?: string;
  sidebarMenuView?: "menu" | "inline";
  sidebarOpen: boolean;
}

const componentsLayoutStateAtom = atomWithStorage<ComponentsLayoutState>(
  "components-layout",
  {
    sidebarMenuView: "menu",
    sidebarOpen: true,
  }
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
