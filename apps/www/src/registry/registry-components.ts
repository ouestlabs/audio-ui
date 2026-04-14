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
      "@audio/provider",
      "@audio/fader",
      "@audio/transport",
      "@shadcn/button",
      "@shadcn/dropdown-menu",
      "@shadcn/spinner",
      "@shadcn/tooltip",
    ],
    files: [
      {
        path: "ui/audio/player.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "provider",
    type: "registry:component",
    registryDependencies: ["@audio/store", "@audio/html", "@audio/use-audio"],
    files: [
      {
        path: "ui/audio/provider.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "queue",
    type: "registry:component",
    dependencies: ["@phosphor-icons/react"],
    registryDependencies: [
      "@audio/store",
      "@audio/track",
      "@shadcn/button",
      "@shadcn/command",
      "@shadcn/dialog",
      "@shadcn/dropdown-menu",
      "@shadcn/toggle",
      "@shadcn/tooltip",
    ],
    files: [
      {
        path: "ui/audio/queue.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "track",
    type: "registry:component",
    dependencies: ["@phosphor-icons/react", "class-variance-authority"],
    registryDependencies: [
      "@audio/store",
      "@audio/html",
      "@audio/use-audio",
      "@audio/sortable-list",
      "@shadcn/badge",
      "@shadcn/empty",
      "@shadcn/avatar",
      "@shadcn/button",
      "@shadcn/item",
      "@shadcn/scroll-area",
    ],
    files: [
      {
        path: "ui/audio/track.tsx",
        type: "registry:component",
      },
    ],
  },
  {
    name: "playback-speed",
    type: "registry:component",
    dependencies: ["@phosphor-icons/react"],
    registryDependencies: [
      "@audio/store",
      "@audio/html",
      "@audio/use-audio",
      "@shadcn/button",
      "@shadcn/dropdown-menu",
      "@shadcn/tooltip",
    ],
    files: [
      {
        path: "ui/audio/playback-speed.tsx",
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
