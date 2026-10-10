import type { RegistryItem } from "shadcn/schema";

export const hooks: RegistryItem[] = [
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
    categories: ["audio", "sequencer", "piano"],
    files: [
      {
        path: "hooks/use-transport-clock.ts",
        type: "registry:hook",
      },
    ],
    name: "use-transport-clock",
    registryDependencies: [
      "@audio/use-web-audio",
      "@audio/lookahead-scheduler",
    ],
    type: "registry:hook",
  },
  {
    categories: ["audio", "synth", "sequencer"],
    files: [
      {
        path: "hooks/use-master-bus.ts",
        type: "registry:hook",
      },
    ],
    name: "use-master-bus",
    registryDependencies: ["@audio/use-web-audio"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "synth", "piano", "envelope"],
    files: [
      {
        path: "hooks/use-synth-voices.ts",
        type: "registry:hook",
      },
    ],
    name: "use-synth-voices",
    registryDependencies: ["@audio/synth-voice"],
    type: "registry:hook",
  },
  {
    categories: ["audio", "piano", "synth"],
    files: [
      {
        path: "hooks/use-midi-input.ts",
        type: "registry:hook",
      },
    ],
    name: "use-midi-input",
    registryDependencies: ["@audio/midi"],
    type: "registry:hook",
  },
];
