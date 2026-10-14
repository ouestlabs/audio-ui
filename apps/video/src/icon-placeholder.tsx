import {
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SquareIcon,
} from "lucide-react";

/** The icons the filmed components show, in the site's default library: menus never open on screen. */
const ICONS = {
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SquareIcon,
};

/**
 * Stands in for the site's `IconPlaceholder`, which pulls the whole design
 * system in to pick a library: a video always draws the Lucide icon.
 */
export function IconPlaceholder({
  className,
  lucide,
}: {
  className?: string;
  lucide?: string;
} & Record<string, unknown>) {
  const Icon = lucide ? ICONS[lucide as keyof typeof ICONS] : undefined;
  return Icon ? <Icon aria-hidden="true" className={className} /> : null;
}
