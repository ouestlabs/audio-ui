const KEY = "design-system-boot";
const THEME_STYLE_ID = "design-system-theme-vars";

/**
 * Keeps what the design system put on the page, so the next load can put it
 * back before the first paint: the theme's variables, the style and base
 * color classes, the fonts. Without it the page is drawn in the default look
 * and changes to the chosen one once the scripts have run.
 */
export function saveDesignSystemBoot() {
  try {
    const root = document.documentElement;
    const body = document.body;
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
        fontHeading: root.style.getPropertyValue("--font-heading"),
        fontSans: root.style.getPropertyValue("--font-sans"),
      })
    );
  } catch {
    // Storage may be off: the page is then drawn in the default look first.
  }
}

/**
 * Run in `<head>`, before anything is painted: puts the saved look back. The
 * classes go on the body as soon as the parser creates it, before it is drawn.
 */
export const DESIGN_SYSTEM_BOOT_SCRIPT = `(function(){try{var d=JSON.parse(localStorage.getItem("${KEY}")||"null");if(!d)return;var r=document.documentElement;if(d.css){var s=document.getElementById("${THEME_STYLE_ID}");if(!s){s=document.createElement("style");s.id="${THEME_STYLE_ID}";document.head.appendChild(s)}s.textContent=d.css}if(d.fontSans){r.style.setProperty("--font-sans",d.fontSans)}if(d.fontHeading){r.style.setProperty("--font-heading",d.fontHeading)}function onBody(b){Array.prototype.slice.call(b.classList).forEach(function(c){if(c.indexOf("style-")===0||c.indexOf("base-color-")===0)b.classList.remove(c)});(d.classes||[]).forEach(function(c){b.classList.add(c)});if(d.bodyFont){b.style.fontFamily=d.bodyFont}}if(document.body){onBody(document.body)}else{var o=new MutationObserver(function(){if(document.body){o.disconnect();onBody(document.body)}});o.observe(r,{childList:true})}}catch(e){}})();`;
