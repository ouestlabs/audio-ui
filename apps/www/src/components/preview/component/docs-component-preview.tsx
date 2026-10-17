import type * as React from "react";
import { ComponentPreview } from "@/components/preview/component/component-preview";
import { useDocsRegistryOptions } from "@/hooks/use-docs-registry-options";

export function DocsComponentPreview(
  props: React.ComponentProps<typeof ComponentPreview>
) {
  const options = useDocsRegistryOptions(props.styleName, props.iconLibrary);
  return <ComponentPreview {...props} {...options} />;
}
