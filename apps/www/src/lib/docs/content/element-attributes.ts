import type { PrimitiveExample } from "@/lib/docs/content/primitive-examples";

const UPPER_CASE = /([A-Z])/g;

/** An example's props as the elements take them: kebab-cased attributes, the starting value being `value`. */
export function elementAttributes(
  props: PrimitiveExample["props"]
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(props).map(([name, value]) => [
      name === "defaultValue"
        ? "value"
        : name.replace(UPPER_CASE, (letter) => `-${letter.toLowerCase()}`),
      value === true ? "" : String(value),
    ])
  );
}
