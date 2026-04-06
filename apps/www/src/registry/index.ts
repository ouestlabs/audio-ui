import type { Registry } from "shadcn/schema";
import { blocks } from "@/registry/registry-blocks";
import { examples } from "@/registry/registry-examples";
import { hooks } from "@/registry/registry-hooks";
import { lib } from "@/registry/registry-lib";
import { ui } from "@/registry/registry-ui";
import { components } from "./registry-components";
import { themes } from "./registry-themes";
export const registry = {
  name: "shadcn/ui",
  homepage: "https://ui.shadcn.com",
  items: [
    ...components,
    ...ui,
    ...examples,
    ...themes,
    ...blocks,
    ...hooks,
    ...lib,
  ],
} satisfies Registry;
