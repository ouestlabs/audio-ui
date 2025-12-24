import type { Registry } from "shadcn/schema";

export const ui: Registry["items"] = [
  {
    name: "ui",
    type: "registry:ui",
    registryDependencies: ["@audio/slider", "@audio/sortable-list"],
  },
  {
    name: "slider",
    type: "registry:ui",
    dependencies: ["radix-ui"],
    registryDependencies: [],
    files: [
      {
        path: "ui/slider.tsx",
        type: "registry:ui",
      },
    ],
  },
  {
    name: "sortable-list",
    type: "registry:ui",
    dependencies: [
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "lucide-react",
    ],
    registryDependencies: ["@shadcn/button"],
    files: [
      {
        path: "ui/sortable-list.tsx",
        type: "registry:ui",
      },
    ],
  },
  {
    name: "knob",
    type: "registry:ui",
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "ui/audio/elements/knob.tsx",
        type: "registry:ui",
      },
    ],
  },
  {
    name: "fader",
    type: "registry:ui",
    dependencies: ["@audio-ui/react"],
    files: [
      {
        path: "ui/audio/elements/fader.tsx",
        type: "registry:ui",
      },
    ],
  },
  {
    name: "xypad",
    type: "registry:ui",
    dependencies: ["@audio-ui/react"],
    files: [{ path: "ui/audio/elements/xypad.tsx", type: "registry:ui" }],
  },
];
