import { useSkinAxes } from "@/hooks/use-skin-axes";
import { lookDeclarations } from "@/lib/design-system/look";

/**
 * The axes the reader set, on every skinned element of the page. A skin sets
 * its own on its class, in the dark too, so the rule is made more specific
 * than `.dark .skin-neu`.
 */
export function LookStyle() {
  const { values } = useSkinAxes();
  const declarations = lookDeclarations(values);
  if (declarations.length === 0) {
    return null;
  }
  return (
    <style>{`:root :is(.skin-hardware, .skin-neu):is(.skin-hardware, .skin-neu) { ${declarations.join(" ")} }`}</style>
  );
}
