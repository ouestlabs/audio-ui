import { type Axis, axisChoices } from "@/lib/design-system/look";

/** The axes of the skins as the reader set them in the Look: null where the skin keeps its own. */
export function useSkinAxes() {
  const [shade, chooseShade] = axisChoices["--audio-shade"].useChoice();
  const [accent, chooseAccent] = axisChoices["--audio-accent"].useChoice();
  const [depth, chooseDepth] = axisChoices["--audio-depth"].useChoice();
  const [roundness, chooseRoundness] =
    axisChoices["--audio-roundness"].useChoice();
  const values: Record<Axis, string | null> = {
    "--audio-accent": accent,
    "--audio-depth": depth,
    "--audio-roundness": roundness,
    "--audio-shade": shade,
  };
  const choose: Record<Axis, (value: string | null) => void> = {
    "--audio-accent": chooseAccent,
    "--audio-depth": chooseDepth,
    "--audio-roundness": chooseRoundness,
    "--audio-shade": chooseShade,
  };
  return { choose, values };
}
