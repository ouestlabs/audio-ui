import {
  type ComponentProps,
  createContext,
  use,
  useEffect,
  useRef,
} from "react";
import type { MeterProps } from "@/registry/bases/shared/audio-ui/elements/meter";
import { VU_DIAL } from "@/registry/bases/shared/audio-ui/elements/needle-meter";
import { cn } from "@/registry/lib/utils";
import {
  createVuBallistics,
  FLOOR_DB,
} from "@/registry/primitives/meter/ballistics";
import { Meter as MeterPrimitive } from "@/registry/primitives/meter/react";

/** The level, in dB, that reads 0 VU: the alignment common for digital audio. */
const REFERENCE = -18;

const SIZES = { default: "w-44", lg: "w-60", sm: "w-32" };

/** Reads a channel's level now, in dB. */
const Levels = createContext<(channel: number) => number>(() => FLOOR_DB);

const decibels = (formattedValue: string) => `${formattedValue} dB`;

/** The dial of one channel: its needle follows the level with the VU ballistics, turned outside React. */
function Dial({
  channel,
  ...props
}: ComponentProps<"div"> & { channel: number }) {
  const read = use(Levels);
  const needle = useRef<SVGLineElement>(null);

  useEffect(() => {
    const ballistics = createVuBallistics();
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const vu = ballistics.step(
        read(channel) - REFERENCE,
        (now - last) / 1000
      );
      last = now;
      if (needle.current) {
        needle.current.style.transform = `rotate(${VU_DIAL.angleOf(vu)}deg)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [channel, read]);

  return (
    <div {...props}>
      <svg aria-hidden="true" className="block w-full" viewBox="0 0 200 118">
        <path
          className="stroke-[var(--audio-screen-ink,var(--muted-foreground))]"
          d={VU_DIAL.arc}
          fill="none"
        />
        <path
          className="stroke-[var(--audio-clip,var(--destructive))]"
          d={VU_DIAL.zone}
          fill="none"
          strokeWidth={3}
        />
        {VU_DIAL.scale.map(({ hot, inner, label, mark, outer, text }) => (
          <g
            className={
              hot
                ? "text-[color:var(--audio-clip,var(--destructive))]"
                : "text-[color:var(--audio-screen-ink,var(--muted-foreground))]"
            }
            key={mark}
          >
            <line
              stroke="currentColor"
              strokeWidth={1.5}
              x1={inner.x}
              x2={outer.x}
              y1={inner.y}
              y2={outer.y}
            />
            <text
              className="text-[8px] tabular-nums"
              dominantBaseline="central"
              fill="currentColor"
              textAnchor="middle"
              x={text.x}
              y={text.y}
            >
              {label}
            </text>
          </g>
        ))}
        <text
          className="fill-[var(--audio-screen-ink,var(--muted-foreground))] text-[10px] tracking-widest"
          textAnchor="middle"
          x={VU_DIAL.pivot.x}
          y={68}
        >
          VU
        </text>
        <line
          className="stroke-[var(--audio-accent,var(--primary))]"
          ref={needle}
          strokeLinecap="round"
          strokeWidth={2}
          style={{
            transform: `rotate(${VU_DIAL.angleOf(Number.NEGATIVE_INFINITY)}deg)`,
            transformBox: "view-box",
            transformOrigin: `${VU_DIAL.pivot.x}px ${VU_DIAL.pivot.y}px`,
          }}
          x1={VU_DIAL.pivot.x}
          x2={VU_DIAL.tip.x}
          y1={VU_DIAL.pivot.y}
          y2={VU_DIAL.tip.y}
        />
        <circle
          className="fill-[var(--audio-cap,var(--card))]"
          cx={VU_DIAL.pivot.x}
          cy={VU_DIAL.pivot.y}
          r={7}
        />
      </svg>
      <span
        aria-hidden="true"
        className="audio-lamp group-data-clipped/channel:audio-lamp-on group-data-clipping/channel:audio-lamp-on absolute top-2 right-2 size-2"
      />
      {props.children}
    </div>
  );
}

const dial = (props: ComponentProps<"div">, { index }: { index: number }) => (
  <Dial {...props} channel={index} />
);

/**
 * The Hardware face of the meter: a needle VU dial per channel in a dark
 * screen, with a clip lamp. 0 VU is -18 dB. Same props as `Meter`; the dial
 * has the standard VU scale, so `marks`, `peakMarks` and `scale` do not draw.
 */
export function HardwareVuMeter({
  "aria-label": ariaLabel,
  className,
  marks: _marks,
  peakMarks: _peakMarks,
  size,
  source,
  value,
  ...props
}: MeterProps) {
  const held = useRef({ source, value });
  held.current = { source, value };
  const read = useRef((channel: number) => {
    const { source: live, value: given } = held.current;
    const levels = live ? live.getSnapshot().levels : given;
    return levels?.[channel] ?? FLOOR_DB;
  }).current;
  return (
    <Levels value={read}>
      <MeterPrimitive.Root
        aria-label={ariaLabel}
        className={cn("flex w-fit select-none gap-2", className)}
        data-slot="meter"
        source={source}
        value={value}
        {...props}
      >
        {({ channelCount }) =>
          Array.from({ length: channelCount }, (_, index) => index).map(
            (index) => (
              <MeterPrimitive.Channel
                aria-label={
                  ariaLabel && channelCount > 1
                    ? `${ariaLabel} ${index + 1}`
                    : ariaLabel
                }
                className={cn(
                  "group/channel audio-screen relative rounded-[calc(6px*var(--audio-roundness,1))] p-2",
                  SIZES[size ?? "default"]
                )}
                getAriaValueText={decibels}
                index={index}
                key={index}
                render={dial}
              />
            )
          )
        }
      </MeterPrimitive.Root>
    </Levels>
  );
}
