import type { Registry } from "shadcn/schema";

export const components: Registry["items"] = [
  {
    name: "player",
    type: "registry:component",
    dependencies: ["zustand", "lucide-react"],
    registryDependencies: [
      "@audio/store",
      "@audio/html",
      "@audio/use-audio",
      "@audio/provider",
      "@audio/slider",
      "@shadcn/empty",
      "@shadcn/button",
      "@shadcn/dialog",
      "@shadcn/dropdown-menu",
      "@shadcn/input",
      "@shadcn/item",
      "@shadcn/scroll-area",
      "@shadcn/toggle",
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
    dependencies: ["zustand"],
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
    dependencies: ["zustand", "lucide-react"],
    registryDependencies: [
      "@audio/store",
      "@audio/html",
      "@audio/use-audio",
      "@audio/track",
      "@audio/provider",
      "@shadcn/empty",
      "@shadcn/button",
      "@shadcn/command",
      "@shadcn/dialog",
      "@shadcn/dropdown-menu",
      "@shadcn/input",
      "@shadcn/item",
      "@shadcn/scroll-area",
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
    dependencies: ["lucide-react"],
    registryDependencies: [
      "@audio/store",
      "@audio/html",
      "@audio/use-audio",
      "@audio/sortable-list",
      "@audio/provider",
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
    dependencies: ["lucide-react"],
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
];
