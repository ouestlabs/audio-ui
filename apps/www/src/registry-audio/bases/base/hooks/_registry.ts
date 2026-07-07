import type { RegistryItem } from "shadcn/schema";

export const hooks: RegistryItem[] = [
  {
    name: "hooks",
    registryDependencies: ["@audio/use-audio", "@audio/use-sound"],
    type: "registry:hook",
  },
  {
    categories: ["audio"],
    files: [
      {
        path: "hooks/use-audio.ts",
        type: "registry:hook",
      },
    ],
    name: "use-audio",
    registryDependencies: ["@audio/html", "@audio/web"],
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
    registryDependencies: ["@audio/use-audio"],
    type: "registry:hook",
  },
];
