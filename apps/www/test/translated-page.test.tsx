import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { guardTranslatedPage } from "@/lib/translated-page";

/** What a browser's translator does: each text node gives way to a <font> holding the translation. */
function translate(element: Element) {
  for (const node of [...element.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const font = document.createElement("font");
      font.textContent = "已翻译";
      node.replaceWith(font);
    }
  }
}

function Status({ playing }: { playing: boolean }) {
  return <p>{playing ? "Playing" : null} the loop</p>;
}

describe("guardTranslatedPage", () => {
  test("without it, React throws on text the browser translated", () => {
    const { container, rerender } = render(<Status playing={false} />);
    translate(container.querySelector("p") as Element);
    expect(() => rerender(<Status playing />)).toThrow(
      "not a child of this node"
    );
  });

  test("React adds text next to translated text", () => {
    const restore = guardTranslatedPage();
    const { container, rerender } = render(<Status playing={false} />);
    translate(container.querySelector("p") as Element);
    expect(() => rerender(<Status playing />)).not.toThrow();
    restore();
    expect(container.textContent).toContain("已翻译");
  });

  test("React removes text the browser translated", () => {
    const restore = guardTranslatedPage();
    const { container, rerender } = render(<Status playing />);
    translate(container.querySelector("p") as Element);
    expect(() => rerender(<Status playing={false} />)).not.toThrow();
    restore();
    expect(container.textContent).toContain("已翻译");
  });
});
