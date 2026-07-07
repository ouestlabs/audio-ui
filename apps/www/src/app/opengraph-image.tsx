import { loadOGFont } from "@/lib/fonts";
import { generateHomeOG, makeImageResponse } from "@/lib/og";

export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const fontData = await loadOGFont();
  return makeImageResponse(generateHomeOG(), fontData);
}
