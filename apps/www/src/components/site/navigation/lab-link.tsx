import { FlaskIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";

/** The lab, beside GitHub: complete devices built with audio/ui. */
export function LabLink() {
  return (
    <Button
      className="shadow-none max-sm:size-8 max-sm:px-0"
      render={
        <a href={siteConfig.links.lab} rel="noreferrer" target="_blank" />
      }
      variant="outline"
    >
      <FlaskIcon aria-hidden weight="fill" />
      <span className="max-sm:sr-only">Lab</span>
    </Button>
  );
}
