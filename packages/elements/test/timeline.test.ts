import { describe, expect, test } from "bun:test";
import { createChangeEventDetails, createSource } from "@audio-ui/core";
import "../src/timeline/index.ts";
import type {
  TimelineClipElement,
  TimelineElement,
  TimelineRulerElement,
  TimelineTrackElement,
} from "../src/timeline/index.ts";
import { key, mockRect, pointer } from "./helpers.ts";

/** A 100-unit timeline whose ruler and lane are 200px wide at the origin: 2px per unit when fitted. */
function renderTimeline(attributes = "", lane = "") {
  document.body.innerHTML = `
    <audio-ui-timeline duration="100" ${attributes}>
      <audio-ui-timeline-ruler aria-label="Position">
        <audio-ui-timeline-mark value="25">2</audio-ui-timeline-mark>
      </audio-ui-timeline-ruler>
      <audio-ui-timeline-lane>
        <audio-ui-timeline-playhead></audio-ui-timeline-playhead>
        ${lane}
      </audio-ui-timeline-lane>
    </audio-ui-timeline>`;
  const root = document.querySelector("audio-ui-timeline") as TimelineElement;
  const ruler = root.querySelector(
    "audio-ui-timeline-ruler"
  ) as TimelineRulerElement;
  const laneElement = root.querySelector(
    "audio-ui-timeline-lane"
  ) as HTMLElement;
  mockRect(ruler, { bottom: 20, height: 20, right: 200, width: 200 });
  mockRect(laneElement, {
    bottom: 60,
    height: 40,
    right: 200,
    top: 20,
    width: 200,
  });
  const changes: [number, string][] = [];
  const commits: [number, string][] = [];
  root.addEventListener("input", (event) =>
    changes.push([event.detail.value, event.detail.reason])
  );
  root.addEventListener("change", (event) =>
    commits.push([event.detail.value, event.detail.reason])
  );
  return {
    changes,
    commits,
    lane: laneElement,
    playhead: root.querySelector("audio-ui-timeline-playhead") as HTMLElement,
    root,
    ruler,
  };
}

const offsetOf = (element: HTMLElement) =>
  element.style.getPropertyValue("--timeline-offset");

describe("the timeline's position", () => {
  test("the ruler holds a named native range input; a press jumps and a drag scrubs", () => {
    const { changes, commits, playhead, ruler } = renderTimeline();
    const { input } = ruler;
    expect(input.getAttribute("aria-label")).toBe("Position");
    expect(ruler.hasAttribute("aria-label")).toBe(false);
    pointer(ruler, "pointerdown", { clientX: 50, pointerId: 1 });
    expect(changes.at(-1)).toEqual([25, "press"]);
    pointer(ruler, "pointermove", { clientX: 100, pointerId: 1 });
    expect(changes.at(-1)).toEqual([50, "drag"]);
    pointer(ruler, "pointerup", { clientX: 100, pointerId: 1 });
    expect(commits.at(-1)).toEqual([50, "drag"]);
    expect(offsetOf(playhead)).toBe("50");
    expect(input.value).toBe("50");
    expect(input.getAttribute("aria-valuetext")).toBe("50");
  });

  test("the keys move it, on the grid step, and a position set from outside follows", () => {
    const { commits, root, ruler } = renderTimeline(
      'position="10" snap-step="4"'
    );
    key(ruler.input, "ArrowRight");
    expect(commits.at(-1)).toEqual([14, "keyboard"]);
    key(ruler.input, "PageUp");
    expect(root.position).toBe(54);
  });

  test("preventDefault() refuses a move; disabled, nothing moves", () => {
    const { changes, root, ruler } = renderTimeline();
    root.addEventListener("input", (event) => event.preventDefault());
    pointer(ruler, "pointerdown", { clientX: 50, pointerId: 1 });
    expect(root.position).toBe(0);
    root.setAttribute("disabled", "");
    const before = changes.length;
    key(ruler.input, "End");
    expect(changes).toHaveLength(before);
    expect(ruler.input.disabled).toBe(true);
    expect(ruler.hasAttribute("data-disabled")).toBe(true);
  });

  test("the playhead follows a live source", () => {
    const { playhead, root } = renderTimeline();
    const source = createSource(12);
    root.source = source;
    expect(offsetOf(playhead)).toBe("12");
    source.set(70);
    expect(offsetOf(playhead)).toBe("70");
    expect(playhead.getAttribute("aria-hidden")).toBe("true");
  });

  test("a seekable lane moves the position from a press on its bare area", () => {
    const { changes, lane, playhead } = renderTimeline();
    pointer(lane, "pointerdown", { clientX: 60, pointerId: 1 });
    expect(changes).toHaveLength(0);
    lane.setAttribute("seekable", "");
    pointer(lane, "pointerdown", { clientX: 60, pointerId: 2 });
    expect(changes.at(-1)).toEqual([30, "press"]);
    pointer(lane, "pointerup", { clientX: 60, pointerId: 2 });
    // A press on a part placed in the lane goes to that part.
    pointer(playhead, "pointerdown", { clientX: 80, pointerId: 3 });
    expect(changes).toHaveLength(1);
  });

  test("a selectable ruler selects a stretch with Shift instead of scrubbing", () => {
    const { ruler } = renderTimeline('snap-step="5"');
    const selected: number[][] = [];
    ruler.addEventListener("selectioncommit", (event) =>
      selected.push((event as CustomEvent).detail.value)
    );
    ruler.setAttribute("selectable", "");
    pointer(ruler, "pointerdown", {
      clientX: 40,
      pointerId: 1,
      shiftKey: true,
    });
    pointer(ruler, "pointermove", {
      clientX: 120,
      pointerId: 1,
      shiftKey: true,
    });
    pointer(ruler, "pointerup", { clientX: 120, pointerId: 1 });
    expect(selected.at(-1)).toEqual([20, 60]);
  });
});

