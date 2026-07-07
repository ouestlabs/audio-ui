import type { Registry } from "shadcn/schema";

export const lib: Registry["items"] = [
  {
    dependencies: ["clsx", "tailwind-merge"],
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
