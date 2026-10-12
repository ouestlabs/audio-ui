/** The docs read in a column with room at its sides. */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex-1 px-4 sm:px-8">{children}</div>;
}
