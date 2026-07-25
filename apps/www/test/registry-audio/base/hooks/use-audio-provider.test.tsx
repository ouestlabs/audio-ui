import { beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAudioProvider } from "@/registry-audio/bases/base/hooks/use-audio-provider";
import {
  type AudioStoreApi,
  createAudioStore,
} from "@/registry-audio/bases/base/lib/audio-store";
import { FakeEngine } from "@/registry-audio/bases/base/lib/fake-engine";

const track1 = { id: "1", url: "https://example.test/one.mp3" };
const track2 = { id: "2", url: "https://example.test/two.mp3" };

/** Each test drives its own session, so no global state leaks between runs. */
let api: AudioStoreApi;

beforeEach(() => {
  api = createAudioStore();
});

describe("useAudioProvider — mount wiring", () => {
  test("seeds the store queue from the tracks prop", () => {
    const engine = new FakeEngine();
    renderHook(() =>
      useAudioProvider({ api, engine, tracks: [track1, track2] })
    );

    const state = api.getState();
    expect(state.queue).toEqual([track1, track2]);
    expect(state.currentTrack).toEqual(track1);
  });

  test("initializes the injected engine", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));
    expect(engine.calls.some((c) => c.method === "init")).toBe(true);
  });

  test("loads the first track on a fresh session (currentTime is 0, nothing persisted)", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

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
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      api.getState().play();
      await Promise.resolve();
    });

    expect(engine.paused).toBe(false);
    expect(engine.calls.some((c) => c.method === "play")).toBe(true);
  });

  test("store.pause() calls engine.pause()", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      api.getState().play();
      await Promise.resolve();
    });
    await act(async () => {
      api.getState().pause();
      await Promise.resolve();
    });

    expect(engine.calls.some((c) => c.method === "pause")).toBe(true);
  });

  test("store.setPlaybackRate() forwards the already-clamped rate to the engine", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

    act(() => {
      api.getState().setPlaybackRate(10);
    });

    expect(api.getState().playbackRate).toBe(2);
    expect(engine.playbackRate).toBe(2);
  });

  test("store.setVolume() calls engine.setVolume()", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

    act(() => {
      api.getState().setVolume({ volume: 0.4 });
    });

    expect(engine.volume).toBe(0.4);
  });

  test("store.seek() calls engine.setCurrentTime() past the dedup threshold", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));
    api.setState({ duration: 100 });

    act(() => {
      api.getState().seek(42);
    });

    expect(engine.currentTime).toBe(42);
  });

  test("switching currentTrack loads the new track on the engine", async () => {
    const engine = new FakeEngine();
    renderHook(() =>
      useAudioProvider({ api, engine, tracks: [track1, track2] })
    );

    await act(async () => {
      api.getState().setCurrentTrack(track2);
      await Promise.resolve();
    });

    expect(engine.src).toBe(track2.url);
  });
});

describe("useAudioProvider — engine → store", () => {
  test("engine 'play' event marks the store as playing", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

    act(() => {
      engine.emit("play");
    });

    const state = api.getState();
    expect(state.isPlaying).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  test("engine 'pause' event marks the store as not playing", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

    act(() => {
      engine.emit("play");
    });
    act(() => {
      engine.emit("pause");
    });

    expect(api.getState().isPlaying).toBe(false);
  });

  test("engine 'waiting' event marks the store as buffering", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

    act(() => {
      engine.emit("waiting");
    });

    expect(api.getState().isBuffering).toBe(true);
  });

  test("engine 'durationchange' event syncs the store's duration", () => {
    const engine = new FakeEngine();
    engine.duration = 123;
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

    act(() => {
      engine.emit("durationchange");
    });

    expect(api.getState().duration).toBe(123);
  });

  test("engine 'volumechange' event syncs the store's isMuted", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

    engine.muted = true;
    act(() => {
      engine.emit("volumechange");
    });

    expect(api.getState().isMuted).toBe(true);
  });

  test("engine 'bufferupdate' event syncs the store's bufferedTime", () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

    act(() => {
      engine.emit("bufferupdate", { bufferedTime: 12.5 });
    });

    expect(api.getState().bufferedTime).toBe(12.5);
  });

  test("engine 'error' event carries a diagnosed, non-recoverable error straight to the store", async () => {
    const engine = new FakeEngine();
    renderHook(() => useAudioProvider({ api, engine, tracks: [track1] }));

    await act(async () => {
      engine.emit("error", {
        errorCode: 3,
        message: "Audio file decoding error",
        recoverable: false,
      });
      await Promise.resolve();
    });

    const state = api.getState();
    expect(state.isError).toBe(true);
    expect(state.errorMessage).toBe("Audio file decoding error");
  });

  test("engine 'ended' event with repeatMode 'one' reloads the same track instead of advancing", async () => {
    const engine = new FakeEngine();
    renderHook(() =>
      useAudioProvider({ api, engine, tracks: [track1, track2] })
    );
    api.setState({ repeatMode: "one" });

    await act(async () => {
      engine.emit("ended");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.getState().currentTrack).toEqual(track1);
    expect(
      engine.calls.filter((c) => c.method === "load").length
    ).toBeGreaterThan(0);
  });

  test("engine 'ended' event without repeat advances to the next track", async () => {
    const engine = new FakeEngine();
    renderHook(() =>
      useAudioProvider({ api, engine, tracks: [track1, track2] })
    );

    await act(async () => {
      engine.emit("ended");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.getState().currentTrack).toEqual(track2);
  });
});
