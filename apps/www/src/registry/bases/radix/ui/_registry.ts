import type { Registry } from "shadcn/schema";

export const ui: Registry["items"] = [
  {
    files: [
      {
        path: "ui/accordion.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/primitives/docs/components/accordion.md",
        docs: "https://ui.shadcn.com/docs/components/radix/accordion",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/accordion-example.tsx",
      },
    },
    name: "accordion",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/alert.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/alert",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/alert-example.tsx",
      },
    },
    name: "alert",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/alert-dialog.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/primitives/docs/components/alert-dialog.md",
        docs: "https://ui.shadcn.com/docs/components/radix/alert-dialog",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/alert-dialog-example.tsx",
      },
    },
    name: "alert-dialog",
    registryDependencies: ["button"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/aspect-ratio.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/primitives/docs/components/aspect-ratio.md",
        docs: "https://ui.shadcn.com/docs/components/radix/aspect-ratio",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/aspect-ratio-example.tsx",
      },
    },
    name: "aspect-ratio",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/avatar.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/primitives/docs/components/avatar.md",
        docs: "https://ui.shadcn.com/docs/components/radix/avatar",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/avatar-example.tsx",
      },
    },
    name: "avatar",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/badge.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/badge",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/badge-example.tsx",
      },
    },
    name: "badge",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/breadcrumb.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/breadcrumb",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/breadcrumb-example.tsx",
      },
    },
    name: "breadcrumb",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/button.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/button",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/button-example.tsx",
      },
    },
    name: "button",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/button-group.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/button-group",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/button-group-example.tsx",
      },
    },
    name: "button-group",
    registryDependencies: ["separator"],
    type: "registry:ui",
  },
  {
    dependencies: ["react-day-picker@latest", "date-fns"],
    files: [
      {
        path: "ui/calendar.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://react-day-picker.js.org",
        docs: "https://ui.shadcn.com/docs/components/radix/calendar",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/calendar-example.tsx",
      },
    },
    name: "calendar",
    registryDependencies: ["button"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/card.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/card",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/card-example.tsx",
      },
    },
    name: "card",
    type: "registry:ui",
  },
  {
    dependencies: ["embla-carousel-react"],
    files: [
      {
        path: "ui/carousel.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.embla-carousel.com/get-started/react",
        docs: "https://ui.shadcn.com/docs/components/radix/carousel",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/carousel-example.tsx",
      },
    },
    name: "carousel",
    registryDependencies: ["button"],
    type: "registry:ui",
  },
  {
    dependencies: ["recharts@3.8.0"],
    files: [
      {
        path: "ui/chart.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/chart",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/chart-example.tsx",
      },
    },
    name: "chart",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/checkbox.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/checkbox.md",
        docs: "https://ui.shadcn.com/docs/components/radix/checkbox",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/checkbox-example.tsx",
      },
    },
    name: "checkbox",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/collapsible.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/collapsible.md",
        docs: "https://ui.shadcn.com/docs/components/radix/collapsible",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/collapsible-example.tsx",
      },
    },
    name: "collapsible",
    type: "registry:ui",
  },
  {
    dependencies: ["@base-ui/react"],
    files: [
      {
        path: "ui/combobox.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://base-ui.com/react/components/combobox",
        docs: "https://ui.shadcn.com/docs/components/radix/combobox",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/combobox-example.tsx",
      },
    },
    name: "combobox",
    registryDependencies: ["button", "input-group"],
    type: "registry:ui",
  },
  {
    dependencies: ["cmdk"],
    files: [
      {
        path: "ui/command.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://github.com/dip/cmdk",
        docs: "https://ui.shadcn.com/docs/components/radix/command",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/command-example.tsx",
      },
    },
    name: "command",
    registryDependencies: ["dialog", "input-group"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/context-menu.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/context-menu.md",
        docs: "https://ui.shadcn.com/docs/components/radix/context-menu",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/context-menu-example.tsx",
      },
    },
    name: "context-menu",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/dialog.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/dialog.md",
        docs: "https://ui.shadcn.com/docs/components/radix/dialog",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/dialog-example.tsx",
      },
    },
    name: "dialog",
    registryDependencies: ["button"],
    type: "registry:ui",
  },
  {
    dependencies: ["vaul"],
    files: [
      {
        path: "ui/drawer.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://vaul.emilkowal.ski/getting-started",
        docs: "https://ui.shadcn.com/docs/components/radix/drawer",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/drawer-example.tsx",
      },
    },
    name: "drawer",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/dropdown-menu.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/dropdown-menu.md",
        docs: "https://ui.shadcn.com/docs/components/radix/dropdown-menu",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/dropdown-menu-example.tsx",
      },
    },
    name: "dropdown-menu",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/empty.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/empty",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/empty-example.tsx",
      },
    },
    name: "empty",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/field.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/field",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/field-example.tsx",
      },
    },
    name: "field",
    registryDependencies: ["label", "separator"],
    type: "registry:ui",
  },
  {
    name: "form",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/hover-card.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/hover-card.md",
        docs: "https://ui.shadcn.com/docs/components/radix/hover-card",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/hover-card-example.tsx",
      },
    },
    name: "hover-card",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/input.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/input",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/input-example.tsx",
      },
    },
    name: "input",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/input-group.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/input-group",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/input-group-example.tsx",
      },
    },
    name: "input-group",
    registryDependencies: ["button", "input", "textarea"],
    type: "registry:ui",
  },
  {
    dependencies: ["input-otp"],
    files: [
      {
        path: "ui/input-otp.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://input-otp.rodz.dev",
        docs: "https://ui.shadcn.com/docs/components/radix/input-otp",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/input-otp-example.tsx",
      },
    },
    name: "input-otp",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/item.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/item",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/item-example.tsx",
      },
    },
    name: "item",
    registryDependencies: ["separator"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/label.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/label.md",
        docs: "https://ui.shadcn.com/docs/components/radix/label",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/label-example.tsx",
      },
    },
    name: "label",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/menubar.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/menubar.md",
        docs: "https://ui.shadcn.com/docs/components/radix/menubar",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/menubar-example.tsx",
      },
    },
    name: "menubar",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/navigation-menu.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/navigation-menu.md",
        docs: "https://ui.shadcn.com/docs/components/radix/navigation-menu",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/navigation-menu-example.tsx",
      },
    },
    name: "navigation-menu",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/pagination.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/pagination",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/pagination-example.tsx",
      },
    },
    name: "pagination",
    registryDependencies: ["button"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/popover.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/popover.md",
        docs: "https://ui.shadcn.com/docs/components/radix/popover",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/popover-example.tsx",
      },
    },
    name: "popover",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/progress.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/progress.md",
        docs: "https://ui.shadcn.com/docs/components/radix/progress",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/progress-example.tsx",
      },
    },
    name: "progress",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/radio-group.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/radio-group.md",
        docs: "https://ui.shadcn.com/docs/components/radix/radio-group",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/radio-group-example.tsx",
      },
    },
    name: "radio-group",
    type: "registry:ui",
  },
  {
    dependencies: ["react-resizable-panels"],
    files: [
      {
        path: "ui/resizable.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://github.com/bvaughn/react-resizable-panels",
        docs: "https://ui.shadcn.com/docs/components/radix/resizable",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/resizable-example.tsx",
      },
    },
    name: "resizable",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/scroll-area.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/scroll-area.md",
        docs: "https://ui.shadcn.com/docs/components/radix/scroll-area",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/scroll-area-example.tsx",
      },
    },
    name: "scroll-area",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/select.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/select.md",
        docs: "https://ui.shadcn.com/docs/components/radix/select",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/select-example.tsx",
      },
    },
    name: "select",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/separator.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/separator.md",
        docs: "https://ui.shadcn.com/docs/components/radix/separator",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/separator-example.tsx",
      },
    },
    name: "separator",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/sheet.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/dialog.md",
        docs: "https://ui.shadcn.com/docs/components/radix/sheet",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/sheet-example.tsx",
      },
    },
    name: "sheet",
    registryDependencies: ["button"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/sidebar.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/sidebar",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/sidebar-example.tsx",
      },
    },
    name: "sidebar",
    registryDependencies: [
      "button",
      "separator",
      "sheet",
      "tooltip",
      "input",
      "use-mobile",
      "skeleton",
    ],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/skeleton.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/skeleton",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/skeleton-example.tsx",
      },
    },
    name: "skeleton",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/slider.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/slider.md",
        docs: "https://ui.shadcn.com/docs/components/radix/slider",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/slider-example.tsx",
      },
    },
    name: "slider",
    type: "registry:ui",
  },
  {
    dependencies: ["sonner", "next-themes"],
    files: [
      {
        path: "ui/sonner.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://sonner.emilkowal.ski",
        docs: "https://ui.shadcn.com/docs/components/radix/sonner",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/sonner-example.tsx",
      },
    },
    name: "sonner",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/spinner.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/spinner",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/spinner-example.tsx",
      },
    },
    name: "spinner",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/switch.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/switch.md",
        docs: "https://ui.shadcn.com/docs/components/radix/switch",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/switch-example.tsx",
      },
    },
    name: "switch",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/table.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/table",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/table-example.tsx",
      },
    },
    name: "table",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/tabs.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/tabs.md",
        docs: "https://ui.shadcn.com/docs/components/radix/tabs",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/tabs-example.tsx",
      },
    },
    name: "tabs",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/textarea.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/textarea",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/textarea-example.tsx",
      },
    },
    name: "textarea",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/toggle.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/toggle.md",
        docs: "https://ui.shadcn.com/docs/components/radix/toggle",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/toggle-example.tsx",
      },
    },
    name: "toggle",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/toggle-group.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/toggle-group.md",
        docs: "https://ui.shadcn.com/docs/components/radix/toggle-group",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/toggle-group-example.tsx",
      },
    },
    name: "toggle-group",
    registryDependencies: ["toggle"],
    type: "registry:ui",
  },
  {
    docs: `The \`tooltip\` component has been added. Remember to wrap your app with the \`TooltipProvider\` component.

\`\`\`tsx title="app/layout.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
\`\`\`
`,
    files: [
      {
        path: "ui/tooltip.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/docs/primitives/components/tooltip.md",
        docs: "https://ui.shadcn.com/docs/components/radix/tooltip",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/tooltip-example.tsx",
      },
    },
    name: "tooltip",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/kbd.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/kbd",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/kbd-example.tsx",
      },
    },
    name: "kbd",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/native-select.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        docs: "https://ui.shadcn.com/docs/components/radix/native-select",
        examples:
          "https://ui.shadcn.com/code/apps/v4/registry/bases/radix/examples/native-select-example.tsx",
      },
    },
    name: "native-select",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/direction.tsx",
        type: "registry:ui",
      },
    ],
    meta: {
      links: {
        api: "https://www.radix-ui.com/primitives/docs/utilities/direction-provider.md",
        docs: "https://ui.shadcn.com/docs/components/radix/direction",
      },
    },
    name: "direction",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/attachment.tsx",
        type: "registry:ui",
      },
    ],
    name: "attachment",
    registryDependencies: ["button"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/bubble.tsx",
        type: "registry:ui",
      },
    ],
    name: "bubble",
    type: "registry:ui",
  },
  {
    dependencies: ["@shadcn/react"],
    files: [
      {
        path: "ui/message-scroller.tsx",
        type: "registry:ui",
      },
    ],
    name: "message-scroller",
    registryDependencies: ["button"],
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/marker.tsx",
        type: "registry:ui",
      },
    ],
    name: "marker",
    type: "registry:ui",
  },
  {
    files: [
      {
        path: "ui/message.tsx",
        type: "registry:ui",
      },
    ],
    name: "message",
    type: "registry:ui",
  },
];
