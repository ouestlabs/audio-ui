import { definePrimitive as definePrimitiveOf } from "@ui-sdk/core";

const KEBAB = /([a-z0-9])([A-Z])/g;
const kebab = (name: string) => name.replace(KEBAB, "$1-$2").toLowerCase();

/**
 * The part a primitive draws names itself in `data-slot`, in kebab case
 * (`piano-roll-note`, `timeline-track-header`), and a component that gives
 * its own name to a part (`timeline-time-selection`) keeps it: the kernel
 * writes its own, which this replaces by the one the part was given.
 */
function nameSlots(name: string, slots: Record<string, any>) {
  const prefix = kebab(name);
  for (const [key, definition] of Object.entries(slots)) {
    const fallback = key === "root" ? prefix : `${prefix}-${kebab(key)}`;
    const { attrs } = definition;
    definition.attrs = (state: unknown, context: { props?: object }) => ({
      ...attrs?.(state, context),
      "data-slot":
        (context.props as Record<string, string> | undefined)?.["data-slot"] ??
        fallback,
    });
    definition.props = { ...definition.props, "data-slot": "string" };
  }
  return slots;
}

/** `definePrimitive` of the kernel, with the parts named in kebab case and a `data-slot` that can be given. */
export const definePrimitive = ((options: any) =>
  definePrimitiveOf({
    ...options,
    slots: (slot: unknown) => nameSlots(options.name, options.slots(slot)),
  })) as typeof definePrimitiveOf;
