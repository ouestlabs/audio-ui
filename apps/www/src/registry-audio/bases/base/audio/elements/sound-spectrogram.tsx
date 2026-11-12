import type { Spectrogram } from "@audio-ui/engine/analysis";
import { formatFrequency, formatTime } from "@audio-ui/engine/format";
import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/registry/bases/base/ui/dialog";

const WIDTH = 960;
const HEIGHT = 320;
const FREQUENCY_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;
const TIME_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

/**
 * A sound's frequencies over time, drawn in the text colour: time runs left
 * to right and frequency from the bottom, 0 Hz, to the top, the Nyquist
 * limit; the louder a bin, the more opaque. Its size follows its box.
 */
export function SoundSpectrogram({ grid }: { grid: Spectrogram }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current;
    const context = target?.getContext("2d");
    if (!(target && context)) {
      return;
    }
    const source = document.createElement("canvas");
    source.width = grid.frames;
    source.height = grid.bins;
    const image = new ImageData(grid.frames, grid.bins);
    const [red = 0, green = 0, blue = 0] = (
      getComputedStyle(target).color.match(/[\d.]+/g) ?? []
    ).map(Number);
    for (let frame = 0; frame < grid.frames; frame += 1) {
      for (let bin = 0; bin < grid.bins; bin += 1) {
        // Bin 0 is the bottom row of the picture.
        const at = ((grid.bins - 1 - bin) * grid.frames + frame) * 4;
        image.data[at] = red;
        image.data[at + 1] = green;
        image.data[at + 2] = blue;
        image.data[at + 3] = grid.levels[frame * grid.bins + bin] as number;
      }
    }
    source.getContext("2d")?.putImageData(image, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.imageSmoothingEnabled = true;
    context.drawImage(source, 0, 0, WIDTH, HEIGHT);
  }, [grid]);
  const nyquist = (grid.bins - 1) * grid.hertzPerBin;
  const duration = grid.frames * grid.hop;
  return (
    <div className="flex flex-col gap-1 text-foreground">
      <div className="flex gap-2">
        <div className="relative w-12 shrink-0 text-muted-foreground text-xs tabular-nums">
          {FREQUENCY_TICKS.map((tick) => (
            <span
              className="absolute end-0 -translate-y-1/2"
              key={tick}
              style={{ top: `${(1 - tick) * 100}%` }}
            >
              {formatFrequency(tick * nyquist)}
            </span>
          ))}
        </div>
        <canvas
          aria-label="Spectrogram: frequencies over time"
          className="aspect-[3/1] w-full rounded-md border bg-muted/30"
          height={HEIGHT}
          ref={canvas}
          role="img"
          width={WIDTH}
        />
      </div>
      <div className="relative ms-14 h-4 text-muted-foreground text-xs tabular-nums">
        {TIME_TICKS.map((tick) => (
          <span
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            key={tick}
            style={{ left: `${tick * 100}%` }}
          >
            {formatTime(tick * duration, "precise")}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A spectrogram in a dialog. Controlled: it is open while `grid` is set. */
export function SoundSpectrogramDialog({
  grid,
  onOpenChange,
}: {
  grid: Spectrogram | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={grid !== null}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Spectrogram</DialogTitle>
          <DialogDescription>
            The frequencies of the sound as edited over time, louder where it is
            darker.
          </DialogDescription>
        </DialogHeader>
        {grid ? <SoundSpectrogram grid={grid} /> : null}
      </DialogContent>
    </Dialog>
  );
}
