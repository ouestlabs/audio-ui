import { Icons } from "@/components/site/icons";

const GROUP_ICONS = {
  "Audio engine": Icons.engine,
  Devices: Icons.devices,
  Elements: Icons.elements,
  "Get started": Icons.start,
  Workstation: Icons.workstation,
} as const;

/** The glyph of a space of the docs (a group of the sidebar), or nothing for the other groups. */
export function GroupIcon({ title }: { title: string }) {
  const Icon = GROUP_ICONS[title as keyof typeof GROUP_ICONS];
  return Icon ? <Icon className="size-4 shrink-0" /> : null;
}
