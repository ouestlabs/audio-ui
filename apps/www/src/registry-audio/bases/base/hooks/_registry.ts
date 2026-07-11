import type { RegistryItem } from "shadcn/schema";

export const hooks: RegistryItem[] = [
  {
    name: "hooks",
    registryDependencies: [
      "@audio/use-html-audio",
      "@audio/use-web-audio",
      "@audio/use-sound",
    ],
    type: "registry:hook",
  },
  {
    categories: ["audio", "html-audio"],
    files: [
      {
        path: "hooks/use-html-audio.ts",
        type: "registry:hook",
      },
    ],
    name: "use-html-audio",
    registryDependencies: ["@audio/html"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "web-audio"],
    files: [
      {
        path: "hooks/use-web-audio.ts",
        type: "registry:hook",
      },
    ],
    name: "use-web-audio",
    registryDependencies: ["@audio/web"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "sound"],
    files: [
      {
        path: "hooks/use-sound.ts",
        type: "registry:hook",
      },
    ],
    name: "use-sound",
    registryDependencies: ["@audio/use-web-audio"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "sequencer"],
    files: [
      {
        path: "hooks/use-step-clock.ts",
        type: "registry:hook",
      },
    ],
    name: "use-step-clock",
    type: "registry:hook",
  },
  {
    categories: ["audio", "meter"],
    files: [
      {
        path: "hooks/use-audio-levels.ts",
        type: "registry:hook",
      },
    ],
    name: "use-audio-levels",
    type: "registry:hook",
  },
];
