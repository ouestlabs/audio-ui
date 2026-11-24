import { loadFont as loadSans } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";

// The site's sans and mono, and the serif of the videos' wordmark. styles.css
// names them where globals.css expects them.
loadSans("normal", { subsets: ["latin"], weights: ["400", "500", "600"] });
loadSerif("normal", { subsets: ["latin"] });
loadMono("normal", { subsets: ["latin"], weights: ["400", "500"] });
