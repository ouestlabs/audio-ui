import type { Registry } from "shadcn/schema";

export const ui: Registry["items"] = [
  {
    dependencies: ["@ui-sdk/core", "@ui-sdk/react"],
    description:
      "A horizontal or vertical line that divides groups of content.",
    files: [
      {
        path: "ui/separator.tsx",
        target: "components/ui/separator.tsx",
        type: "registry:ui",
      },
    ],
    name: "separator",
    title: "Separator",
    type: "registry:ui",
  },
];
