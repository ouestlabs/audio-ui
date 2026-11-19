import type { Registry } from "shadcn/schema";

/** A component of shadcn's set, written over Base UI: the ui-sdk base has its own of each, by the same name and path. */
const ui_ = (
  name: string,
  title: string,
  description: string,
  more: { dependencies: string[]; registryDependencies: string[] }
): Registry["items"][number] => ({
  dependencies: more.dependencies,
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
    "accordion",
    "Accordion",
    "Sections that open and close, one at a time or several.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "alert-dialog",
    "Alert dialog",
    "A question that needs an explicit answer, with a confirming action and a cancel.",
    { dependencies: ["@base-ui/react"], registryDependencies: ["button"] }
  ),
  ui_(
    "avatar",
    "Avatar",
    "A user's image with a fallback, in three sizes, with a badge and a group.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "badge",
    "Badge",
    "A small label for a status or a count, in six variants, that can render another element.",
    {
      dependencies: ["@base-ui/react", "class-variance-authority"],
      registryDependencies: [],
    }
  ),
  ui_(
    "button",
    "Button",
    "Runs an action, stays pending while an async action runs, and has the variants and sizes of the style.",
    {
      dependencies: ["@base-ui/react", "class-variance-authority"],
      registryDependencies: [],
    }
  ),
  ui_(
    "button-group",
    "Button group",
    "Joins buttons, selects and inputs into one bar, with a separator and a text part.",
    {
      dependencies: ["@base-ui/react", "class-variance-authority"],
      registryDependencies: ["separator"],
    }
  ),
  ui_(
    "calendar",
    "Calendar",
    "Chooses a date, several dates or a range from a month grid, with one or more months.",
    { dependencies: ["react-day-picker"], registryDependencies: ["button"] }
  ),
  ui_(
    "carousel",
    "Carousel",
    "Pages through slides with native scrolling, swipes, arrow keys and previous and next buttons.",
    { dependencies: ["embla-carousel-react"], registryDependencies: ["button"] }
  ),
  ui_(
    "checkbox",
    "Checkbox",
    "Chooses one or more independent options, with a check and a mixed state.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_("collapsible", "Collapsible", "A panel a trigger opens and closes.", {
    dependencies: ["@base-ui/react"],
    registryDependencies: [],
  }),
  ui_(
    "combobox",
    "Combobox",
    "Searches a list and chooses one or several values, with chips, a clear button and groups.",
    {
      dependencies: ["@base-ui/react"],
      registryDependencies: ["input-group", "button"],
    }
  ),
  ui_(
    "command",
    "Command",
    "Searches a list and runs a command, in a panel or a dialog, with groups, separators and shortcuts.",
    { dependencies: ["cmdk"], registryDependencies: ["dialog", "input-group"] }
  ),
  ui_(
    "context-menu",
    "Context menu",
    "A menu that opens at a right-click or a long press, with groups, checkboxes, radio choices and submenus.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "dialog",
    "Dialog",
    "A focused task over the page, with a backdrop, a title, a description and a close button.",
    { dependencies: ["@base-ui/react"], registryDependencies: ["button"] }
  ),
  ui_(
    "drawer",
    "Drawer",
    "A sheet that opens from an edge, can be dragged to dismiss, and rests on snap points.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "dropdown-menu",
    "Dropdown menu",
    "A menu that opens from a button, with groups, checkboxes, radio choices and submenus.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "empty",
    "Empty",
    "A placeholder for a screen with nothing to show, with a header, a media, a title and a description.",
    { dependencies: ["class-variance-authority"], registryDependencies: [] }
  ),
  ui_(
    "hover-card",
    "Hover card",
    "A card that previews a link when the pointer rests on it or focus reaches it.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "input",
    "Input",
    "A text field that takes a number or a list as its value too.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
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
    "input-otp",
    "Input OTP",
    "Enters a one-time code in slots, with paste, autofill and a separator.",
    { dependencies: ["input-otp"], registryDependencies: [] }
  ),
  ui_(
    "item",
    "Item",
    "A row with a media, a title and a description, and actions on its side.",
    {
      dependencies: ["@base-ui/react", "class-variance-authority"],
      registryDependencies: ["separator"],
    }
  ),
  ui_("kbd", "Kbd", "A keyboard key, for a shortcut hint.", {
    dependencies: [],
    registryDependencies: [],
  }),
  ui_(
    "menubar",
    "Menubar",
    "A bar of menus with one tab stop, arrow keys between menus, checkboxes, radios and submenus.",
    {
      dependencies: ["@base-ui/react"],
      registryDependencies: ["dropdown-menu"],
    }
  ),
  ui_(
    "navigation-menu",
    "Navigation menu",
    "Groups site links into panels that open from a row of triggers, in a shared viewport.",
    {
      dependencies: ["@base-ui/react", "class-variance-authority"],
      registryDependencies: [],
    }
  ),
  ui_(
    "pagination",
    "Pagination",
    "Navigates pages with buttons or links, with previous and next and an ellipsis for gaps.",
    { dependencies: [], registryDependencies: ["button"] }
  ),
  ui_(
    "popover",
    "Popover",
    "Content in a floating panel that opens from a trigger.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "progress",
    "Progress",
    "The progress of a task, with a label and a value.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "radio-group",
    "Radio group",
    "Chooses one of a few options, all visible.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "resizable",
    "Resizable",
    "Panels the user resizes by dragging a handle or with the keyboard, in a row or a column.",
    { dependencies: ["react-resizable-panels"], registryDependencies: [] }
  ),
  ui_(
    "scroll-area",
    "Scroll area",
    "Styled scrolling, with a scrollbar and a corner.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "select",
    "Select",
    "Chooses one value from a popup list, with groups, separators and a check on the chosen item.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "separator",
    "Separator",
    "A horizontal or vertical line that divides groups of content.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "sheet",
    "Sheet",
    "A panel that opens from an edge of the screen, over the page.",
    { dependencies: ["@base-ui/react"], registryDependencies: ["button"] }
  ),
  ui_(
    "slider",
    "Slider",
    "Adjusts a number or a range with draggable thumbs and keyboard controls.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "sonner",
    "Sonner",
    "Shows toasts from anywhere in the app, in the theme the app is in.",
    { dependencies: ["next-themes", "sonner"], registryDependencies: [] }
  ),
  ui_(
    "switch",
    "Switch",
    "Turns a setting on or off, in a default or a small size.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  ui_(
    "tabs",
    "Tabs",
    "Switches between related panels, one tab selected at a time, in a default or a line variant.",
    {
      dependencies: ["@base-ui/react", "class-variance-authority"],
      registryDependencies: [],
    }
  ),
  ui_(
    "textarea",
    "Textarea",
    "A multiline text field that grows as you type.",
    { dependencies: [], registryDependencies: [] }
  ),
  ui_(
    "toggle",
    "Toggle",
    "A button that stays pressed, in a default or an outline variant.",
    {
      dependencies: ["@base-ui/react", "class-variance-authority"],
      registryDependencies: [],
    }
  ),
  ui_(
    "toggle-group",
    "Toggle group",
    "A row of toggles, one or several pressed at a time.",
    {
      dependencies: ["@base-ui/react", "class-variance-authority"],
      registryDependencies: ["toggle"],
    }
  ),
  ui_(
    "tooltip",
    "Tooltip",
    "Names a control or adds a short hint on hover and keyboard focus.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
  // shadcn has no toolbar: it is the one component of this set that is not its own.
  ui_(
    "toolbar",
    "Toolbar",
    "A toolbar: buttons, groups and separators that share one tab stop and move with the arrow keys.",
    { dependencies: ["@base-ui/react"], registryDependencies: [] }
  ),
];
