import type { ComponentProps } from "react";
import { DeviceFacesProvider } from "@/registry/bases/shared/audio-ui/panels/device-faces";
import { HardwareFader } from "@/registry/bases/shared/audio-ui/skins/hardware/fader";
import { HardwareKnob } from "@/registry/bases/shared/audio-ui/skins/hardware/knob";
import { cn } from "@/registry/lib/utils";

const FACES = { Fader: HardwareFader, Knob: HardwareKnob };

/**
 * Everything inside wears the Hardware skin: its tokens and materials, and
 * its faces in device panels. `className="contents"` keeps it out of the layout.
 */
export function HardwareSkin({ className, ...props }: ComponentProps<"div">) {
  return (
    <DeviceFacesProvider value={FACES}>
      <div
        className={cn("skin-hardware", className)}
        data-slot="hardware-skin"
        {...props}
      />
    </DeviceFacesProvider>
  );
}
