import type * as React from "react";
import { ComponentSource } from "@/components/component-source";
import {
  resolveRegistryIconLibrary,
  resolveRegistryStyleName,
} from "@/lib/docs-registry-options";

import { DocsComponentSourceSwitch } from "./docs-mdx-components.client";

export function DocsComponentSource(
  props: React.ComponentProps<typeof ComponentSource>
) {
  const initialStyleName = resolveRegistryStyleName(props.styleName);
  const initialIconLibrary = resolveRegistryIconLibrary(
    props.iconLibrary,
    initialStyleName
  );

  return (
    <DocsComponentSourceSwitch
      {...props}
      initialIconLibrary={initialIconLibrary}
      initialStyleName={initialStyleName}
    >
      <ComponentSource
        {...props}
        iconLibrary={initialIconLibrary}
        styleName={initialStyleName}
      />
    </DocsComponentSourceSwitch>
  );
}
