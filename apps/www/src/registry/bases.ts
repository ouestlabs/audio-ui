import type { RegistryItem } from "shadcn/schema";

export const BASES: RegistryItem[] = [
  {
    dependencies: ["@base-ui/react"],
    description:
      "Components for building accessible web apps and design systems.",
    meta: {
      logo: "<svg width='17' height='24' viewBox='0 0 17 24'><path fill='currentColor' d='M9.5001 7.01537C9.2245 6.99837 9 7.22385 9 7.49999V23C13.4183 23 17 19.4183 17 15C17 10.7497 13.6854 7.27351 9.5001 7.01537Z'></path><path fill='currentColor'   d='M8 9.8V12V23C3.58172 23 0 19.0601 0 14.2V12V1C4.41828 1 8 4.93989 8 9.8Z'></path></svg>",
    },
    name: "base",
    title: "Base UI",
    type: "registry:style",
  },
];

export type Base = (typeof BASES)[number];
