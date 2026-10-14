import { useSeconds } from "../motion.ts";
import { SHOWCASES } from "../showcases/index.ts";

/** Every showcase at its own size: where to check a new one before filming it. */
export function Showcases() {
  const t = useSeconds();
  return (
    <div className="style-vega flex size-full flex-wrap content-start gap-4 bg-background p-4 font-sans text-foreground">
      {Object.entries(SHOWCASES).map(([name, { Demo, height, width }]) => (
        <div
          className="box-border rounded-[14px] border bg-card p-4 shadow-xs"
          key={name}
          style={{ height, width }}
        >
          <Demo t={t} />
        </div>
      ))}
    </div>
  );
}
