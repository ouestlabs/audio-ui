import type { Registry } from "shadcn/schema";

export const hooks: Registry["items"] = [
  {
    files: [
      {
        path: "hooks/use-mobile.ts",
        type: "registry:hook",
      },
    ],
    name: "use-mobile",
    type: "registry:hook",
  },
];
