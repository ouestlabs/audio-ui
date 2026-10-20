import type { ReactNode } from "react";

/** A labelled part of the panel. */
export function Section({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="sirius-section">
      <h2 className="sirius-legend">{title}</h2>
      {children}
    </section>
  );
}
