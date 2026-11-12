/** A figure of the home: a count, what it counts, and where it can be checked. */
export interface HomeFigure {
  href: string;
  label: string;
  value: string;
}

/** The library in figures, under the components' lead, each a link to where it can be checked; the labels set in mono. */
export function HomeFigures({ figures }: { figures: HomeFigure[] }) {
  return (
    <section aria-label="In figures">
      <ul className="grid grid-cols-2 overflow-hidden rounded-lg border lg:auto-cols-fr lg:grid-flow-col">
        {figures.map((figure) => (
          <li
            className="max-lg:even:border-l max-lg:nth-[n+3]:border-t lg:not-first:border-l"
            key={figure.label}
          >
            <a
              className="group flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-site-muted/40"
              href={figure.href}
            >
              <span className="font-medium font-site-heading text-3xl tabular-nums leading-none tracking-tight">
                {figure.value}
              </span>
              <span className="font-site-mono text-[11px] text-site-muted-foreground uppercase tracking-[0.08em] group-hover:text-foreground">
                {figure.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