describe("the timeline's zoom", () => {
  test("fitted, a lane spreads the timeline over its width; zoomed, a unit is so many px", () => {
    const { lane, root } = renderTimeline();
    expect(lane.style.getPropertyValue("--timeline-unit")).toBe(
      "calc(100% / 100)"
    );
    expect(root.hasAttribute("data-fitted")).toBe(true);
    root.setAttribute("zoom", "4");
    expect(lane.style.getPropertyValue("--timeline-unit")).toBe("4px");
    expect(lane.style.minWidth).toBe("400px");
    expect(root.hasAttribute("data-fitted")).toBe(false);
  });

  test("a zoom fires zoomchange, which preventDefault() refuses", () => {
    const { root } = renderTimeline('zoom="4" max-zoom="10"');
    const zooms: number[] = [];
    root.addEventListener("zoomchange", (event) =>
      zooms.push(event.detail.value)
    );
    const details = () =>
      createChangeEventDetails("keyboard", new KeyboardEvent("keydown"));
    root.zoomTo(20, details());
    expect(zooms).toEqual([10]);
    expect(root.zoom).toBe(10);
    root.addEventListener("zoomchange", (event) => event.preventDefault());
    root.zoomTo(2, details());
    expect(root.zoom).toBe(10);
  });
});

describe("the timeline's marks", () => {
  test("a mark is placed at its value", () => {
    const { root } = renderTimeline();
    const mark = root.querySelector("audio-ui-timeline-mark") as HTMLElement;
    expect(offsetOf(mark)).toBe("25");
    expect(mark.textContent).toBe("2");
  });

  test("a movable mark moves along its lane, past a few px of slop, without seeking", () => {
    const { changes, root } = renderTimeline('snap-step="5"');
    const mark = root.querySelector("audio-ui-timeline-mark") as HTMLElement;
    const moves: number[] = [];
    mark.addEventListener("markinput", (event) =>
      moves.push((event as CustomEvent).detail.value)
    );
    pointer(mark, "pointerdown", { clientX: 50, pointerId: 1 });
    pointer(mark, "pointermove", { clientX: 51, pointerId: 1 });
    pointer(mark, "pointerup", { clientX: 51, pointerId: 1 });
    expect(moves).toHaveLength(0);
    // A still mark lets the press through to the ruler, which seeks.
    expect(changes).toHaveLength(1);
    mark.setAttribute("movable", "");
    pointer(mark, "pointerdown", { clientX: 50, pointerId: 2 });
    pointer(mark, "pointermove", { clientX: 70, pointerId: 2 });
    pointer(mark, "pointerup", { clientX: 70, pointerId: 2 });
    expect(moves.at(-1)).toBe(35);
    expect(offsetOf(mark)).toBe("35");
    expect(changes).toHaveLength(1);
  });
});

