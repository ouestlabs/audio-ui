import { loadOGFont } from "@/lib/fonts";
import { generateHomeOG, makeImageResponse } from "@/lib/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const fontData = await loadOGFont();
  return makeImageResponse(generateHomeOG(), fontData);
}
