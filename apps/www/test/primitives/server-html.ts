/** What a knob at 40% holds in its server HTML, before any script runs. */
export const serverFeatures = (markup: string) => ({
  arc: markup.includes("<path"),
  rangeInput: markup.includes('type="range"'),
  rotation: markup.includes("rotate:"),
  valueText: markup.includes("40%"),
});

export const EVERY_FEATURE = {
  arc: true,
  rangeInput: true,
  rotation: true,
  valueText: true,
};
