/**
 * The snippet every device page shows under Panel: the panel and the device of
 * a page, named from its slug, with the state kept in the host. One place
 * writes it, so a rename of a device cannot leave a page behind.
 */

const FIRST_LETTER = /^./;

const upper = (word: string) =>
  word.replace(FIRST_LETTER, (c) => c.toUpperCase());

/** `auto-pan` as `autoPan`. */
export function camelName(slug: string) {
  const [first = "", ...rest] = slug.split("-");
  return first + rest.map(upper).join("");
}

/** `auto-pan` as `AutoPan`. */
export function pascalName(slug: string) {
  return slug.split("-").map(upper).join("");
}

/** The usage of a device's panel, as the code a page shows. */
export function devicePanelUsage(slug: string) {
  const panel = `${pascalName(slug)}Panel`;
  const device = `${camelName(slug)}Device`;
  return [
    `import { ${panel} } from "@/components/audio-ui/devices/${slug}/panel";`,
    `import { ${device} } from "@/components/audio-ui/devices/${slug}/device";`,
    "",
    `const [state, setState] = useState(() => ${device}.defaults());`,
    "",
    `<${panel} onValueChange={setState} value={state} />;`,
  ].join("\n");
}

const USAGE_REGEX = /<DeviceUsage\s+name="([a-z-]+)"\s*\/>/g;

/** Each `<DeviceUsage />` of a page as the fence it stands for, for the pages served as markdown. */
export function expandDeviceUsage(content: string) {
  return content.replace(
    USAGE_REGEX,
    (_tag, slug: string) => `\`\`\`tsx\n${devicePanelUsage(slug)}\n\`\`\``
  );
}
