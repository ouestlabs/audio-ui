import { FlaskIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";

/** The lab, beside GitHub: complete devices built with audio/ui. */
export function LabLink() {
  return (
    <Button
      className="shadow-none"
      nativeButton={false}
      render={
        <a href={siteConfig.links.lab} rel="noreferrer" target="_blank" />
      }
      variant="outline"
    >
      <FlaskIcon aria-hidden weight="fill" />
      Lab
    </Button>
  );
}
