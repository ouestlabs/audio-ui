import { createKeptChoice } from "@/hooks/use-kept-choice";
import {
  type DensityId,
  isDensity,
  isSize,
  type SizeId,
} from "@/lib/docs/content/stylings";

const size = createKeptChoice<SizeId>({
  isValid: isSize,
  key: "audio-ui-size",
  param: "size",
});
const density = createKeptChoice<DensityId>({
  isValid: isDensity,
  key: "audio-ui-density",
  param: "density",
});

/** How large the elements' examples are drawn, as the reader chose in the customizer: Default until they do. */
export function useSize() {
  const [chosen, choose] = size.useChoice();
  return [chosen ?? "default", choose] as const;
}

/** How far apart the examples' parts sit, as the reader chose in the customizer: Default until they do. */
export function useDensity() {
  const [chosen, choose] = density.useChoice();
  return [chosen ?? "default", choose] as const;
}
