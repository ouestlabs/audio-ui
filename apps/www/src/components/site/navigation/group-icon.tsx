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

const PAGE_ICONS: Record<
  string,
  (props: { className?: string }) => React.ReactNode
> = {
  "/docs": Icons.introduction,
  "/docs/agents": Icons.sparkle,
  "/docs/get-started": Icons.installation,
  "/docs/headless-styling": Icons.headless,
  "/docs/mcp": Icons.mcp,
  "/docs/primitives": Icons.primitives,
  "/docs/registry": Icons.registry,
  "/docs/roadmap": Icons.roadmap,
  "/docs/styling": Icons.tokens,
  "/llms.txt": Icons.bot,
};

/** The glyph of a page of the sidebar that has one (the Get started pages), or nothing. */
export function PageIcon({ url }: { url: string }) {
  const Icon = PAGE_ICONS[url];
  return Icon ? (
    <Icon className="size-3.5 shrink-0 text-site-muted-foreground" />
  ) : null;
}
