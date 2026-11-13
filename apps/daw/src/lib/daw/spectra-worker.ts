/**
 * Makes a streamed recording's spectra off the page (`makeSpectra`): it reads
 * the recording's cache file a stretch at a time and posts the spectra back.
 */
import { spectrogramSpectra } from "@audio-ui/engine/analysis";
import type { StreamedSource } from "@/lib/clip-player";
import { readMix } from "@/lib/daw/samples";

self.onmessage = async (event: MessageEvent<StreamedSource>) => {
  const source = event.data;
  const spectra = await spectrogramSpectra({
    frames: source.length,
    read: (from, to) => readMix(source, from, to),
  });
  self.postMessage(spectra, { transfer: [spectra.levels.buffer] });
};
