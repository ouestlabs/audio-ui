import { appConfig } from "@/lib/config";
import { loadGoogleFont } from "@/lib/fonts";
import { generateHomeOG, makeImageResponse } from "@/lib/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  let fontData: ArrayBuffer | null = null;
  try {
    fontData = await loadGoogleFont(
      "Instrument Serif",
      `audio/ui ${appConfig.description}`
    );
  } catch {
    fontData = null;
  }

  return makeImageResponse(generateHomeOG(), fontData);
}
