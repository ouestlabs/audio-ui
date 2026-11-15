import type { RegistryItem } from "shadcn/schema";
import { primitiveItems } from "../../items";

export const primitives: RegistryItem[] = [
  ...primitiveItems(
    "knob",
    [
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/react"],
        files: ["react.tsx"],
        name: "react",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/vue", "vue"],
        files: ["vue.ts"],
        name: "vue",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/svelte", "svelte"],
        files: [
          "svelte/Arc.svelte",
          "svelte/Indicator.svelte",
          "svelte/Provider.svelte",
          "svelte/Root.svelte",
          "svelte/Thumb.svelte",
          "svelte/Track.svelte",
          "svelte/Value.svelte",
          "svelte/index.ts",
          "svelte/parts.ts",
        ],
        name: "svelte",
      },
      {
        dependencies: ["@audio-ui/core", "@ui-sdk/web"],
        files: ["web.ts"],
        name: "web",
      },
    ],
    "A rotary knob for one parameter: drag, wheel, keys, a log scale, a reset, and the change's source for an agent."
  ),
];
