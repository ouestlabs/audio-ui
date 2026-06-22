import type { RegistryItem } from "shadcn/schema";
import { THEMES } from "@/registry/themes";

export const themes: RegistryItem[] = THEMES.map((theme) => ({
  name: `theme-${theme.name}`,
  type: "registry:theme",
  cssVars: theme.cssVars,
}));
