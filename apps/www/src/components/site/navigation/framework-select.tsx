import { CaretUpDownIcon, CheckIcon } from "@phosphor-icons/react/ssr";
import { useCallback } from "react";
import { Icons } from "@/components/site/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFramework } from "@/hooks/use-framework";
import {
  FRAMEWORKS,
  type Framework,
  type FrameworkId,
} from "@/lib/docs/content/frameworks";

/** Each framework's logo; the web's is JavaScript's, as in the hero. */
const LOGOS: Record<
  FrameworkId,
  (props: React.SVGAttributes<SVGElement>) => React.ReactNode
> = {
  react: Icons.reactColor,
  svelte: Icons.svelte,
  vue: Icons.vue,
  web: Icons.javascript,
};

export function LogoOf({ id }: { id: FrameworkId }) {
  const Logo = LOGOS[id];
  return <Logo aria-hidden="true" className="size-4" />;
}

/** A framework's logo in a small bordered square, as a section's glyph is drawn. */
function FrameworkBadge({ id }: { id: FrameworkId }) {
  const Logo = LOGOS[id];
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
      <Logo aria-hidden="true" className="size-4" />
    </span>
  );
}

/** A framework's name over what it gets of audio/ui. */
function FrameworkText({ framework }: { framework: Framework }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate font-medium text-foreground text-sm">
        {framework.label}
      </span>
      <span className="truncate text-muted-foreground text-xs">
        {framework.description}
      </span>
    </span>
  );
}

/** One framework of the menu, checked when it is the one chosen. */
function FrameworkItem({
  chosen,
  framework,
  onChoose,
}: {
  chosen: boolean;
  framework: Framework;
  onChoose: (id: FrameworkId) => void;
}) {
  const { id } = framework;
  const choose = useCallback(() => onChoose(id), [id, onChoose]);
  return (
    <DropdownMenuItem className="gap-2 p-1.5" onClick={choose}>
      <FrameworkBadge id={id} />
      <FrameworkText framework={framework} />
      {chosen ? (
        <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
      ) : null}
    </DropdownMenuItem>
  );
}

/**
 * The framework the reader uses, as one menu under the section menu: the hero
 * names it, the sidebar puts its sections first, and the pages show their code
 * and their install for it. Its button shows the framework chosen, or that
 * none is; in a section for React alone (React's primitives), React, and
 * another framework picked there opens the elements, its own. `compact` draws the button on one line, for the bar of the inset
 * while the sidebar is shut.
 */
export function FrameworkSelect({ compact = false }: { compact?: boolean }) {
  const [framework, choose] = useFramework();
  const current =
    FRAMEWORKS.find((each) => each.id === framework) ?? FRAMEWORKS[0];
  return (
    <DropdownMenu>
      {compact ? (
        <DropdownMenuTrigger
          aria-label={`Framework: ${current.label}`}
          className="flex h-8 items-center gap-1.5 rounded-md border bg-muted/50 px-2 font-medium text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted"
          data-fw={framework}
          data-fw-trigger=""
        >
          {FRAMEWORKS.map((each) => (
            <span data-fw-view={each.id} key={each.id}>
              <LogoOf id={each.id} />
              {each.label}
            </span>
          ))}
          <CaretUpDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          aria-label={`Framework: ${current.label}`}
          className="flex w-full items-center gap-2 rounded-lg border bg-muted/50 p-1.5 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted"
          data-fw={framework}
          data-fw-trigger=""
        >
          {FRAMEWORKS.map((each) => (
            <span data-fw-view={each.id} key={each.id}>
              <FrameworkBadge id={each.id} />
              <FrameworkText framework={each} />
            </span>
          ))}
          <CaretUpDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent className={compact ? "w-64" : undefined}>
        {FRAMEWORKS.map((each) => (
          <FrameworkItem
            chosen={each.id === current.id}
            framework={each}
            key={each.id}
            onChoose={choose}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
