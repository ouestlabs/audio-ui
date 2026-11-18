import type { Registry } from "shadcn/schema";

/** The ui components the audio items need and shadcn has none of. */
export const ui: Registry["items"] = [
  {
    dependencies: ["@base-ui/react"],
    description:
      "A toolbar: buttons, groups and separators that share one tab stop and move with the arrow keys.",
    files: [
      {
        path: "ui/toolbar.tsx",
        target: "components/ui/toolbar.tsx",
        type: "registry:ui",
      },
    ],
    name: "toolbar",
    title: "Toolbar",
    type: "registry:ui",
  },
];
