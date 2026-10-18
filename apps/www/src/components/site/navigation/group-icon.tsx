import { Icons } from "@/components/site/icons";
import { cn } from "@/lib/utils";

const GROUP_ICONS = {
  "Audio engine": Icons.engine,
  Devices: Icons.devices,
  Elements: Icons.elements,
  "Get started": Icons.start,
  Workstation: Icons.workstation,
} as const;

/** The glyph of a space of the docs (a group of the sidebar): muted, and in the title's color when the page being read is in it. Nothing for the other groups. */
export function GroupIcon({
  current,
  title,
}: {
  current: boolean;
  title: string;
}) {
  const Icon = GROUP_ICONS[title as keyof typeof GROUP_ICONS];
  return Icon ? (
    <Icon
      className={cn(
        "size-4 shrink-0",
        current ? "text-site-foreground" : "text-site-muted-foreground"
      )}
    />
  ) : null;
}
