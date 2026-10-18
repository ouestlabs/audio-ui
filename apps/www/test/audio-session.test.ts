import { describe, expect, test } from "bun:test";
import {
  createAudioSession,
  silentMicrophone,
  silentPlay,
} from "@/registry-audio/bases/base/hooks/use-audio-session";

describe("createAudioSession", () => {
  test("two sessions never follow each other", () => {
    const a = createAudioSession();
    const b = createAudioSession();
    a.play.setOn(true);
    a.microphone.setOn(true);
    expect(a.play.get().on).toBe(true);
    expect(b.play.get().on).toBe(false);
    expect(b.microphone.get().on).toBe(false);
  });

  test("a switch tells its listeners and toggles", () => {
    const { play } = createAudioSession();
    let heard = 0;
    const stop = play.subscribe(() => {
      heard += 1;
    });
    play.toggle();
    play.toggle();
    stop();
    play.toggle();
    expect(heard).toBe(2);
    expect(play.get().on).toBe(true);
  });

  test("the last control to go turns the switch off", () => {
    const { play } = createAudioSession();
    const detachCard = play.attach();
    const detachDialog = play.attach();
    play.setOn(true);
    detachCard();
    expect(play.get().on).toBe(true);
    detachDialog();
    expect(play.get().on).toBe(false);
  });

  test("the microphone keeps the reason it was refused", () => {
    const { microphone } = createAudioSession();
    microphone.set({ error: "denied", on: false });
    expect(microphone.get()).toEqual({ error: "denied", on: false });
  });
});

describe("outside a session", () => {
  test("the switches stay off and ignore every call", () => {
    silentPlay.setOn(true);
    silentPlay.toggle();
    silentMicrophone.setOn(true);
    expect(silentPlay.get().on).toBe(false);
    expect(silentMicrophone.get()).toEqual({ error: null, on: false });
  });
});

describe("a switch that does not change", () => {
  test("tells nobody", () => {
    const { play } = createAudioSession();
    let heard = 0;
    play.subscribe(() => {
      heard += 1;
    });
    play.setOn(false);
    play.setOn(true);
    play.setOn(true);
    expect(heard).toBe(1);
  });
});
