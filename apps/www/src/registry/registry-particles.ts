import type { Registry } from "shadcn/schema";

export const particles: Registry["items"] = [
  {
    name: "particle-player",
    description: "Audio player",
    type: "registry:block",
    registryDependencies: [
      "@audio/player",
      "@audio/queue",
      "@audio/store",
      "@audio/html",
    ],
    files: [{ path: "particles/particle-player.tsx", type: "registry:block" }],
    categories: ["player", "queue"],
  },
  {
    name: "particle-player-widget",
    description: "Audio player widget",
    type: "registry:block",
    registryDependencies: [
      "@audio/provider",
      "@audio/player",
      "@audio/queue",
      "@audio/track",
      "@audio/store",
      "@audio/html",
    ],
    files: [
      { path: "particles/particle-player-widget.tsx", type: "registry:block" },
    ],
    categories: ["player", "widget"],
  },
  {
    name: "particle-pocket-synth",
    description: "Pocket synth",
    type: "registry:block",
    registryDependencies: [
      "@audio/use-audio",
      "@audio/fader",
      "@audio/xypad",
      "@shadcn/toggle-group",
    ],
    files: [
      { path: "particles/particle-pocket-synth.tsx", type: "registry:block" },
    ],
    categories: ["synth"],
  },
];
