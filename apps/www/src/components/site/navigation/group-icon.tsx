import {
  BotIcon,
  ContrastIcon,
  CrateIcon,
  DialIcon,
  GridIcon,
  type IconProps,
  InsertIcon,
  KnobIcon,
  MetronomeIcon,
  NoteIcon,
  PlayheadIcon,
  RackIcon,
  SparkleIcon,
  TracksIcon,
  TuningForkIcon,
  WaveformIcon,
} from "@audio-ui/icons";
import type { ComponentType } from "react";
import { Icons } from "@/components/site/icons";
import { cn } from "@/lib/utils";

const GROUP_ICONS = {
  "Audio engine": WaveformIcon,
  Devices: RackIcon,
  Elements: KnobIcon,
  "Get started": MetronomeIcon,
  Workstation: TracksIcon,
} as const;

/** The glyph of a space of the docs (a group of the sidebar): thin and muted, and in the title's color when the page being read is in it. Nothing for the other groups. */
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
      weight="fill"
    />
  ) : null;
}

const PAGE_ICONS: Record<string, ComponentType<IconProps>> = {
  "/docs": NoteIcon,
  "/docs/agents": SparkleIcon,
  "/docs/get-started": InsertIcon,
  "/docs/headless-styling": DialIcon,
  "/docs/icons": GridIcon,
  "/docs/primitives": TuningForkIcon,
  "/docs/registry": CrateIcon,
  "/docs/roadmap": PlayheadIcon,
  "/docs/styling": ContrastIcon,
  "/llms.txt": BotIcon,
};

/** The glyph of a page of the sidebar that has one (the Get started pages), or nothing. */
export function PageIcon({ url }: { url: string }) {
  // The MCP mark is a logo: it has no weights.
  if (url === "/docs/mcp") {
    return (
      <Icons.mcp className="size-3.5 shrink-0 text-site-muted-foreground" />
    );
  }
  const Icon = PAGE_ICONS[url];
  return Icon ? (
    <Icon
      className="size-3.5 shrink-0 text-site-muted-foreground"
      weight="fill"
    />
  ) : null;
}
