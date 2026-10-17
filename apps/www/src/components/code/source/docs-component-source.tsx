import type * as React from "react";
import { ComponentSource } from "@/components/code/source/component-source";
import { useDocsRegistryOptions } from "@/hooks/use-docs-registry-options";

export function DocsComponentSource(
  props: React.ComponentProps<typeof ComponentSource>
) {
  const options = useDocsRegistryOptions(props.styleName, props.iconLibrary);
  // A source read from a file has no style to switch.
  return <ComponentSource {...props} {...(props.src ? {} : options)} />;
}
