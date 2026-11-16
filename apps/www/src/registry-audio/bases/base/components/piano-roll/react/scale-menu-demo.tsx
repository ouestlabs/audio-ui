import { inScale, type Scale } from "@audio-ui/engine/pitch";
import { useState } from "react";
import { DropdownMenuSeparator } from "@/registry/bases/base/ui/dropdown-menu";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import {
  ScaleMenu,
  ScaleMenuContent,
  ScaleMenuName,
  ScaleMenuRoot,
  ScaleMenuToggle,
  ScaleMenuTrigger,
} from "@/registry-audio/bases/base/audio/elements/scale-menu";

const MIN_PITCH = 48;
const MAX_PITCH = 72;
const PITCHES = Array.from(
  { length: MAX_PITCH - MIN_PITCH + 1 },
  (_, index) => MIN_PITCH + index
);

/** Pick a root and a scale: the keys in it light up. */
export default function ScaleMenuDemo() {
  const [enabled, setEnabled] = useState(true);
  const [scale, setScale] = useState<Scale>({ name: "major", root: 2 });
  const marked = enabled
    ? PITCHES.filter((pitch) => inScale(pitch, scale))
    : [];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ScaleMenu
        enabled={enabled}
        onEnabledChange={setEnabled}
        onScaleChange={setScale}
        scale={scale}
      >
        <ScaleMenuTrigger />
        <ScaleMenuContent align="center">
          <ScaleMenuToggle>Light the scale</ScaleMenuToggle>
          <DropdownMenuSeparator />
          <ScaleMenuRoot />
          <ScaleMenuName />
        </ScaleMenuContent>
      </ScaleMenu>
      <Piano
        activeNotes={marked}
        aria-label="Piano"
        // The keys stay white and black in every theme, the primary color does not: the scale takes its hue at a lightness of its own, light on a white key, mid on a black one, so a key in it reads whatever the theme.
        className="[&_[data-active][data-color=black]]:bg-[oklch(from_var(--primary)_0.55_c_h)] [&_[data-active][data-color=white]]:bg-[oklch(from_var(--primary)_0.85_c_h)]"
        maxPitch={MAX_PITCH}
        minPitch={MIN_PITCH}
      />
    </div>
  );
}
