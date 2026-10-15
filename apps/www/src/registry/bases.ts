import type { RegistryItem } from "shadcn/schema";

export const BASES: RegistryItem[] = [
  {
    dependencies: ["@base-ui/react"],
    description:
      "Components for building accessible web apps and design systems.",
    name: "base",
    title: "Base UI",
    type: "registry:style",
  },
];

export type Base = (typeof BASES)[number];
