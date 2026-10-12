import { describe, expect, test } from "bun:test";
import { createSource, type WritableSource } from "@audio-ui/core";
import { act, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { bench, SCRIPT_BUDGET_MS, sweep } from "../../../../test/bench.ts";
import { mockRect } from "../../../../test/helpers.ts";
import { Timeline } from "../../../entries/timeline.ts";

const TRACKS = 20;
const LANES = Array.from({ length: TRACKS }, (_, track) => track);

interface Item {
  id: string;
  track: number;
  value: Timeline.Clip.Value;
}

/** `count` clips spread over twenty tracks, each four units long and one apart. */
const makeClips = (count: number): Item[] =>
  Array.from({ length: count }, (_, index) => ({
    id: String(index),
    track: index % TRACKS,
    value: {
      fadeIn: 0,
      fadeOut: 0,
      length: 4,
      offset: 0,
      start: Math.floor(index / TRACKS) * 5,
    },
  }));

/**
 * One clip, memoized: an app that keeps a clip's props stable lets React skip
 * every clip a drag did not touch.
 */
const ClipItem = React.memo(function MemoizedClip({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (id: string, value: Timeline.Clip.Value) => void;
  value: Timeline.Clip.Value;
}) {
  const handleChange = React.useCallback(
    (moved: Timeline.Clip.Value) => onChange(id, moved),
    [id, onChange]
  );
  return (
    <Timeline.Clip
      aria-label={`Clip ${id}`}
      onValueChange={handleChange}
      value={value}
    >
      <Timeline.ClipHeader data-testid={`header-${id}`} />
      <Timeline.ClipHandle aria-label="Start" edge="start" />
      <Timeline.ClipHandle aria-label="End" edge="end" />
      <Timeline.ClipFadeHandle aria-label="Fade in" edge="in" />
      <Timeline.ClipFadeHandle aria-label="Fade out" edge="out" />
    </Timeline.Clip>
  );
});

/** The way an app holds its clips: in state, each one controlled. */
function Arrangement({
  count,
  source,
}: {
  count: number;
  source: WritableSource<number>;
}) {
  const [clips, setClips] = React.useState(() => makeClips(count));
  const duration = (count / TRACKS) * 5 + 10;
  const change = React.useCallback(
    (id: string, value: Timeline.Clip.Value) =>
      setClips((all) =>
        all.map((clip) => (clip.id === id ? { ...clip, value } : clip))
      ),
    []
  );
  return (
    <Timeline.Root duration={duration} snapStep={1} source={source} zoom={10}>
      <Timeline.Viewport>
        {LANES.map((track) => (
          <Timeline.Lane data-testid={`lane-${track}`} key={track}>
            {clips
              .filter((clip) => clip.track === track)
              .map((clip) => (
                <ClipItem
                  id={clip.id}
                  key={clip.id}
                  onChange={change}
                  value={clip.value}
                />
              ))}
          </Timeline.Lane>
        ))}
      </Timeline.Viewport>
    </Timeline.Root>
  );
}

/** Every count is measured on its own: a drag, then the playhead. */
describe.each([200, 1000])("Timeline with %d clips", (count) => {
  test("mounting, dragging a clip, and following the playhead", () => {
    const source = createSource(0);
    const mountStart = performance.now();
    const view = render(<Arrangement count={count} source={source} />);
    const mounted = performance.now() - mountStart;
    expect(view.container.querySelectorAll("[data-timeline-lane]").length).toBe(
      TRACKS
    );

    const header = view.getByTestId("header-0");
    const lane = view.getByTestId("lane-0");
    mockRect(lane, { bottom: 20, height: 20, right: 10_000, width: 10_000 });
    fireEvent.pointerDown(header, { clientX: 5, pointerId: 1 });
    const drag = bench(
      `${count} clips: drag one`,
      (index) => {
        fireEvent.pointerMove(header, {
          clientX: 5 + sweep(index, 400),
          pointerId: 1,
        });
      },
      { budget: SCRIPT_BUDGET_MS }
    );
    fireEvent.pointerUp(header, { pointerId: 1 });

    const follow = bench(
      `${count} clips: playhead`,
      (index) => {
        act(() => source.set(sweep(index, 100, 240)));
      },
      { budget: SCRIPT_BUDGET_MS }
    );
    console.log(
      `${count} clips: mount ${mounted.toFixed(0)} ms, drag p95 ${drag.p95.toFixed(2)} ms, playhead p95 ${follow.p95.toFixed(3)} ms`
    );
  }, 120_000);
});
