"use client";

import { Suspense, useMemo } from "react";
import { PreviewLoading } from "@/components/preview/frame/preview-frame";
import { getRegistryComponent } from "@/lib/registry/core/registry";

export function ComponentClient({
  name,
  styleName,
}: {
  name: string;
  styleName: string;
}) {
  const Component = useMemo(
    () => getRegistryComponent(name, styleName),
    [name, styleName]
  );

  if (!Component) {
    return null;
  }

  return (
    <Suspense fallback={<PreviewLoading />}>
      <Component />
    </Suspense>
  );
}
