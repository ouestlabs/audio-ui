import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Waveform } from "../../../../waveform";

describe("Waveform.Marker", () => {
  test("sits at its position on the timeline and shows its label", () => {
    const view = render(
      <Waveform.Root duration={200}>
        <Waveform.Marker data-testid="marker" value={50}>
          Chorus
        </Waveform.Marker>
      </Waveform.Root>
    );
    const marker = view.getByTestId("marker");
    expect(marker.style.left).toBe("25%");
    expect(marker.style.position).toBe("absolute");
    expect(marker.textContent).toBe("Chorus");
  });

  test("stays on the timeline", () => {
    const view = render(
      <Waveform.Root duration={200}>
        <Waveform.Marker data-testid="late" value={900} />
        <Waveform.Marker data-testid="broken" value={Number.NaN} />
      </Waveform.Root>
    );
    expect(view.getByTestId("late").style.left).toBe("100%");
    expect(view.getByTestId("broken").style.left).toBe("0%");
  });
});
