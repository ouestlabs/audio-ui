import type { EngineStatus } from "@/hooks/use-arrangement-engine";

const STATES: Record<EngineStatus["state"], string> = {
  closed: "Closed",
  interrupted: "Interrupted",
  running: "Running",
  suspended: "Asleep: press a key or click to wake it",
  unavailable: "No audio in this browser",
};

/** The engine line (ENG-001): its sample rate, how late its sound is, and whether it runs. */
export function EngineLine({
  saved,
  status,
}: {
  /** What the project's storage says: saved, saving, or why it cannot. */
  saved: string;
  status: EngineStatus;
}) {
  const running = status.state === "running";
  return (
    <section
      aria-label="Engine"
      className="flex h-7 shrink-0 items-center gap-4 border-t px-3 text-muted-foreground text-xs tabular-nums"
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={
            running
              ? "size-2 rounded-full bg-success"
              : "size-2 rounded-full bg-muted-foreground/50"
          }
        />
        {STATES[status.state]}
      </span>
      {status.sampleRate > 0 ? (
        <>
          <span>{(status.sampleRate / 1000).toFixed(1)} kHz</span>
          <span>{(status.latency * 1000).toFixed(1)} ms out</span>
        </>
      ) : null}
      <span className="ms-auto">{saved}</span>
    </section>
  );
}
