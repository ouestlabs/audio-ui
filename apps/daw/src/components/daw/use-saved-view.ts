import type { NoteLevel } from "@audio-ui/core/piano-roll";
import type { GridDivision, MetronomeRhythm } from "@audio-ui/core/time";
import { type RefObject, useCallback, useEffect, useState } from "react";

import { rackDevices } from "@/lib/arrangement";
import { type ArrangementDoc, allTracks } from "@/lib/arrangement-state";
import type { ExportSettings } from "@/lib/audio-export";

/**
 * How the workstation is laid out, kept in this browser beside the project
 * (PRJ-001): what is folded, open and picked, the heights, the zoom and the
 * scroll. It is no part of the document: nothing here is a step of undo, or
 * goes out with the project.
 *
 * It goes in local storage, written at once, so a reload right after a fold
 * finds it, where the project's own save waits half a second.
 */
const KEY = "audio-ui-daw:view";

/** What is kept per device, by its id. */
interface SavedEntries {
  deviceFolded: boolean;
  drumNote: number;
  rackChain: string;
  rackMacros: boolean;
  rackZones: boolean;
}

export interface SavedView {
  clipFolded: string[];
  computerKeys: boolean;
  countIn: number;
  cursor: number;
  exportSettings: ExportSettings;
  grid: {
    density: number;
    division: GridDivision;
    snap: boolean;
    triplet: boolean;
  };
  libraryOpen: boolean;
  libraryShelf: number;
  metronome: boolean;
  midiView: {
    drawing: boolean;
    folded: boolean;
    level: NoteLevel;
    steps?: boolean;
  };
  overdub: boolean;
  panelFolded: boolean;
  panelHeights: Record<string, number>;
  panelView: "clip" | "devices" | "mixer";
  punch: boolean;
  quantize: number;
  rhythm: MetronomeRhythm;
  scroll: { left: number; top: number };
  selectedClips: string[];
  selectedTrack: string | null;
  trackFolded: Record<string, boolean>;
  trackHeights: Record<string, number>;
  zoom: number;
}

type Stored = Partial<SavedView> & {
  [Entry in keyof SavedEntries]?: Record<string, SavedEntries[Entry]>;
};

let view: Stored | null = null;

/** What is kept, read once: a browser that refuses storage keeps nothing, and the view opens as new. */
export function readView(): Stored {
  if (!view) {
    try {
      view = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Stored;
    } catch {
      view = {};
    }
  }
  return view;
}

export function saveView(patch: Stored) {
  view = { ...readView(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    // Out of room or refused: the view just won't come back.
  }
}

/** Forgets the view: another project has other tracks and devices. */
export function clearView() {
  view = {};
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Refused: there is nothing kept to forget.
  }
}

/**
 * `useState` for a part of the view: it starts from what was kept, and keeps
 * every change. `accept` turns down what was kept, for a value that may no
 * longer hold, such as a track since removed.
 */
export function useSavedState<Key extends keyof SavedView>(
  key: Key,
  fallback: SavedView[Key],
  accept?: (value: SavedView[Key]) => boolean
) {
  const [value, setValue] = useState<SavedView[Key]>(() => {
    const kept = readView()[key] as SavedView[Key] | undefined;
    return kept !== undefined && (accept?.(kept) ?? true) ? kept : fallback;
  });
  useEffect(() => saveView({ [key]: value }), [key, value]);
  return [value, setValue] as const;
}

/** `useState` for what is kept per device, by its id; at its `fallback`, it takes no room. */
export function useSavedEntry<Entry extends keyof SavedEntries>(
  entry: Entry,
  id: string,
  fallback: SavedEntries[Entry]
) {
  const [value, setValue] = useState<SavedEntries[Entry]>(
    () =>
      ((readView()[entry] as Record<string, SavedEntries[Entry]> | undefined)?.[
        id
      ] ?? fallback) as SavedEntries[Entry]
  );
  const set = useCallback(
    (next: SavedEntries[Entry]) => {
      setValue(next);
      const { [id]: _left, ...others } = (readView()[entry] ?? {}) as Record<
        string,
        SavedEntries[Entry]
      >;
      saveView({
        [entry]: next === fallback ? others : { ...others, [id]: next },
      });
    },
    [entry, fallback, id]
  );
  return [value, set] as const;
}

/** How long a scroll has to settle before it is kept, in ms. */
const SCROLL_SETTLES = 200;

/** Puts a scrolling element back where it was, once it has drawn at its zoom, and keeps where it goes. */
export function useSavedScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const { scroll } = readView();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The zoom is measured in the frame after the first: only then is the element as wide as it was.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (scroll) {
          element.scrollLeft = scroll.left;
          element.scrollTop = scroll.top;
        }
      });
    });
    const keep = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          saveView({
            scroll: { left: element.scrollLeft, top: element.scrollTop },
          }),
        SCROLL_SETTLES
      );
    };
    element.addEventListener("scroll", keep, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      element.removeEventListener("scroll", keep);
    };
  }, [ref]);
}

/** What the workstation hands over of the arrangement's own view, to keep. */
interface ArrangedView {
  /** The grid as it is. */
  grid: SavedView["grid"];
  selectedClips: string[];
  trackFolded: Record<string, boolean>;
  trackHeights: Record<string, number>;
  /** The zoom, in px per second; while the view fits, none. */
  zoom: number | undefined;
}

/** Keeps the arrangement's zoom and grid, its folds and heights, and which clips are selected. */
export function useSavedArrangement({
  grid: { density, division, snap, triplet },
  selectedClips,
  trackFolded,
  trackHeights,
  zoom,
}: ArrangedView) {
  useEffect(
    () =>
      saveView({
        grid: { density, division, snap, triplet },
        selectedClips,
        trackFolded,
        trackHeights,
        zoom,
      }),
    [
      density,
      division,
      selectedClips,
      snap,
      trackFolded,
      trackHeights,
      triplet,
      zoom,
    ]
  );
}

/** The clips the clip view showed, those still there: that view comes back with them, and no other brings them back. */
export function clipsToReselect(
  panelView: SavedView["panelView"],
  clips: readonly { id: string }[]
): string[] {
  const kept = new Set(readView().selectedClips);
  return panelView === "clip"
    ? clips.filter((clip) => kept.has(clip.id)).map((clip) => clip.id)
    : [];
}

const ENTRIES = [
  "deviceFolded",
  "drumNote",
  "rackChain",
  "rackMacros",
  "rackZones",
] as const;

/** Forgets what was kept of devices no longer there: a new one can take the id of one removed, and must not open folded. */
export function useForgetRemoved(doc: ArrangementDoc) {
  useEffect(() => {
    const here = new Set(
      allTracks(doc).flatMap((track) =>
        (track.devices ?? []).flatMap((device) => [
          device.id,
          ...(device.rack ? rackDevices(device.rack) : []).map(({ id }) => id),
        ])
      )
    );
    const kept = readView();
    for (const entry of ENTRIES) {
      const ids = Object.keys(kept[entry] ?? {});
      const left = ids.filter((id) => here.has(id));
      if (left.length < ids.length) {
        const values = kept[entry] as Record<string, unknown>;
        saveView({
          [entry]: Object.fromEntries(left.map((id) => [id, values[id]])),
        });
      }
    }
  }, [doc]);
}
