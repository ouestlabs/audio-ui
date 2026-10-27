import type { ReactNode } from "react";

/** A labelled part of the panel, its title cut into a printed line. */
export function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="maia-section">
      <h2 className="maia-legend">{title}</h2>
      {children}
    </section>
  );
}
