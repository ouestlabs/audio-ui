import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useMounted } from "@/hooks/use-mounted";

// Trimmed from upstream shadcn v4 `lib/colors.ts`, which is absent from this
// fork copy — this hook is its only consumer.
type ColorFormat = "className" | "hex" | "rgb" | "hsl" | "oklch" | "var";

type Config = {
  format: ColorFormat;
  lastCopied: string;
};

const colorsAtom = atomWithStorage<Config>("colors", {
  format: "hsl",
  lastCopied: "",
});

export function useColors() {
  const [colors, setColors] = useAtom(colorsAtom);
  const mounted = useMounted();

  return {
    isLoading: !mounted,
    format: colors.format,
    lastCopied: colors.lastCopied,
    setFormat: (format: ColorFormat) => setColors({ ...colors, format }),
    setLastCopied: (lastCopied: string) => setColors({ ...colors, lastCopied }),
  };
}
