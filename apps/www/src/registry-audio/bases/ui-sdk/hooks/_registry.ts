import type { RegistryItem } from "shadcn/schema";
import { hookItem } from "../../items";

export const hooks: RegistryItem[] = [
  hookItem("use-popup-container", {
    description:
      "Where the popups of the ui components render: the page's body, so a button group or a panel that clips never holds them.",
  }),
];
