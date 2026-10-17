import type * as React from "react";
import { ComponentPreview } from "@/components/preview/component/component-preview";
import {
  resolveRegistryIconLibrary,
  resolveRegistryStyleName,
} from "@/lib/docs/content/docs-registry-options";

import { DocsComponentPreviewSwitch } from "../../docs/mdx/mdx-components-client";

export function DocsComponentPreview(
  props: React.ComponentProps<typeof ComponentPreview>
) {
  const initialStyleName = resolveRegistryStyleName(props.styleName);
  const initialIconLibrary = resolveRegistryIconLibrary(
    props.iconLibrary,
    initialStyleName
  );

  return (
    <DocsComponentPreviewSwitch
      {...props}
      initialIconLibrary={initialIconLibrary}
      initialStyleName={initialStyleName}
    >
      <ComponentPreview
        {...props}
        iconLibrary={initialIconLibrary}
        styleName={initialStyleName}
      />
    </DocsComponentPreviewSwitch>
  );
}
