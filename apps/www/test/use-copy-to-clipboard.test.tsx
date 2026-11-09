import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

const written: string[] = [];
const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");

beforeEach(() => {
  written.length = 0;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        written.push(text);
        return Promise.resolve();
      },
    },
  });
});

afterEach(() => {
  if (original) {
    Object.defineProperty(navigator, "clipboard", original);
  }
});

const wait = (ms: number) =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe("useCopyToClipboard", () => {
  test("says copied for its timeout after the last copy, not the first", async () => {
    const view = renderHook(() => useCopyToClipboard({ timeout: 100 }));
    await act(async () => {
      view.result.current.copyToClipboard("first");
      await Promise.resolve();
    });
    expect(view.result.current.isCopied).toBe(true);
    await wait(60);
    await act(async () => {
      view.result.current.copyToClipboard("second");
      await Promise.resolve();
    });
    // Past the first copy's timeout, within the second's.
    await wait(60);
    expect(view.result.current.isCopied).toBe(true);
    await wait(80);
    expect(view.result.current.isCopied).toBe(false);
    expect(written).toEqual(["first", "second"]);
  });
});
