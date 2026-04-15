import type { Registry } from "shadcn/schema";

export const components: Registry["items"] = [
  {
    name: "player",
    type: "registry:component",
    dependencies: [
      "@phosphor-icons/react",
      "class-variance-authority",
      "@base-ui/react",
    ],
    registryDependencies: [
      "@audio/store",
      "@audio/html",
      "@audio/use-audio",
      "@audio/use-audio-provider",
      "@audio/fader",
      "@audio/transport",
      "@audio/sortable-list",
      "@shadcn/button",
      "@shadcn/dropdown-menu",
      "@shadcn/spinner",
      "@shadcn/tooltip",
      "@shadcn/command",
      "@shadcn/dialog",
      "@shadcn/toggle",
      "@shadcn/badge",
      "@shadcn/empty",
      "@shadcn/avatar",
      "@shadcn/item",
      "@shadcn/scroll-area",
    ],
    files: [
      {
        path: "ui/audio/player.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "channel-strip",
    type: "registry:component",
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "ui/audio/elements/channel-strip.tsx",
        type: "registry:component",
      },
    ],
  },
];
