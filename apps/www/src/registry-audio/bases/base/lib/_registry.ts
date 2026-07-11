import type { RegistryItem } from "shadcn/schema";

export const lib: RegistryItem[] = [
  {
    categories: ["lib", "audio", "playback-engine"],
    dependencies: [],
    description:
      "PlaybackEngine interface — the seam between the audio store and a device backend",
    files: [
      {
        path: "lib/playback-engine.ts",
        type: "registry:lib",
      },
    ],
    name: "playback-engine",
    registryDependencies: [],
    type: "registry:lib",
  },
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
    registryDependencies: ["@audio/playback-engine"],
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
    registryDependencies: ["@audio/html", "@audio/playback-engine"],
    type: "registry:lib",
  },
];
