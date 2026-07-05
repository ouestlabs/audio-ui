import type { RegistryItem } from "shadcn/schema";

export const hooks: RegistryItem[] = [
  {
    name: "use-mobile",
    type: "registry:hook",
    files: [
      {
        path: "hooks/use-mobile.ts",
        type: "registry:hook",
      },
    ],
  },
];
