import { useLocation } from "@tanstack/react-router";
import { useCallback } from "react";
import { LogoOf } from "@/components/site/navigation/framework-select";
import { useFramework } from "@/hooks/use-framework";
import {
  FRAMEWORKS,
  type FrameworkId,
  isFramework,
  shownTo,
} from "@/lib/docs/content/frameworks";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";

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
  const items = offered.map((each) => ({ label: each.label, value: each.id }));
  const current: FrameworkId = offered.some((each) => each.id === framework)
    ? framework
    : "react";
  return (
    <Select items={items} onValueChange={pick} value={current}>
      <SelectTrigger aria-label="Framework" className="h-8 w-32">
        <SelectValue>
          {(value: FrameworkId) => (
            <span className="flex items-center gap-1.5">
              <LogoOf id={value} />
              {FRAMEWORKS.find((each) => each.id === value)?.label}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              <span className="flex items-center gap-1.5">
                <LogoOf id={item.value} />
                {item.label}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
