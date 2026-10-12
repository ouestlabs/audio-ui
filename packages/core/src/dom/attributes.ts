export function getDataAttributes(
  component: string,
  options: {
    part?: string;
    orientation?: "horizontal" | "vertical";
    disabled?: boolean;
    [key: string]: string | boolean | undefined;
  } = {}
): Record<string, string | undefined> {
  const attrs: Record<string, string | undefined> = {};

  if (options.part) {
    attrs[`data-${options.part}`] = "";
  } else {
    attrs[`data-${component}`] = "";
  }

  if (options.orientation) {
    attrs["data-orientation"] = options.orientation;
  }

  if (options.disabled) {
    attrs["data-disabled"] = "true";
  }

  for (const key of Object.keys(options)) {
    if (
      key !== "part" &&
      key !== "orientation" &&
      key !== "disabled" &&
      options[key] !== undefined
    ) {
      const value = options[key];
      attrs[`data-${key}`] =
        typeof value === "boolean" ? String(value) : String(value);
    }
  }

  return attrs;
}
