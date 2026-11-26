import { createKeptChoice } from "@/hooks/use-kept-choice";

export const SKINS = [
  { id: "digital", label: "Digital" },
  { id: "hardware", label: "Hardware" },
  { id: "neu", label: "Neu" },
] as const;

export type SkinId = (typeof SKINS)[number]["id"];

export const isSkin = (value: unknown): value is SkinId =>
  SKINS.some((skin) => skin.id === value);

const choice = createKeptChoice<SkinId>({
  isValid: isSkin,
  key: "audio-ui-skin",
  param: "skin",
});

/** The skin the previews are drawn in, as the reader chose it: Digital until they do. */
export function useSkin() {
  const [chosen, choose] = choice.useChoice();
  return [chosen ?? "digital", choose] as const;
}
