import type { ReactNode } from "react";

/** A labelled part of the panel, its title printed over the group. */
export function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rhea-section">
      <h2 className="rhea-legend">{title}</h2>
      {children}
    </section>
  );
}
