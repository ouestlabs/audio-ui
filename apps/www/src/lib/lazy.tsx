import { ClientOnly } from "@tanstack/react-router";
import { type ComponentType, lazy, type ReactNode, Suspense } from "react";

/**
 * A component loaded when it first renders, with what to show meanwhile. It
 * keeps a heavy part (the command menu, the customizer) out of the first
 * bundle: the page does not wait for it, and the fallback holds its place.
 */
export function lazyComponent<Props extends object>(
  load: () => Promise<ComponentType<Props>>,
  {
    loading = () => null,
    ssr = true,
  }: {
    loading?: () => ReactNode;
    /** Whether the server renders it too; off, it renders in the browser alone. */
    ssr?: boolean;
  } = {}
) {
  const Lazy = lazy(async () => ({ default: await load() }));
  return function LazyComponent(props: Props) {
    const content = (
      <Suspense fallback={loading()}>
        <Lazy {...(props as Props & object)} />
      </Suspense>
    );
    return ssr ? (
      content
    ) : (
      <ClientOnly fallback={loading()}>{content}</ClientOnly>
    );
  };
}
