import { createKeptChoice } from "@/hooks/use-kept-choice";
import {
  DEFAULT_STYLING,
  isStyling,
  type StylingId,
} from "@/lib/docs/content/stylings";

const styling = createKeptChoice<StylingId>({
  isValid: isStyling,
  key: "audio-ui-styling",
  param: "styling",
});

/**
 * How the elements' examples write their styles, as the reader chose it in the
 * customizer: kept in their browser and in the address as `?styling=`. CSS
 * until they choose, on the server too.
 */
export function useStyling() {
  const [chosen, choose] = styling.useChoice();
  return [chosen ?? DEFAULT_STYLING, choose] as const;
}
