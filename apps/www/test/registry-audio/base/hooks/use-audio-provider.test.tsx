import { beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAudioProvider } from "@/registry-audio/bases/base/hooks/use-audio-provider";
import { useAudioStore } from "@/registry-audio/bases/base/lib/audio-store";
import { FakeEngine } from "@/registry-audio/bases/base/lib/fake-engine";

const track1 = { id: "1", url: "https://example.test/one.mp3" };
const track2 = { id: "2", url: "https://example.test/two.mp3" };

/** zustand's persist middleware writes to localStorage — reset the data
 * fields (not the actions) between tests so runs don't bleed into each other. */
function resetStore() {
  useAudioStore.setState({
    bufferedTime: 0,
    currentQueueIndex: -1,
    currentTime: 0,
    currentTrack: null,
    duration: 0,
    errorMessage: null,
    insertMode: "last",
    isBuffering: false,
    isError: false,
    isLoading: false,
    isMuted: false,
    isPlaying: false,
    playbackRate: 1,
    progress: 0,
    queue: [],
    repeatMode: "none",
    shuffleEnabled: false,
    volume: 1,
  });
}

beforeEach(() => {
  resetStore();
});

describe("useAudioProvider — mount wiring", () => {
  test("seeds the store queue from the tracks prop", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1, track2] }));

    const state = useAudioStore.getState();
    expect(state.queue).toEqual([track1, track2]);
    expect(state.currentTrack).toEqual(track1);
  });

  test("initializes the injected engine", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));
    expect(engine.calls.some((c) => c.method === "init")).toBe(true);
  });

  test("loads the first track on a fresh session (currentTime is 0, nothing persisted)", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(engine.calls.some((c) => c.method === "load")).toBe(true);
    expect(engine.src).toBe(track1.url);
  });
});

describe("useAudioProvider — store → engine", () => {
  test("store.play() calls engine.play()", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      useAudioStore.getState().play();
      await Promise.resolve();
    });

    expect(engine.paused).toBe(false);
    expect(engine.calls.some((c) => c.method === "play")).toBe(true);
  });

  test("store.pause() calls engine.pause()", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      useAudioStore.getState().play();
      await Promise.resolve();
    });
    await act(async () => {
      useAudioStore.getState().pause();
      await Promise.resolve();
    });

    expect(engine.calls.some((c) => c.method === "pause")).toBe(true);
  });

  test("store.setPlaybackRate() forwards the already-clamped rate to the engine", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    act(() => {
      useAudioStore.getState().setPlaybackRate(10);
    });

    expect(useAudioStore.getState().playbackRate).toBe(2);
    expect(engine.playbackRate).toBe(2);
  });

  test("store.setVolume() calls engine.setVolume()", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    act(() => {
      useAudioStore.getState().setVolume({ volume: 0.4 });
    });

    expect(engine.volume).toBe(0.4);
  });

  test("store.seek() calls engine.setCurrentTime() past the dedup threshold", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));
    useAudioStore.setState({ duration: 100 });

    act(() => {
      useAudioStore.getState().seek(42);
    });

    expect(engine.currentTime).toBe(42);
  });

  test("switching currentTrack loads the new track on the engine", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1, track2] }));

    await act(async () => {
      useAudioStore.getState().setCurrentTrack(track2);
      await Promise.resolve();
    });

    expect(engine.src).toBe(track2.url);
  });
});

describe("useAudioProvider — engine → store", () => {
  test("engine 'play' event marks the store as playing", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    act(() => {
      engine.emit("play");
    });

    const state = useAudioStore.getState();
    expect(state.isPlaying).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  test("engine 'pause' event marks the store as not playing", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    act(() => {
      engine.emit("play");
    });
    act(() => {
      engine.emit("pause");
    });

    expect(useAudioStore.getState().isPlaying).toBe(false);
  });

  test("engine 'waiting' event marks the store as buffering", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    act(() => {
      engine.emit("waiting");
    });

    expect(useAudioStore.getState().isBuffering).toBe(true);
  });

  test("engine 'durationchange' event syncs the store's duration", () => {
    const engine = new FakeEngine();
    engine.duration = 123;
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    act(() => {
      engine.emit("durationchange");
    });

    expect(useAudioStore.getState().duration).toBe(123);
  });

  test("engine 'volumechange' event syncs the store's isMuted", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    engine.muted = true;
    act(() => {
      engine.emit("volumechange");
    });

    expect(useAudioStore.getState().isMuted).toBe(true);
  });

  test("engine 'bufferupdate' event syncs the store's bufferedTime", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    act(() => {
      engine.emit("bufferupdate", { bufferedTime: 12.5 });
    });

    expect(useAudioStore.getState().bufferedTime).toBe(12.5);
  });

  test("engine 'error' event carries a diagnosed, non-recoverable error straight to the store", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1] }));

    await act(async () => {
      engine.emit("error", {
        errorCode: 3,
        message: "Audio file decoding error",
        recoverable: false,
      });
      await Promise.resolve();
    });

    const state = useAudioStore.getState();
    expect(state.isError).toBe(true);
    expect(state.errorMessage).toBe("Audio file decoding error");
  });

  test("engine 'ended' event with repeatMode 'one' reloads the same track instead of advancing", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1, track2] }));
    useAudioStore.setState({ repeatMode: "one" });

    await act(async () => {
      engine.emit("ended");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useAudioStore.getState().currentTrack).toEqual(track1);
    expect(
      engine.calls.filter((c) => c.method === "load").length
    ).toBeGreaterThan(0);
  });

  test("engine 'ended' event without repeat advances to the next track", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ engine, tracks: [track1, track2] }));

    await act(async () => {
      engine.emit("ended");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useAudioStore.getState().currentTrack).toEqual(track2);
  });
});
