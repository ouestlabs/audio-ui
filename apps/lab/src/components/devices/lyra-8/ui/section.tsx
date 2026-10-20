import type { ReactNode } from "react";

/** A labelled part of the panel, its title over a band of the section's color. */
export function Section({
  children,
  color,
  title,
}: {
  children: ReactNode;
  color: "blue" | "green" | "orange" | "red";
  title: string;
}) {
  return (
    <section className="lyra-section" data-color={color}>
      <h2 className="lyra-legend">{title}</h2>
      {children}
    </section>
  );
}
