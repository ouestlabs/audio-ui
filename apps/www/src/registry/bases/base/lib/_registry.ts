import type { Registry } from "shadcn/schema";

export const lib: Registry["items"] = [
  {
    dependencies: ["cn"],
    files: [
      {
        path: "lib/utils.ts",
        type: "registry:lib",
      },
    ],
    name: "utils",
    type: "registry:lib",
  },
];
