import { describe, expect, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import { useCallback } from "react";
import {
  AudioSessionProvider,
  useAudioSession,
} from "@/registry-audio/bases/base/hooks/use-audio-session";
import { useDemoSource } from "@/registry-audio/bases/base/hooks/use-demo-source";

function Device({ fallback }: { fallback: "groove" | "chord" }) {
  const name = useDemoSource(fallback);
  const source = useAudioSession()?.source;
  const pickTrap = useCallback(() => source?.set({ chosen: "trap" }), [source]);
  const pickNope = useCallback(() => source?.set({ chosen: "nope" }), [source]);
  return (
    <>
      <output aria-label="playing">{name}</output>
      <output aria-label="offered">
        {source?.get().fallback ?? "nothing"}
      </output>
      <button onClick={pickTrap} type="button">
        trap
      </button>
      <button onClick={pickNope} type="button">
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
    act(() => screen.getByText("trap").click());
    expect(screen.getByLabelText("playing").textContent).toBe("trap");
  });

  test("falls back when the choice is not a sound of the library", () => {
    render(
      <AudioSessionProvider>
        <Device fallback="chord" />
      </AudioSessionProvider>
    );
    act(() => screen.getByText("nope").click());
    expect(screen.getByLabelText("playing").textContent).toBe("chord");
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
    act(() => screen.getAllByText("trap")[0]?.click());
    expect(
      screen.getAllByLabelText("playing").map((n) => n.textContent)
    ).toEqual(["trap", "groove"]);
  });

  test("outside a session it is always the default", () => {
    render(<Device fallback="chord" />);
    expect(screen.getByLabelText("playing").textContent).toBe("chord");
    expect(screen.getByLabelText("offered").textContent).toBe("nothing");
  });
});
