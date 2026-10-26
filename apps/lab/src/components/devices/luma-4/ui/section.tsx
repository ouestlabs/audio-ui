import type { ReactNode } from "react";

/** A labelled part of the panel, its title on a printed line. */
export function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="luma-section">
      <h2 className="luma-legend">{title}</h2>
      {children}
    </section>
  );
}
