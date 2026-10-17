import lumaCss from "@/styles/style-luma.css?url";
import lyraCss from "@/styles/style-lyra.css?url";
import maiaCss from "@/styles/style-maia.css?url";
import miraCss from "@/styles/style-mira.css?url";
import rheaCss from "@/styles/style-rhea.css?url";
import seraCss from "@/styles/style-sera.css?url";
import vegaCss from "@/styles/style-vega.css?url";

/** The sheet of each style but the default one, which is part of globals.css: a page carries the CSS of the style it shows, not the eight. */
export const STYLE_CSS_URLS: Record<string, string> = {
  luma: lumaCss,
  lyra: lyraCss,
  maia: maiaCss,
  mira: miraCss,
  rhea: rheaCss,
  sera: seraCss,
  vega: vegaCss,
};

const SHEET_ATTRIBUTE = "data-style-css";

/** Adds the sheet of a style to the page, once. */
function ensureStyleCss(style: string) {
  const href = STYLE_CSS_URLS[style];
  if (
    !href ||
    document.head.querySelector(`link[${SHEET_ATTRIBUTE}="${style}"]`)
  ) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(SHEET_ATTRIBUTE, style);
  document.head.appendChild(link);
}

/** Loads the sheet of whichever style the body carries, now and each time its class changes. Returns what stops it. */
export function watchStyleCss() {
  const load = () => {
    for (const name of document.body.classList) {
      if (name.startsWith("style-")) {
        ensureStyleCss(name.slice("style-".length));
      }
    }
  };
  load();
  const observer = new MutationObserver(load);
  observer.observe(document.body, {
    attributeFilter: ["class"],
    attributes: true,
  });
  return () => observer.disconnect();
}
