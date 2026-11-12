import type { CSSProperties } from "react";
import { useDensity, useSize } from "@/hooks/use-look";
import { useStyling } from "@/hooks/use-styling";
import { DENSITIES, SIZES } from "@/lib/docs/content/stylings";

/**
 * What a live preview of the elements or the React primitives wears: the
 * styling the reader chose, and the spacing unit and the density their size
 * and density give, as variables for the preview alone.
 */
export function usePreviewLook() {
  const [styling] = useStyling();
  const [size] = useSize();
  const [density] = useDensity();
  const style = {
    "--density": DENSITIES.find((each) => each.id === density)?.factor,
    "--spacing": `${0.25 * (SIZES.find((each) => each.id === size)?.factor ?? 1)}rem`,
  } as CSSProperties;
  return { style, styling };
}
