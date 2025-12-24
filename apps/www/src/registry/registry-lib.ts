import type { Registry } from "shadcn/schema";

export const lib: Registry["items"] = [
  {
    name: "html",
    description: "HTML Audio Lib",
    type: "registry:lib",
    dependencies: [],
    registryDependencies: [],
    files: [{ path: "lib/html-audio.ts", type: "registry:lib" }],
    categories: ["lib", "audio", "html-audio"],
  },
  {
    name: "web",
    description: "Web Audio Lib",
    type: "registry:lib",
    dependencies: [],
    registryDependencies: [],
    files: [{ path: "lib/web-audio.ts", type: "registry:lib" }],
    categories: ["lib", "audio", "web-audio"],
  },
  {
    name: "store",
    description: "Audio store",
    type: "registry:lib",
    dependencies: ["zustand"],
    registryDependencies: ["@audio/html"],
    files: [{ path: "lib/audio-store.ts", type: "registry:lib" }],
    categories: ["lib", "audio", "store"],
  },
];
