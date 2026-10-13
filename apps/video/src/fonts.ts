import { loadFont as loadSans } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";

// The site's three faces, under the family names globals.css already uses.
loadSans("normal", { subsets: ["latin"], weights: ["400", "500", "600"] });
loadSerif("normal", { subsets: ["latin"] });
loadMono("normal", { subsets: ["latin"], weights: ["400", "500"] });
