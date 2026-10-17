import { useConfig } from "@/hooks/use-config";
import { getPresetCode, PRESET_KEYS } from "@/lib/design-system/preset-code";
import { useDesignSystemSearchParams } from "@/lib/design-system/search-params";

/** The code of the design on screen: the URL's choices first, the saved ones after, as the page applies them. */
export function usePresetCode() {
  const [params] = useDesignSystemSearchParams();
  const [config] = useConfig();
  const values: Record<string, string> = {};
  for (const key of PRESET_KEYS) {
    values[key] = params[key] ?? config[key];
  }
  return getPresetCode(values);
}
