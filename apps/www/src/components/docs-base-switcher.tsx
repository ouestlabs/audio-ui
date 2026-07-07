import Link from "next/link";
import type { RegistryItem } from "shadcn/schema";

import { cn } from "@/lib/utils";
import { BASES } from "@/registry/bases";

// Base-only launch: audio components only exist for the Base UI base.
const AVAILABLE_BASES = (BASES as RegistryItem[]).filter(
  (baseItem) => baseItem.name === "base"
);

export function DocsBaseSwitcher({
  base,
  component,
  className,
}: {
  base: string;
  component: string;
  className?: string;
}) {
  const activeBase = AVAILABLE_BASES.find((baseItem) => base === baseItem.name);

  return (
    <div className={cn("inline-flex w-full items-center gap-6", className)}>
      {AVAILABLE_BASES.map((baseItem) => (
        <Link
          className="relative inline-flex items-center justify-center gap-1 pt-1 pb-0.5 font-medium text-base text-site-muted-foreground transition-colors after:absolute after:inset-x-0 after:bottom-[-4px] after:h-0.5 after:bg-site-foreground after:opacity-0 after:transition-opacity hover:text-site-foreground data-[active=true]:text-site-foreground data-[active=true]:after:opacity-100"
          data-active={base === baseItem.name}
          href={`/docs/components/${baseItem.name}/${component}`}
          key={baseItem.name}
        >
          {baseItem.title}
        </Link>
      ))}
      {activeBase?.meta?.logo && (
        <div
          className="ml-auto size-4 shrink-0 text-site-muted-foreground opacity-80 [&_svg]:size-4"
          dangerouslySetInnerHTML={{
            __html: activeBase.meta.logo as string,
          }}
        />
      )}
    </div>
  );
}
