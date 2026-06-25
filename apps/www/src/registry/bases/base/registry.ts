import type { Registry } from "shadcn/schema";
import { THEMES } from "@/registry/themes";
import { blocks } from "./blocks/_registry";
import { components } from "./components/_registry";
import { examples } from "./examples/_registry";
import { hooks } from "./hooks/_registry";
import { lib } from "./lib/_registry";
import { ui } from "./ui/_registry";

const BASE_STYLE = {
  type: "registry:style" as const,
  dependencies: [
    "@audio-ui/react",
    "@base-ui/react",
    "class-variance-authority",
    "@phosphor-icons/react",
  ],
  devDependencies: ["tw-animate-css"],
  registryDependencies: ["utils"],
  css: {
    "@layer base": {
      "*": {
        "@apply border-border outline-ring/50": {},
      },
      body: {
        "@apply bg-background text-foreground": {},
      },
    },
  },
  cssVars: {},
  files: [],
};

const themes: Registry["items"] = THEMES.map((theme) => ({
  name: `theme-${theme.name}`,
  type: "registry:theme",
  cssVars: theme.cssVars,
}));

export const registry = {
  name: "audio/ui",
  homepage: "https://audio-ui.xyz",
  items: [
    { name: "index", ...BASE_STYLE },
    { name: "style", ...BASE_STYLE },
    ...ui,
    ...examples,
    ...lib,
    ...components,
    ...blocks,
    ...hooks,
    ...themes,
  ],
} satisfies Registry;
