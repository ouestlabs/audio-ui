import {
  BotIcon,
  BracesIcon,
  FadersIcon,
  GridIcon,
  type IconProps,
  JackIcon,
  KnobIcon,
  MetronomeIcon,
  PatchbayIcon,
  PlayheadIcon,
  RackIcon,
  ShapesIcon,
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
    />
  ) : null;
}

const PAGE_ICONS: Record<string, ComponentType<IconProps>> = {
  "/docs": TuningForkIcon,
  "/docs/agents": SparkleIcon,
  "/docs/get-started": JackIcon,
  "/docs/headless-styling": BracesIcon,
  "/docs/icons": GridIcon,
  "/docs/mcp": Icons.mcp,
  "/docs/primitives": ShapesIcon,
  "/docs/registry": PatchbayIcon,
  "/docs/roadmap": PlayheadIcon,
  "/docs/styling": FadersIcon,
  "/llms.txt": BotIcon,
};

/** The glyph of a page of the sidebar that has one (the Get started pages), or nothing. */
export function PageIcon({ url }: { url: string }) {
  const Icon = PAGE_ICONS[url];
  return Icon ? (
    <Icon className="size-3.5 shrink-0 text-site-muted-foreground" />
  ) : null;
}