describe("the timeline's range", () => {
  function renderRange(attributes = 'value="20 40"') {
    const view = renderTimeline(
      "",
      `<audio-ui-timeline-range aria-label="Loop" ${attributes}>
        <audio-ui-timeline-range-handle aria-label="Loop start" edge="start"></audio-ui-timeline-range-handle>
        <audio-ui-timeline-range-handle aria-label="Loop end" edge="end"></audio-ui-timeline-range-handle>
      </audio-ui-timeline-range>`
    );
    const range = view.root.querySelector(
      "audio-ui-timeline-range"
    ) as HTMLElement;
    const moves: [number[], string, string][] = [];
    range.addEventListener("rangeinput", (event) => {
      const { detail } = event as CustomEvent;
      moves.push([detail.value, detail.edge, detail.reason]);
    });
    const [start, end] = range.querySelectorAll<HTMLElement>(
      "audio-ui-timeline-range-handle"
    );
    return {
      ...view,
      end: end as HTMLElement,
      moves,
      range,
      start: start as HTMLElement,
    };
  }

  test("spans its value; dragging its body moves it without seeking", () => {
    const { changes, moves, range } = renderRange();
    expect(offsetOf(range)).toBe("20");
    expect(range.style.getPropertyValue("--timeline-length")).toBe("20");
    pointer(range, "pointerdown", { clientX: 60, pointerId: 1 });
    pointer(range, "pointermove", { clientX: 80, pointerId: 1 });
    pointer(range, "pointerup", { clientX: 80, pointerId: 1 });
    expect(moves.at(-1)).toEqual([[30, 50], "both", "drag"]);
    expect(offsetOf(range)).toBe("30");
    expect(changes).toHaveLength(0);
  });

  test("its handles hold named inputs bounded by the other edge, and resize it", () => {
    const { end, moves, range } = renderRange();
    const input = end.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Loop end");
    expect(end.getAttribute("data-edge")).toBe("end");
    key(input, "ArrowRight");
    expect(moves.at(-1)).toEqual([[20, 41], "end", "keyboard"]);
    pointer(end, "pointerdown", { clientX: 82, pointerId: 1 });
    pointer(end, "pointermove", { clientX: 102, pointerId: 1 });
    expect(moves.at(-1)?.[0]).toEqual([20, 51]);
    expect(
      range.querySelector(":scope > input")?.getAttribute("aria-valuetext")
    ).toBe("20 to 51");
  });

  test("drawable, a drag across the empty lane draws a new range", () => {
    const { lane, moves } = renderRange('value="20 40" drawable');
    pointer(lane, "pointerdown", { clientX: 120, pointerId: 1 });
    pointer(lane, "pointermove", { clientX: 160, pointerId: 1 });
    pointer(lane, "pointerup", { clientX: 160, pointerId: 1 });
    expect(moves.at(-1)?.[2]).toBe("draw");
    expect(moves.at(-1)?.[0]).toEqual([60, 80]);
  });
});

describe("the timeline's tracks", () => {
  test("a track holds a height a resize handle changes, and gives it up on a double click", () => {
    document.body.innerHTML = `
      <audio-ui-timeline duration="10">
        <audio-ui-timeline-track height="64" selected>
          <audio-ui-timeline-track-header>Drums</audio-ui-timeline-track-header>
          <audio-ui-timeline-lane></audio-ui-timeline-lane>
          <audio-ui-timeline-track-resize-handle aria-label="Height"></audio-ui-timeline-track-resize-handle>
        </audio-ui-timeline-track>
      </audio-ui-timeline>`;
    const track = document.querySelector(
      "audio-ui-timeline-track"
    ) as TimelineTrackElement;
    const header = track.querySelector(
      "audio-ui-timeline-track-header"
    ) as HTMLElement;
    const handle = track.querySelector(
      "audio-ui-timeline-track-resize-handle"
    ) as HTMLElement;
    const input = handle.querySelector("input") as HTMLInputElement;
    const heights: (number | undefined)[] = [];
    track.addEventListener("heightchange", (event) =>
      heights.push((event as CustomEvent).detail.value)
    );
    expect(track.style.height).toBe("64px");
    expect(header.hasAttribute("data-selected")).toBe(true);
    expect(input.getAttribute("aria-label")).toBe("Height");
    expect(input.getAttribute("aria-orientation")).toBe("vertical");
    key(input, "ArrowDown");
    expect(heights.at(-1)).toBe(72);
    expect(track.style.height).toBe("72px");
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(heights.at(-1)).toBeUndefined();
    expect(track.style.height).toBe("");
  });
});

