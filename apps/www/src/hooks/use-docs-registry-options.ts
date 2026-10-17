import { useSyncExternalStore } from "react";
import { useConfig } from "@/hooks/use-config";
import {
  getSelectedRegistryStyleName,
  resolveRegistryIconLibrary,
  resolveRegistryStyleName,
} from "@/lib/docs/content/docs-registry-options";
import type { IconLibraryName } from "@/registry/config";

const emptySubscribe = () => () => {
  // Nothing to clean up: localStorage config presence is read per render.
};

/** The style and icon library a docs example is shown in: the page's own until the reader has saved a choice, then theirs. */
export function useDocsRegistryOptions(
  styleName?: string,
  iconLibrary?: IconLibraryName
) {
  const pageStyleName = resolveRegistryStyleName(styleName);
  const pageIconLibrary = resolveRegistryIconLibrary(
    iconLibrary,
    pageStyleName
  );
  const [config] = useConfig();
  const hasStoredConfig = useSyncExternalStore(
    emptySubscribe,
    () => window.localStorage.getItem("config") !== null,
    () => false
  );

  if (!hasStoredConfig) {
    return { iconLibrary: pageIconLibrary, styleName: pageStyleName };
  }
  const selectedStyleName = getSelectedRegistryStyleName(
    config.base,
    config.style
  );
  return {
    iconLibrary: resolveRegistryIconLibrary(
      config.iconLibrary,
      selectedStyleName
    ),
    styleName: selectedStyleName,
  };
}
