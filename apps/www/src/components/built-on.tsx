import type * as React from "react";
import { Icons } from "@/components/icons";

/** The logo of the library a base is built on, decorative: its name is always written beside it. */
const BASE_LOGOS: Record<
  string,
  (props: React.SVGProps<SVGSVGElement>) => React.ReactNode
> = {
  base: Icons.base,
};

export function BaseLogo({
  className,
  name,
}: {
  className?: string;
  name: string;
}) {
  const Logo = BASE_LOGOS[name];
  return Logo ? <Logo className={className} /> : null;
}

/** What a preview header names: this library, with its logo. */
export function BuiltOn() {
  return (
    <>
      <Icons.audioUi
        aria-hidden="true"
        className="size-3.5 shrink-0 text-foreground"
      />
      <span className="truncate">Audio UI</span>
    </>
  );
}
