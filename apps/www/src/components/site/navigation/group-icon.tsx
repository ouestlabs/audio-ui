import {
  BotIcon,
  DevicesIcon,
  ElementsIcon,
  EngineIcon,
  HeadlessIcon,
  type IconProps,
  InstallationIcon,
  IntroductionIcon,
  PrimitivesIcon,
  RegistryIcon,
  RoadmapIcon,
  SparkleIcon,
  StartIcon,
  TokensIcon,
  WorkstationIcon,
} from "@audio-ui/icons";
import type { ComponentType } from "react";
import { Icons } from "@/components/site/icons";
import { cn } from "@/lib/utils";

const GROUP_ICONS = {
  "Audio engine": EngineIcon,
  Devices: DevicesIcon,
  Elements: ElementsIcon,
  "Get started": StartIcon,
  Workstation: WorkstationIcon,
} as const;

/** The glyph of a space of the docs (a group of the sidebar): thin and muted, and duotone in the title's color when the page being read is in it. Nothing for the other groups. */
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
      weight={current ? "duotone" : "regular"}
    />
  ) : null;
}

const PAGE_ICONS: Record<string, ComponentType<IconProps>> = {
  "/docs": IntroductionIcon,
  "/docs/agents": SparkleIcon,
  "/docs/get-started": InstallationIcon,
  "/docs/headless-styling": HeadlessIcon,
  "/docs/mcp": Icons.mcp,
  "/docs/primitives": PrimitivesIcon,
  "/docs/registry": RegistryIcon,
  "/docs/roadmap": RoadmapIcon,
  "/docs/styling": TokensIcon,
  "/llms.txt": BotIcon,
};

/** The glyph of a page of the sidebar that has one (the Get started pages), or nothing. */
export function PageIcon({ url }: { url: string }) {
  const Icon = PAGE_ICONS[url];
  return Icon ? (
    <Icon className="size-3.5 shrink-0 text-site-muted-foreground" />
  ) : null;
}
