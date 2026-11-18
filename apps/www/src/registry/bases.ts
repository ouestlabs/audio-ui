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
  {
    dependencies: ["@ui-sdk/core", "@ui-sdk/react"],
    description:
      "Components for building accessible web apps, on the behaviors audio/ui's primitives share.",
    name: "ui-sdk",
    title: "UI SDK",
    type: "registry:style",
  },
];

export type Base = (typeof BASES)[number];
