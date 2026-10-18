import { describe, expect, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import { AudioSessionProvider } from "@/registry-audio/bases/base/hooks/use-audio-session";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";

function Preview({ name }: { name: string }) {
  const { playing, toggle } = usePlaySwitch();
  return (
    <button onClick={toggle} type="button">
      {name}: {playing ? "playing" : "stopped"}
    </button>
  );
}

describe("usePlaySwitch", () => {
  test("a preview plays alone, whatever else is on the page", () => {
    render(
      <>
        <AudioSessionProvider>
          <Preview name="first" />
        </AudioSessionProvider>
        <AudioSessionProvider>
          <Preview name="second" />
        </AudioSessionProvider>
      </>
    );
    act(() => screen.getByText("first: stopped").click());
    expect(screen.getByText("first: playing")).toBeTruthy();
    expect(screen.getByText("second: stopped")).toBeTruthy();
  });

  test("outside a session it stays stopped and ignores a press", () => {
    render(<Preview name="alone" />);
    act(() => screen.getByText("alone: stopped").click());
    expect(screen.getByText("alone: stopped")).toBeTruthy();
  });
});
