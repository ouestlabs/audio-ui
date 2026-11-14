/**
 * What an operation of the clip view's Process menu makes of a clip's source
 * (CLP-028): the stretch of its recording the clip reads, from `sourceFrom`
 * over `sourceLength`, processed into a recording of its own in a worker, so
 * the page goes on, and kept and streamed as a dropped file is, in floats so a
 * gain past full scale stays in it. The recording the clip read is left as it
 * was, for the other clips of it. Its beat is not read again: the clip is
 * already laid out.
 */
import { canStream, streamRecording } from "@/lib/daw/cache";
import type { Dropped } from "@/lib/daw/drop";
import type { ProcessDone, ProcessJob } from "@/lib/daw/process-worker";
import {
  freshRecordingId,
  type Recording,
  recordingOf,
} from "@/lib/daw/recordings";
import { readChannels, transferable } from "@/lib/daw/samples";
import type { SoundOperation } from "@/lib/sound-operations";

/** `job` run in a worker of its own, which ends with it. */
function inWorker(job: ProcessJob): Promise<ProcessDone> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./process-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<ProcessDone>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "the sound could not be processed"));
    };
    worker.postMessage(job, { transfer: transferable(job.channels) });
  });
}

/** The recording an operation makes of a clip's source, under a new id, with the bytes to keep it by. */
export async function processSource(
  recording: Recording,
  clip: { sourceFrom?: number; sourceLength: number },
  operation: SoundOperation,
  taken: ReadonlySet<string>
): Promise<[string, Dropped]> {
  const { sampleRate } = recording.source;
  const from = Math.round((clip.sourceFrom ?? 0) * sampleRate);
  const { bytes, channels, measured } = await inWorker({
    channels: await readChannels(
      recording.source,
      from,
      from + Math.round(clip.sourceLength * sampleRate)
    ),
    operation,
    sampleRate,
  });
  const id = freshRecordingId(taken);
  const made = recordingOf(channels, sampleRate, recording.name, measured);
  return [
    id,
    {
      bytes,
      recording: canStream() ? await streamRecording(id, made) : made,
    },
  ];
}
