import type { Registry } from "shadcn/schema";

const dependencies = ["@ui-sdk/core", "@ui-sdk/react"];

const ui_ = (
  name: string,
  title: string,
  description: string,
  more: { dependencies?: string[]; registryDependencies?: string[] } = {}
): Registry["items"][number] => ({
  dependencies: [...dependencies, ...(more.dependencies ?? [])],
  description,
  files: [
    {
      path: `ui/${name}.tsx`,
      target: `components/ui/${name}.tsx`,
      type: "registry:ui",
    },
  ],
  name,
  registryDependencies: more.registryDependencies,
  title,
  type: "registry:ui",
});

export const ui: Registry["items"] = [
  ui_(
    "button",
    "Button",
    "Runs an action, stays pending while an async action runs, and has the variants and sizes of the style.",
    { dependencies: ["class-variance-authority"] }
  ),
  ui_(
    "context-menu",
    "Context menu",
    "A menu that opens at a right-click or a long press, with groups, checkboxes, radio choices and submenus."
  ),
  ui_(
    "dialog",
    "Dialog",
    "A focused task over the page, with a backdrop, a title, a description and a close button.",
    { registryDependencies: ["button"] }
  ),
  ui_(
    "dropdown-menu",
    "Dropdown menu",
    "A menu that opens from a button, with groups, checkboxes, radio choices and submenus."
  ),
  ui_(
    "popover",
    "Popover",
    "Content in a floating panel that opens from a trigger."
  ),
  ui_(
    "select",
    "Select",
    "Chooses one value from a popup list, with groups, separators and a check on the chosen item."
  ),
  ui_(
    "separator",
    "Separator",
    "A horizontal or vertical line that divides groups of content."
  ),
  ui_(
    "tabs",
    "Tabs",
    "Switches between related panels, one tab selected at a time, in a default or a line variant.",
    { dependencies: ["class-variance-authority"] }
  ),
  ui_(
    "tooltip",
    "Tooltip",
    "Names a control or adds a short hint on hover and keyboard focus."
  ),
];
