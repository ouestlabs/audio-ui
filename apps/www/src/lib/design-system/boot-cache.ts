import { STYLE_CSS_URLS } from "@/lib/design-system/style-css";

const KEY = "design-system-boot";

const SCRIPT_UNSAFE: Record<string, string> = {
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
  "/": "\\u002F",
  "<": "\\u003C",
  ">": "\\u003E",
};

/** A value as JSON that is safe inside an inline script: nothing in it can close the tag or break the line. */
function toScriptJson(value: unknown) {
  return JSON.stringify(value).replace(
    /[<>/\u2028\u2029]/g,
    (char) => SCRIPT_UNSAFE[char] ?? char
  );
}
const THEME_STYLE_ID = "design-system-theme-vars";

/** The stylesheet text of each web font already fetched, by address: kept so a later load can inline it. */
const fontCssByHref = new Map<string, string>();

/** The `@font-face` rules of the fonts the page loads, once they are fetched. */
function activeFontCss() {
  const links = document.head.querySelectorAll<HTMLLinkElement>(
    "link[data-preview-font]"
  );
  let css = "";
  for (const link of links) {
    const known = fontCssByHref.get(link.href);
    if (known !== undefined) {
      css += known;
      continue;
    }
    // Fetched once, then saved again with it.
    fontCssByHref.set(link.href, "");
    fetch(link.href)
      .then((response) => response.text())
      .then((text) => {
        fontCssByHref.set(link.href, text);
        saveDesignSystemBoot();
      })
      .catch(() => fontCssByHref.delete(link.href));
  }
  return css;
}

/**
 * Keeps what the design system put on the page, so the next load can put it
 * back before the first paint: the theme's variables, the style and base
 * color classes, the fonts. Without it the page is drawn in the default look
 * and changes to the chosen one once the scripts have run.
 */
export function saveDesignSystemBoot() {
  try {
    const root = document.documentElement;
    const { body } = document;
    const css = document.getElementById(THEME_STYLE_ID)?.textContent ?? "";
    if (!css) {
      return;
    }
    localStorage.setItem(
      KEY,
      JSON.stringify({
        bodyFont: body.style.fontFamily,
        classes: Array.from(body.classList).filter(
          (name) => name.startsWith("style-") || name.startsWith("base-color-")
        ),
        css,
        fontCss: activeFontCss(),
        fontHeading: root.style.getPropertyValue("--font-heading"),
        fontSans: root.style.getPropertyValue("--font-sans"),
      })
    );
  } catch {
    // Storage may be off: the page is then drawn in the default look first.
  }
}

/**
 * Run in `<head>`, before anything is painted: puts the saved look back, and
 * notes which sidebars were shut so the page is drawn that way from the start. The
 * classes go on the body as soon as the parser creates it, before it is drawn.
 */
export const DESIGN_SYSTEM_BOOT_SCRIPT = `(function(){try{var r=document.documentElement;var c=JSON.parse(localStorage.getItem("config")||"null");if(c&&c.customizerOpen===false)r.setAttribute("data-customizer-closed","");var l=JSON.parse(localStorage.getItem("components-layout")||"null");if(l&&l.sidebarOpen===false)r.setAttribute("data-nav-closed","");var d=JSON.parse(localStorage.getItem("${KEY}")||"null");if(!d)return;var u=${toScriptJson(STYLE_CSS_URLS)};(d.classes||[]).forEach(function(c){if(c.indexOf("style-")===0){var n=c.slice(6);if(u[n]){var k=document.createElement("link");k.rel="stylesheet";k.href=u[n];k.setAttribute("data-style-css",n);document.head.appendChild(k)}}});if(d.css){var s=document.getElementById("${THEME_STYLE_ID}");if(!s){s=document.createElement("style");s.id="${THEME_STYLE_ID}";document.head.appendChild(s)}s.textContent=d.css}if(d.fontCss){var f=document.createElement("style");f.id="design-system-boot-fonts";f.textContent=d.fontCss;document.head.appendChild(f)}if(d.fontSans){r.style.setProperty("--font-sans",d.fontSans)}if(d.fontHeading){r.style.setProperty("--font-heading",d.fontHeading)}function onBody(b){Array.prototype.slice.call(b.classList).forEach(function(c){if(c.indexOf("style-")===0||c.indexOf("base-color-")===0)b.classList.remove(c)});(d.classes||[]).forEach(function(c){b.classList.add(c)});if(d.bodyFont){b.style.fontFamily=d.bodyFont}}if(document.body){onBody(document.body)}else{var o=new MutationObserver(function(){if(document.body){o.disconnect();onBody(document.body)}});o.observe(r,{childList:true})}}catch(e){}})();`;
