import type { Registry } from "shadcn/schema";

export const hooks: Registry["items"] = [
  {
    name: "hooks",
    type: "registry:hook",
    registryDependencies: ["@audio/use-audio", "@audio/use-sound"],
  },
  {
    name: "use-audio",
    type: "registry:hook",
    registryDependencies: ["@audio/html", "@audio/web"],
    files: [{ path: "hooks/use-audio.ts", type: "registry:hook" }],
    categories: ["audio"],
  },
  {
    name: "use-sound",
    type: "registry:hook",
    registryDependencies: ["@audio/use-audio"],
    files: [{ path: "hooks/use-sound.ts", type: "registry:hook" }],
    categories: ["audio", "sound"],
  },
];
