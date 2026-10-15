import type * as React from "react";
import { Icons } from "@/components/icons";
import { BASES } from "@/registry/bases";

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

/** The library a preview is built on: the only one there is for now. */
export function BuiltOn() {
  const base = BASES.find((item) => item.name === "base");
  return (
    <>
      {base ? (
        <BaseLogo className="size-3.5 shrink-0" name={base.name} />
      ) : null}
      <span className="truncate">{base?.title}</span>
    </>
  );
}
