import Link from "next/link";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";

export function XLink() {
  return (
    <Button asChild className="h-8 shadow-none" size="sm" variant="ghost">
      <Link href={siteConfig.links.twitter} rel="noreferrer" target="_blank">
        <Icons.twitter className="size-3.25" />
        <span className="sr-only">X</span>
      </Link>
    </Button>
  );
}
