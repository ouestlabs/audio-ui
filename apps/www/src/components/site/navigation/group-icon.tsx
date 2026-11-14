import {
  BracesIcon,
  CrateIcon,
  GridIcon,
  KnobIcon,
  PlayIcon,
  RackIcon,
  ShapesIcon,
  SpeakerIcon,
  TapeIcon,
  TracksIcon,
  WaveformIcon,
} from "@audio-ui/icons/react";
import { cn } from "@/lib/utils";

const GROUP_ICONS = {
  Guides: WaveformIcon,
  Devices: RackIcon,
  Elements: KnobIcon,
  "Get started": PlayIcon,
  Workstation: TracksIcon,
} as const;

const SECTION_ICONS = {
  components: GridIcon,
  core: BracesIcon,
  docs: TapeIcon,
  engine: SpeakerIcon,
  elements: ShapesIcon,
  icons: GridIcon,
  react: ShapesIcon,
  registry: CrateIcon,
} as const;

/** The glyph of a section of the docs, in the color of the text when it is the one being read. */
export function SectionIcon({ current, id }: { current: boolean; id: string }) {
  const Icon = SECTION_ICONS[id as keyof typeof SECTION_ICONS];
  return Icon ? (
    <Icon
      className={cn(
        "size-4 shrink-0",
        current ? "text-foreground" : "text-muted-foreground"
      )}
      weight="fill"
    />
  ) : null;
}

/** The glyph of a space of the docs, beside its title on the home: thin and muted, and in the title's color when `current`. Nothing for the other groups. */
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
