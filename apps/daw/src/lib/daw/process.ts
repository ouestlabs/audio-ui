/**
 * What an operation of the clip view's Process menu or an edit of its sound
 * makes of a clip's source (CLP-028, CLP-029): the stretch of its recording
 * the clip reads, from `sourceFrom` over `sourceLength`, processed into a
 * recording of its own in a worker, so the page goes on, in floats so a gain
 * past full scale stays in it. A streamed recording is read, processed and
 * cached there, and the page streams the result as soon as its cache is
 * written; its file is stored after. The recording the clip read is left as it
 * was, for the other clips of it. Its beat is not read again, the clip being
 * laid out already, nor its chroma, carried over instead.
 */
import { cachedRecording, canStream, streamRecording } from "@/lib/daw/cache";
import type {
  MemoryJob,
  ProcessAnswer,
  ProcessDone,
  ProcessJob,
  ProcessRequest,
} from "@/lib/daw/process-worker";
import {
  freshRecordingId,
  type Recording,
  recordingOf,
} from "@/lib/daw/recordings";
import { readChannels, transferable } from "@/lib/daw/samples";
import type { SoundOperation, SoundRange } from "@/lib/sound-operations";

/** A recording an operation made, under its id, and how the project keeps it: the bytes to store, or the worker storing them. */
export interface Processed {
  id: string;
  kept: ArrayBuffer | Promise<void>;
  recording: Recording;
}

type Reply<Kind extends ProcessDone["kind"]> = Extract<
  ProcessDone,
  { kind: Kind }
>;

/** How long the worker is kept with no job before it is let go of, in ms. */
const IDLE = 30_000;

/** The worker every job runs in, kept between jobs so an edit does not wait for one to start, the answers each job waits for, and the next ticket. */
const processing = {
  answers: new Map<number, (done: ProcessDone) => void>(),
  idle: undefined as ReturnType<typeof setTimeout> | undefined,
  tickets: 0,
  worker: null as Worker | null,
};

/** The worker, started if none runs: called ahead of the first edit too (`warmProcessing`). */
function processWorker(): Worker {
  clearTimeout(processing.idle);
  if (processing.worker) {
    return processing.worker;
  }
  const worker = new Worker(new URL("./process-worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = ({ data }: MessageEvent<ProcessAnswer>) =>
    processing.answers.get(data.ticket)?.(data.done);
  // Lost, every job waiting on it fails, and the next one starts another.
  worker.onerror = (event) => {
    worker.terminate();
    processing.worker = null;
    const message = event.message || "the sound could not be processed";
    for (const answer of [...processing.answers.values()]) {
      answer({ kind: "failed", message });
    }
  };
  processing.worker = worker;
  return worker;
}

/** Lets the worker go once no job has needed it for a while. */
function idleLater() {
  clearTimeout(processing.idle);
  processing.idle = setTimeout(() => {
    if (processing.answers.size === 0) {
      processing.worker?.terminate();
      processing.worker = null;
    }
  }, IDLE);
}

/** Starts the worker ahead of an edit, as the editor of a clip opens, so the first one does not wait for it either. */
export function warmProcessing() {
  processWorker();
  idleLater();
}

/**
 * `job` run in the worker: `first`, its first answer (from memory, all of it;
 * streamed, the cache made), and `last`, once a streamed recording's file is
 * stored too.
 */
function inWorker(job: ProcessJob) {
  processing.tickets += 1;
  const ticket = processing.tickets;
  let answer: (done: ProcessDone) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const first = new Promise<Reply<"made" | "memory">>((resolve, reject) => {
    answer = (done) => {
      if (done.kind === "made" || done.kind === "memory") {
        resolve(done);
      }
    };
    fail = reject;
  });
  const last = new Promise<void>((resolve, reject) => {
    processing.answers.set(ticket, (done) => {
      answer(done);
      if (done.kind === "failed") {
        const error = new Error(done.message);
        fail(error);
        reject(error);
      }
      if (done.kind !== "made") {
        processing.answers.delete(ticket);
        idleLater();
        resolve();
      }
    });
  });
  // A failure before the cache is made is the first answer's: the last one is let go of.
  last.catch(() => undefined);
  processWorker().postMessage(
    { job, ticket } satisfies ProcessRequest,
    job.kind === "memory" ? { transfer: transferable(job.channels) } : {}
  );
  return { first, last };
}

/** Frames `range` of a clip's source, every channel: what Copy keeps to paste. */
export function readSource(
  recording: Recording,
  clip: { sourceFrom?: number },
  [from, to]: SoundRange
): Promise<Float32Array[]> {
  const { sampleRate } = recording.source;
  const start = (clip.sourceFrom ?? 0) * sampleRate;
  return readChannels(
    recording.source,
    Math.round(start + from * sampleRate),
    Math.round(start + to * sampleRate)
  );
}

/** How many semitones an operation on all of a sound moves its pitch. */
function pitchMove(operation: SoundOperation): number {
  switch (operation.type) {
    case "shift":
      return operation.semitones;
    case "speed":
      return 12 * Math.log2(operation.speed);
    default:
      return 0;
  }
}

/** A sound's chroma once an operation on all of it moved its pitch: turned by as many semitones, and as it was otherwise. */
function carriedChroma(
  chroma: readonly number[] | undefined,
  operation: SoundOperation,
  range: SoundRange | null
): readonly number[] | undefined {
  const turn = range || !chroma ? 0 : Math.round(pitchMove(operation));
  return turn === 0
    ? chroma
    : chroma?.map((_, index) => chroma[(((index - turn) % 12) + 12) % 12] ?? 0);
}

/** The recording an operation makes of a clip's source, or of `range` of it, under a new id, and how the project keeps it. */
export async function processSource(
  recording: Recording,
  clip: { sourceFrom?: number; sourceLength: number },
  operation: SoundOperation,
  range: SoundRange | null,
  taken: ReadonlySet<string>
): Promise<Processed> {
  const { source } = recording;
  const from = Math.round((clip.sourceFrom ?? 0) * source.sampleRate);
  const to = from + Math.round(clip.sourceLength * source.sampleRate);
  const id = freshRecordingId(taken);
  const chroma = carriedChroma(recording.chroma, operation, range);
  if ("path" in source) {
    const { first, last } = inWorker({
      id,
      kind: "streamed",
      operation,
      range,
      source,
      window: [from, to],
    });
    await first;
    const made = await cachedRecording(id, recording.name, source.sampleRate);
    if (!made) {
      throw new Error("the processed sound could not be read back");
    }
    return { id, kept: last, recording: { ...made, chroma } };
  }
  const job: MemoryJob = {
    channels: await readChannels(source, from, to),
    kind: "memory",
    operation,
    range,
    sampleRate: source.sampleRate,
  };
  const done = (await inWorker(job).first) as Reply<"memory">;
  const made = recordingOf(
    done.channels,
    source.sampleRate,
    recording.name,
    done.measured
  );
  return {
    id,
    kept: done.bytes,
    recording: canStream() ? await streamRecording(id, made) : made,
  };
}
