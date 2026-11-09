import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
} from "@/registry-audio/bases/base/lib/audio-export";

// The site's icons load their library through the bundler, which a test has not: the close button's icon draws nothing.
mock.module("@/components/icon-placeholder", () => ({
  IconPlaceholder: () => null,
}));

const { ExportDialog } = await import(
  "@/registry-audio/bases/base/audio/elements/export-dialog"
);

const NOTHING = () => undefined;

describe("ExportDialog", () => {
  test("EXP-003: shows the format, the bit depth and the level, and Export sends them", () => {
    const onExport = mock((_settings: ExportSettings) => undefined);
    render(
      <ExportDialog
        onExport={onExport}
        onSettingsChange={NOTHING}
        open
        range="Bars 1 to 9"
        settings={DEFAULT_EXPORT_SETTINGS}
      />
    );
    expect(screen.getByText("Bars 1 to 9")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Format" }).textContent).toBe(
      "WAV"
    );
    expect(
      screen.getByRole("combobox", { name: "Bit depth" }).textContent
    ).toBe("24-bit");
    expect(
      screen.getByRole("combobox", { name: "Normalize" }).textContent
    ).toBe("Off");
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(onExport).toHaveBeenCalledWith(DEFAULT_EXPORT_SETTINGS);
  });

  test("an MP3 shows its bitrate in place of a bit depth, and a target its loudness", () => {
    render(
      <ExportDialog
        onExport={NOTHING}
        onSettingsChange={NOTHING}
        open
        settings={{ ...DEFAULT_EXPORT_SETTINGS, format: "mp3", normalize: -14 }}
      />
    );
    expect(screen.getByRole("combobox", { name: "Bitrate" }).textContent).toBe(
      "320 kbps"
    );
    expect(screen.queryByRole("combobox", { name: "Bit depth" })).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Normalize" }).textContent
    ).toBe("Streaming, -14 LUFS");
  });
});