describe("the timeline's clips", () => {
  /** A clip from 20 to 60, its source entered at 10 and 60 long, on a 200px lane: 2px per unit. */
  function renderClip(attributes = "", root = "") {
    const view = renderTimeline(
      root,
      `<audio-ui-timeline-clip aria-label="Take" start="20" length="40" offset="10" source-length="60" ${attributes}>
        <audio-ui-timeline-clip-header>Take</audio-ui-timeline-clip-header>
        <audio-ui-timeline-clip-fade edge="in"></audio-ui-timeline-clip-fade>
        <audio-ui-timeline-clip-handle aria-label="Trim start" edge="start"></audio-ui-timeline-clip-handle>
        <audio-ui-timeline-clip-handle aria-label="Trim end" edge="end"></audio-ui-timeline-clip-handle>
        <audio-ui-timeline-clip-fade-handle aria-label="Fade in" edge="in"></audio-ui-timeline-clip-fade-handle>
      </audio-ui-timeline-clip>`
    );
    const clip = view.root.querySelector(
      "audio-ui-timeline-clip"
    ) as TimelineClipElement;
    const part = (selector: string) =>
      clip.querySelector(`audio-ui-timeline-clip-${selector}`) as HTMLElement;
    const moves: [Record<string, number>, string, string][] = [];
    const commits: string[] = [];
    clip.addEventListener("clipinput", (event) => {
      const { detail } = event as CustomEvent;
      moves.push([detail.value, detail.target, detail.reason]);
    });
    clip.addEventListener("clipchange", (event) =>
      commits.push((event as CustomEvent).detail.target)
    );
    return {
      ...view,
      clip,
      clipCommits: commits,
      moves,
      part,
      place: () => [
        offsetOf(clip),
        clip.style.getPropertyValue("--timeline-length"),
        clip.style.getPropertyValue("--clip-offset"),
      ],
    };
  }

  test("sits from its start, as long as it lasts, and says where in the source it begins", () => {
    const { clip, place } = renderClip();
    expect(place()).toEqual(["20", "40", "10"]);
    const input = clip.querySelector(":scope > input") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Take");
    expect(input.getAttribute("aria-valuetext")).toBe("20 to 60");
  });

  test("gives what is placed inside it a unit of its own: a share of the clip when fitted, px when zoomed", () => {
    const { clip, root } = renderClip();
    expect(clip.style.getPropertyValue("--clip-unit")).toBe("calc(100% / 40)");
    root.setAttribute("zoom", "4");
    expect(clip.style.getPropertyValue("--clip-unit")).toBe("4px");
  });

  test("dragging its header moves it, on the grid unless Cmd/Ctrl is held, and commits", () => {
    const { clipCommits, clip, moves, part, place } = renderClip(
      "",
      'snap-step="8"'
    );
    pointer(part("header"), "pointerdown", { clientX: 80, pointerId: 1 });
    expect(clip.hasAttribute("data-dragging")).toBe(true);
    pointer(part("header"), "pointermove", { clientX: 91, pointerId: 1 });
    pointer(part("header"), "pointerup", { clientX: 91, pointerId: 1 });
    expect(moves.at(-1)?.[1]).toBe("move");
    expect(place()[0]).toBe("24");
    expect(clipCommits.at(-1)).toBe("move");
    pointer(part("header"), "pointerdown", { clientX: 80, pointerId: 2 });
    pointer(part("header"), "pointermove", {
      clientX: 91,
      metaKey: true,
      pointerId: 2,
    });
    expect(place()[0]).toBe("29.5");
  });

  test("pressing its body selects it and puts the cursor there, without moving it", () => {
    const { changes, clip, moves, place } = renderClip();
    const selects: boolean[] = [];
    clip.addEventListener("clipselect", (event) =>
      selects.push((event as CustomEvent).detail.selected)
    );
    pointer(clip, "pointerdown", { clientX: 80, pointerId: 1 });
    expect(selects).toEqual([true]);
    expect(clip.hasAttribute("selected")).toBe(true);
    expect(clip.hasAttribute("data-selected")).toBe(true);
    expect(changes.at(-1)).toEqual([40, "press"]);
    pointer(clip, "pointerup", { clientX: 80, pointerId: 1 });
    expect(moves).toHaveLength(0);
    expect(place()[0]).toBe("20");
  });

  test("trimming the start moves where in the source it begins; trimming the end stops where the source runs out", () => {
    const { part, place } = renderClip();
    pointer(part("handle"), "pointerdown", { clientX: 40, pointerId: 1 });
    pointer(part("handle"), "pointermove", { clientX: 60, pointerId: 1 });
    pointer(part("handle"), "pointerup", { clientX: 60, pointerId: 1 });
    expect(place()).toEqual(["30", "30", "20"]);
    const end = part("handle[edge=end]");
    pointer(end, "pointerdown", { clientX: 120, pointerId: 2 });
    pointer(end, "pointermove", { clientX: 200, pointerId: 2 });
    pointer(end, "pointerup", { clientX: 200, pointerId: 2 });
    expect(place()).toEqual(["30", "40", "20"]);
  });

  test("a trim handle's input trims from the keyboard", () => {
    const { moves, part } = renderClip();
    const input = part("handle[edge=end]").querySelector(
      "input"
    ) as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Trim end");
    key(input, "ArrowLeft");
    expect(moves.at(-1)?.[0].length).toBe(39);
    expect(moves.at(-1)?.[1]).toBe("trim-end");
  });

  test("a fade handle sets the fade, which draws and says it is being dragged; Enter steps its shape", () => {
    const { clip, moves, part } = renderClip();
    const fade = part("fade");
    expect(fade.style.display).toBe("none");
    const handle = part("fade-handle");
    pointer(handle, "pointerdown", { clientX: 40, pointerId: 1 });
    expect(clip.getAttribute("data-fading")).toBe("in");
    pointer(handle, "pointermove", { clientX: 60, pointerId: 1 });
    pointer(handle, "pointerup", { clientX: 60, pointerId: 1 });
    expect(moves.at(-1)?.[0].fadeIn).toBe(10);
    expect(clip.style.getPropertyValue("--clip-fade-in")).toBe("10");
    expect(clip.hasAttribute("data-fading")).toBe(false);
    expect(fade.style.display).toBe("");
    expect(fade.querySelector("path")?.getAttribute("d")).toContain("Z");
    key(handle.querySelector("input") as HTMLInputElement, "Enter");
    expect(clip.value?.fadeInShape).toBe("fast");
  });

  test("Delete on the clip asks for its removal; preventDefault() on clipinput refuses a move", () => {
    const { clip, part, place } = renderClip();
    let removals = 0;
    clip.addEventListener("clipremove", () => {
      removals += 1;
    });
    key(clip.querySelector(":scope > input") as HTMLInputElement, "Delete");
    expect(removals).toBe(1);
    clip.addEventListener("clipinput", (event) => event.preventDefault());
    pointer(part("header"), "pointerdown", { clientX: 80, pointerId: 1 });
    pointer(part("header"), "pointermove", { clientX: 100, pointerId: 1 });
    expect(place()[0]).toBe("20");
  });

  test("a clip's attribute changed after a drag keeps the fields the drag moved", () => {
    const { clip, part, place } = renderClip();
    pointer(part("header"), "pointerdown", { clientX: 80, pointerId: 1 });
    pointer(part("header"), "pointermove", { clientX: 100, pointerId: 1 });
    pointer(part("header"), "pointerup", { clientX: 100, pointerId: 1 });
    clip.setAttribute("length", "20");
    expect(place()).toEqual(["30", "20", "10"]);
  });
});
