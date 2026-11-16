import {
  ValueDisplay,
  type ValueKind,
} from "@/registry-audio/bases/base/audio/elements/value-display";

const VALUES: { kind: ValueKind; label: string; value: number }[] = [
  { kind: "bpm", label: "Tempo", value: 128 },
  { kind: "db", label: "Gain", value: -6 },
  { kind: "hz", label: "Cutoff", value: 2400 },
  { kind: "pan", label: "Pan", value: -0.3 },
  { kind: "percent", label: "Mix", value: 0.35 },
  { kind: "semitones", label: "Transpose", value: 7 },
  { kind: "time", label: "Position", value: 62.345 },
];

export default function ValueDisplayDemo() {
  return (
    <dl className="grid w-full max-w-xs grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-1.5">
      {VALUES.map((item) => (
        <div className="contents" key={item.kind}>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">
            {item.label}
          </dt>
          <dd className="text-end">
            <ValueDisplay
              kind={item.kind}
              label={item.label}
              value={item.value}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
