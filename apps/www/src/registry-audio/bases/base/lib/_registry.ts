import type { RegistryItem } from "shadcn/schema";

export const lib: RegistryItem[] = [
  {
    categories: ["lib", "audio", "html-audio"],
    dependencies: [],
    description: "HTML Audio Lib",
    files: [
      {
        path: "lib/html-audio.ts",
        type: "registry:lib",
      },
    ],
    name: "html",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "web-audio"],
    dependencies: [],
    description: "Web Audio Lib",
    files: [
      {
        path: "lib/web-audio.ts",
        type: "registry:lib",
      },
    ],
    name: "web",
    registryDependencies: [],
    type: "registry:lib",
  },
  {
    categories: ["lib", "audio", "store"],
    dependencies: ["zustand"],
    description: "Audio store",
    files: [
      {
        path: "lib/audio-store.ts",
        type: "registry:lib",
      },
    ],
    name: "store",
    registryDependencies: ["@audio/html"],
    type: "registry:lib",
  },
];
