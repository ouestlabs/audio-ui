import type { ReactNode } from "react";
import { useStyling } from "@/hooks/use-styling";

/**
 * Content for one way of styling the elements, `css` or `tailwind`: shown when
 * it is the one the reader chose in the customizer, CSS until they choose. The
 * markdown of the page keeps both, each under its name.
 */
export function ForStyling({
  children,
  only,
}: {
  children: ReactNode;
  only: string;
}) {
  const [styling] = useStyling();
  return styling === only ? children : null;
}
