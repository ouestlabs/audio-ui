import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  Geist_Mono as FontMono,
  Bricolage_Grotesque as FontSans,
  Inter,
} from "next/font/google";
import FontSerif from "next/font/local";

let ogFontCache: ArrayBuffer | null = null;

async function loadOGFont(): Promise<ArrayBuffer> {
  if (ogFontCache) {
    return ogFontCache;
  }
  const file = await readFile(
    path.join(process.cwd(), "lib/fonts/InstrumentSerif-Regular.ttf")
  );
  ogFontCache = file.buffer;
  return ogFontCache;
}

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const fontSerif = FontSerif({
  src: "./InstrumentSerif-Regular.ttf",
  variable: "--font-serif",
  weight: "400",
});

const fontMono = FontMono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export { loadOGFont, fontSans, fontSerif, fontMono, inter };
