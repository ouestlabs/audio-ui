import { WaveformIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";

/** The DAW, beside the lab: a workstation built with audio/ui. From `sm` up; under it, the menu lists it. */
export function DawLink() {
  return (
    <Button
      className="shadow-none max-sm:hidden"
      render={
        <a href={siteConfig.links.daw} rel="noreferrer" target="_blank" />
      }
      variant="outline"
    >
      <WaveformIcon aria-hidden weight="bold" />
      DAW
    </Button>
  );
}
