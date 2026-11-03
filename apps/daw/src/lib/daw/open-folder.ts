/**
 * A project folder of the disk, opened into the workstation (PRJ-007): its
 * recordings under new ids, each kept in the browser's storage, decoded and
 * cached one after the other as a dropped file is.
 */
import type { ArrangementDoc } from "@/lib/arrangement-state";
import { canStream, streamRecording } from "@/lib/daw/cache";
import { openFolder } from "@/lib/daw/folder";
import { withFreshIds } from "@/lib/daw/project-file";
import {
  decodeRecording,
  freshRecordingId,
  type Recording,
} from "@/lib/daw/recordings";
import { canStore, saveRecording } from "@/lib/daw/storage";

export async function projectFromFolder(
  context: BaseAudioContext,
  folder: FileSystemDirectoryHandle
): Promise<{
  doc: ArrangementDoc;
  missing: string[];
  recordings: Map<string, Recording>;
}> {
  const { bytes, file, missing } = await openFolder(folder);
  const taken = new Set<string>();
  const fresh = withFreshIds(file, () => {
    const id = freshRecordingId(taken);
    taken.add(id);
    return id;
  });
  const recordings = new Map<string, Recording>();
  await fresh.samples.reduce(async (done, sample, index) => {
    await done;
    const read = bytes.get(file.samples[index]?.id ?? "");
    if (!read) {
      return;
    }
    if (canStore()) {
      await saveRecording(sample.id, read);
    }
    const decoded = await decodeRecording(context, read, sample.name);
    if (!decoded) {
      missing.push(sample.name);
      return;
    }
    recordings.set(
      sample.id,
      canStream() ? await streamRecording(sample.id, decoded) : decoded
    );
  }, Promise.resolve());
  return { doc: fresh.doc, missing, recordings };
}
