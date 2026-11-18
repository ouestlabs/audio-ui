import type { RegistryItem } from "shadcn/schema";

/** The audio items whose files name Base UI: the ui-sdk base has its own of each, by the same name and path. */
export const audio: RegistryItem[] = [
  {
    dependencies: ["@base-ui/react", "class-variance-authority"],
    description:
      "A parameter's value as a field: type it, step it with the arrows (Shift for large steps, Alt for small), or drag its label or unit to scrub it, sideways or up and down, with a unit, precision and steppers.",
    files: [
      {
        path: "audio/elements/parameter-field.tsx",
        type: "registry:ui",
      },
    ],
    name: "parameter-field",
    registryDependencies: ["@shadcn/input-group"],
    type: "registry:ui",
  },
  {
    dependencies: ["@base-ui/react", "class-variance-authority"],
    description:
      "A rocker switch, as on a mixer or a synth: two sides, the one pressed down sunk into the panel, upright or laid down, with a switch's role and keyboard.",
    files: [
      {
        path: "audio/elements/rocker-switch.tsx",
        type: "registry:ui",
      },
    ],
    name: "rocker-switch",
    type: "registry:ui",
  },
];
