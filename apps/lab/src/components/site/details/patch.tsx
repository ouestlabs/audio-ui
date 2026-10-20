/** The patch the device is playing: a line per control. */
export function Patch({ patch }: { patch: Record<string, number | string> }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 font-mono text-xs">
      {Object.entries(patch).map(([name, value]) => (
        <div className="col-span-2 grid grid-cols-subgrid" key={name}>
          <dt className="truncate text-muted-foreground">{name}</dt>
          <dd className="text-right tabular-nums">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
