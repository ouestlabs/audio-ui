"use client";

import { SquareIcon } from "lucide-react";
import * as React from "react";
import { lazy, Suspense } from "react";
import type { IconLibraryName } from "shadcn/icons";
import { DesignSystemContext } from "@/app/(create)/customizer/design-system-provider";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";

const IconLucide = lazy(() =>
  import("@/registry/icons/icon-lucide").then((mod) => ({
    default: mod.IconLucide,
  }))
);

const IconTabler = lazy(() =>
  import("@/registry/icons/icon-tabler").then((mod) => ({
    default: mod.IconTabler,
  }))
);

const IconHugeicons = lazy(() =>
  import("@/registry/icons/icon-hugeicons").then((mod) => ({
    default: mod.IconHugeicons,
  }))
);

const IconPhosphor = lazy(() =>
  import("@/registry/icons/icon-phosphor").then((mod) => ({
    default: mod.IconPhosphor,
  }))
);

const IconRemixicon = lazy(() =>
  import("@/registry/icons/icon-remixicon").then((mod) => ({
    default: mod.IconRemixicon,
  }))
);

export function IconPlaceholder({
  ...props
}: {
  [K in IconLibraryName]: string;
} & React.ComponentProps<"svg">) {
  const mounted = useMounted();
  const context = React.use(DesignSystemContext);
  const [params] = useDesignSystemSearchParams();
  const [config] = useConfig();

  // Priority: Context (includes overrides) > URL Params > LocalStorage Config
  const iconLibraryValue =
    context?.iconLibrary ?? params.iconLibrary ?? config.iconLibrary;
  const iconName = props[iconLibraryValue];

  if (!(iconName && mounted)) {
    return null;
  }

  return (
    <Suspense
      fallback={<SquareIcon {...props} />}
      key={`${iconLibraryValue}-${iconName}`}
    >
      {iconLibraryValue === "lucide" && (
        <IconLucide name={iconName} {...props} />
      )}
      {iconLibraryValue === "tabler" && (
        <IconTabler name={iconName} {...props} />
      )}
      {iconLibraryValue === "hugeicons" && (
        <IconHugeicons name={iconName} {...props} />
      )}
      {iconLibraryValue === "phosphor" && (
        <IconPhosphor name={iconName} {...props} />
      )}
      {iconLibraryValue === "remixicon" && (
        <IconRemixicon name={iconName} {...props} />
      )}
    </Suspense>
  );
}
