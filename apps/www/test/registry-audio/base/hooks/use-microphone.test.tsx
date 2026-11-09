import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";

// The shared audio context, running, with an analyser and a source that connect to nothing.
const context = {
  createAnalyser: () => ({ fftSize: 0 }),
  createMediaStreamSource: () => ({ connect: () => undefined }),
  state: "running",
};
mock.module("@/registry-audio/bases/base/lib/web-audio", () => ({
  webAudio: { getContext: () => context },
}));

const { useMicrophone } = await import(
  "@/registry-audio/bases/base/hooks/use-microphone"
);

/** A microphone stream whose one track says whether it was stopped. */
function fakeStream() {
  const track = {
    stopped: false,
    stop: () => {
      track.stopped = true;
    },
  };
  return { getTracks: () => [track], track };
}

/** `getUserMedia` answered by hand, as the browser does once its prompt is answered. */
function deferPermission() {
  const grants: ((stream: unknown) => void)[] = [];
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: () =>
        new Promise((resolve) => {
          grants.push(resolve);
        }),
    },
  });
  return grants;
}

afterEach(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
});

describe("useMicrophone", () => {
  test("a stop while the browser asks wins over the answer", async () => {
    const grants = deferPermission();
    const view = renderHook(() => useMicrophone());
    let starting: Promise<void> = Promise.resolve();
    act(() => {
      starting = view.result.current.start();
    });
    act(() => view.result.current.stop());
    const stream = fakeStream();
    await act(async () => {
      grants[0]?.(stream);
      await starting;
    });
    expect(stream.track.stopped).toBe(true);
    expect(view.result.current.isListening).toBe(false);
  });

  test("unmounted while the browser asks, it releases the microphone it gets", async () => {
    const grants = deferPermission();
    const view = renderHook(() => useMicrophone());
    let starting: Promise<void> = Promise.resolve();
    act(() => {
      starting = view.result.current.start();
    });
    view.unmount();
    const stream = fakeStream();
    grants[0]?.(stream);
    await starting;
    expect(stream.track.stopped).toBe(true);
  });

  test("of two starts at once, it keeps the last stream and releases the other", async () => {
    const grants = deferPermission();
    const view = renderHook(() => useMicrophone());
    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = view.result.current.start();
      second = view.result.current.start();
    });
    const older = fakeStream();
    const newer = fakeStream();
    await act(async () => {
      grants[1]?.(newer);
      grants[0]?.(older);
      await Promise.all([first, second]);
    });
    expect(older.track.stopped).toBe(true);
    expect(newer.track.stopped).toBe(false);
    expect(view.result.current.isListening).toBe(true);
    act(() => view.result.current.stop());
    expect(newer.track.stopped).toBe(true);
  });
});
