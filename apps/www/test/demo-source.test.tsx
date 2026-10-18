import { describe, expect, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import {
  AudioSessionProvider,
  useAudioSession,
} from "@/registry-audio/bases/base/hooks/use-audio-session";
import { useDemoSource } from "@/registry-audio/bases/base/hooks/use-demo-source";

function Device({ fallback }: { fallback: "groove" | "noise" }) {
  const name = useDemoSource(fallback);
  const source = useAudioSession()?.source;
  return (
    <>
      <output aria-label="playing">{name}</output>
      <output aria-label="offered">
        {source?.get().fallback ?? "nothing"}
      </output>
      <button onClick={() => source?.set({ chosen: "voice" })} type="button">
        voice
      </button>
      <button onClick={() => source?.set({ chosen: "nope" })} type="button">
        nope
      </button>
    </>
  );
}

describe("useDemoSource", () => {
  test("plays its default, and tells the session what it is", () => {
    render(
      <AudioSessionProvider>
        <Device fallback="groove" />
      </AudioSessionProvider>
    );
    expect(screen.getByLabelText("playing").textContent).toBe("groove");
    expect(screen.getByLabelText("offered").textContent).toBe("groove");
  });

  test("plays the one that is chosen", () => {
    render(
      <AudioSessionProvider>
        <Device fallback="groove" />
      </AudioSessionProvider>
    );
    act(() => screen.getByText("voice").click());
    expect(screen.getByLabelText("playing").textContent).toBe("voice");
  });

  test("falls back when the choice is not a sound of the library", () => {
    render(
      <AudioSessionProvider>
        <Device fallback="noise" />
      </AudioSessionProvider>
    );
    act(() => screen.getByText("nope").click());
    expect(screen.getByLabelText("playing").textContent).toBe("noise");
  });

  test("two previews choose on their own", () => {
    render(
      <>
        <AudioSessionProvider>
          <Device fallback="groove" />
        </AudioSessionProvider>
        <AudioSessionProvider>
          <Device fallback="groove" />
        </AudioSessionProvider>
      </>
    );
    act(() => screen.getAllByText("voice")[0]?.click());
    expect(
      screen.getAllByLabelText("playing").map((n) => n.textContent)
    ).toEqual(["voice", "groove"]);
  });

  test("outside a session it is always the default", () => {
    render(<Device fallback="noise" />);
    expect(screen.getByLabelText("playing").textContent).toBe("noise");
    expect(screen.getByLabelText("offered").textContent).toBe("nothing");
  });
});
