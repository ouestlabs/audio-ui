import {
  createWaveformLane,
  type Lane,
  type WaveformClip,
  type WaveformInputs,
  type WaveformLook,
} from "@audio-ui/gl/waveform";
import { type ComponentProps, useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

/**
 * The waveforms of a lane's clips on one canvas and one WebGL context, drawn
 * on the GPU by `gl-waveform` through `@audio-ui/gl/waveform`: every pixel
 * column shows the exact lowest and highest of its samples with the RMS
 * inside, and zoomed in a line through the samples, however long the
 * recording. Put it in the lane's box, `zoom` being the lane's pixels a
 * second. With `look="bands"` each clip is drawn as the three bands of its
 * sound one over the other, the lows warm and the highs cool. A clip is read
 * in stretches (`segments`), as a DAW paints a region; a reversed clip is
 * not drawn here, and `hasWebGL2` of `@audio-ui/gl/lane` says whether to draw
 * this way at all.
 */
function WaveformLane({
  className,
  clips,
  look = "plain",
  zoom,
  ...props
}: Omit<ComponentProps<"canvas">, "ref"> & {
  clips: readonly WaveformClip[];
  look?: WaveformLook;
  /** The lane's pixels a second. */
  zoom: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lane = useRef<Lane<WaveformInputs> | null>(null);
  const inputs = useMemo<WaveformInputs>(
    () => ({ clips, look, zoom }),
    [clips, look, zoom]
  );
  const first = useRef(inputs);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    lane.current = createWaveformLane(canvas, first.current);
    return () => {
      lane.current?.destroy();
      lane.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    lane.current?.update(inputs);
  }, [inputs]);
  return (
    <canvas
      className={cn("pointer-events-none absolute inset-y-0", className)}
      data-slot="timeline-clip-waveform-gl"
      ref={ref}
      {...props}
    />
  );
}

export type { WaveformClip, WaveformLook };
export { WaveformLane };
