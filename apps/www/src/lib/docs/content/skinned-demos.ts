/** The previews that have a Hardware counterpart, by the name of the Digital one. */
export const HARDWARE_DEMOS: Record<string, string> = {
  "fader-vertical-demo": "fader-hardware-demo",
  "knob-demo": "knob-hardware-demo",
  "meter-size-default-demo": "meter-hardware-demo",
};

export const isSkinned = (name: string) =>
  name in HARDWARE_DEMOS || Object.values(HARDWARE_DEMOS).includes(name);
