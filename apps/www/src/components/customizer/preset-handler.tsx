import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useRef } from "react";
import { generateRandomPreset } from "shadcn/preset";
import { useConfig } from "@/hooks/use-config";
import { readPresetCode } from "@/lib/design-system/preset-code";

/**
 * Puts a design the page arrives with, `?preset=<code>` (or `random`), into the
 * saved choices, so it carries to the next page. A value that is no code is
 * dropped from the URL; the saved choices stay as they were.
 */
export function PresetHandler() {
  const [preset, setPreset] = useQueryState(
    "preset",
    parseAsString.withOptions({ history: "replace", shallow: true })
  );
  const [, setConfig] = useConfig();
  const handled = useRef<boolean>(false);

  useEffect(() => {
    if (handled.current || preset === null) {
      return;
    }
    handled.current = true;
    const code = preset === "random" ? generateRandomPreset() : preset;
    const design = readPresetCode(code);
    if (!design) {
      setPreset(null);
      return;
    }
    setConfig((previous) => ({ ...previous, ...design }));
    if (code !== preset) {
      setPreset(code);
    }
  }, [preset, setConfig, setPreset]);

  return null;
}
