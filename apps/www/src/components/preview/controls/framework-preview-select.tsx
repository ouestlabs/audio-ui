import { useLocation } from "@tanstack/react-router";
import { useCallback } from "react";
import { Icons } from "@/components/site/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFramework } from "@/hooks/use-framework";
import {
  FRAMEWORKS,
  type FrameworkId,
  isFramework,
  shownTo,
} from "@/lib/docs/content/frameworks";

/** Each framework's logo, as the sidebar's switch draws it; the web's is JavaScript's. */
const LOGOS: Record<
  FrameworkId,
  (props: React.SVGAttributes<SVGElement>) => React.ReactNode
> = {
  react: Icons.reactColor,
  svelte: Icons.svelte,
  vue: Icons.vue,
  web: Icons.javascript,
};

/**
 * The framework a preview is drawn in, from its bar: the frameworks this page
 * is written for, the reader's choice first. It is the sidebar's choice, so
 * the preview, the code and the install below change with it. A page for
 * React alone has nothing to choose: `fallback` shows instead.
 */
export function FrameworkPreviewSelect({
  fallback,
}: {
  fallback: React.ReactNode;
}) {
  const [framework, choose] = useFramework();
  const pathname = useLocation({ select: (location) => location.pathname });
  const offered = FRAMEWORKS.filter((each) => shownTo(pathname, each.id));
  const pick = useCallback(
    (next: unknown) => {
      if (isFramework(next)) {
        choose(next);
      }
    },
    [choose]
  );
  if (offered.length < 2) {
    return fallback;
  }
  const current: FrameworkId = offered.some((each) => each.id === framework)
    ? framework
    : "react";
  return (
    <Select onValueChange={pick} value={current}>
      <SelectTrigger aria-label="Framework">
        <SelectValue>
          {({ value }) => {
            const Logo = LOGOS[value as FrameworkId];
            return (
              <span className="flex items-center gap-2">
                <Logo aria-hidden="true" className="size-3.5 shrink-0" />
                {FRAMEWORKS.find((each) => each.id === value)?.label}
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {offered.map((each) => {
          const Logo = LOGOS[each.id];
          return (
            <SelectItem key={each.id} label={each.label} value={each.id}>
              <span className="flex items-center gap-2">
                <Logo aria-hidden="true" className="size-3.5 shrink-0" />
                {each.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
