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
    "avatar",
    "Avatar",
    "A user's image with a fallback, in three sizes, with a badge and a group."
  ),
  ui_(
    "command",
    "Command",
    "Searches a list and runs a command, in a panel or a dialog, with groups, separators and shortcuts.",
    { registryDependencies: ["dialog", "input-group"] }
  ),
  ui_(
    "checkbox",
    "Checkbox",
    "Chooses one or more independent options, with a check and a mixed state."
  ),
  ui_(
    "hover-card",
    "Hover card",
    "A card that previews a link when the pointer rests on it or focus reaches it.",
    { registryDependencies: ["use-popup-container"] }
  ),
  ui_(
    "progress",
    "Progress",
    "The progress of a task, with a label and a value."
  ),
  ui_(
    "radio-group",
    "Radio group",
    "Chooses one of a few options, all visible."
  ),
  ui_(
    "scroll-area",
    "Scroll area",
    "Styled scrolling, with a scrollbar and a corner."
  ),
  ui_(
    "accordion",
    "Accordion",
    "Sections that open and close, one at a time or several."
  ),
  ui_(
    "alert-dialog",
    "Alert dialog",
    "A question that needs an explicit answer, with a confirming action and a cancel.",
    { registryDependencies: ["button"] }
  ),
  ui_(
    "badge",
    "Badge",
    "A small label for a status or a count, in six variants, that can render another element.",
    { dependencies: ["class-variance-authority"] }
  ),
  ui_("collapsible", "Collapsible", "A panel a trigger opens and closes."),
  ui_(
    "sheet",
    "Sheet",
    "A panel that opens from an edge of the screen, over the page.",
    { registryDependencies: ["button", "use-popup-container"] }
  ),
  ui_(
    "button-group",
    "Button group",
    "Joins buttons, selects and inputs into one bar, with a separator and a text part.",
    {
      dependencies: ["class-variance-authority"],
      registryDependencies: ["separator"],
    }
  ),
  ui_(
    "empty",
    "Empty",
    "A placeholder for a screen with nothing to show, with a header, a media, a title and a description.",
    { dependencies: ["class-variance-authority"] }
  ),
  ui_(
    "input",
    "Input",
    "A text field that takes a number or a list as its value too."
  ),
  ui_(
    "input-group",
    "Input group",
    "An input or a textarea with addons, buttons and text on its sides.",
    {
      dependencies: ["class-variance-authority"],
      registryDependencies: ["button", "input", "textarea"],
    }
  ),
  ui_(
    "item",
    "Item",
    "A row with a media, a title and a description, and actions on its side.",
    {
      dependencies: ["class-variance-authority"],
      registryDependencies: ["separator"],
    }
  ),
  ui_("kbd", "Kbd", "A keyboard key, for a shortcut hint."),
  ui_(
    "slider",
    "Slider",
    "Adjusts a number or a range with draggable thumbs and keyboard controls."
  ),
  ui_("textarea", "Textarea", "A multiline text field that grows as you type."),
  ui_(
    "toggle",
    "Toggle",
    "A button that stays pressed, in a default or an outline variant.",
    { dependencies: ["class-variance-authority"] }
  ),
  ui_(
    "toggle-group",
    "Toggle group",
    "A row of toggles, one or several pressed at a time.",
    {
      dependencies: ["class-variance-authority"],
      registryDependencies: ["toggle"],
    }
  ),
  ui_(
    "button",
    "Button",
    "Runs an action, stays pending while an async action runs, and has the variants and sizes of the style.",
    { dependencies: ["class-variance-authority"] }
  ),
  ui_(
    "context-menu",
    "Context menu",
    "A menu that opens at a right-click or a long press, with groups, checkboxes, radio choices and submenus.",
    { registryDependencies: ["use-popup-container"] }
  ),
  ui_(
    "dialog",
    "Dialog",
    "A focused task over the page, with a backdrop, a title, a description and a close button.",
    { registryDependencies: ["button", "use-popup-container"] }
  ),
  ui_(
    "dropdown-menu",
    "Dropdown menu",
    "A menu that opens from a button, with groups, checkboxes, radio choices and submenus.",
    { registryDependencies: ["use-popup-container"] }
  ),
  ui_(
    "popover",
    "Popover",
    "Content in a floating panel that opens from a trigger.",
    { registryDependencies: ["use-popup-container"] }
  ),
  ui_(
    "select",
    "Select",
    "Chooses one value from a popup list, with groups, separators and a check on the chosen item.",
    { registryDependencies: ["use-popup-container"] }
  ),
  ui_(
    "separator",
    "Separator",
    "A horizontal or vertical line that divides groups of content."
  ),
  ui_(
    "switch",
    "Switch",
    "Turns a setting on or off, in a default or a small size."
  ),
  ui_(
    "tabs",
    "Tabs",
    "Switches between related panels, one tab selected at a time, in a default or a line variant.",
    { dependencies: ["class-variance-authority"] }
  ),
  ui_(
    "toolbar",
    "Toolbar",
    "Buttons, groups and separators that share one tab stop and move with the arrow keys."
  ),
  ui_(
    "tooltip",
    "Tooltip",
    "Names a control or adds a short hint on hover and keyboard focus.",
    { registryDependencies: ["use-popup-container"] }
  ),
];
