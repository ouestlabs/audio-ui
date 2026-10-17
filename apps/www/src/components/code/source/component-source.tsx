import type * as React from "react";
import {
  ComponentSourceClient,
  type ComponentSourceClientProps,
} from "@/components/code/source/component-source-client";

/**
 * The source of a registry item, in the style asked for. It is read in the
 * browser from the item's static JSON, which the build wrote for every style,
 * so one component serves the default style and the one a reader picks.
 */
export function ComponentSource(
  props: React.ComponentProps<"div"> & ComponentSourceClientProps
) {
  return <ComponentSourceClient {...props} />;
}
