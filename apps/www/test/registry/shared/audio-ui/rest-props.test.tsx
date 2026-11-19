import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Lcd } from "@/registry/bases/shared/audio-ui/elements/lcd";
import { Led } from "@/registry/bases/shared/audio-ui/elements/led";
import { TimelineTimeSelection } from "@/registry/bases/shared/audio-ui/elements/time-selection";
import { ValueDisplay } from "@/registry/bases/shared/audio-ui/elements/value-display";

const EXTRA = { "data-testid": "root", id: "mine", title: "a title" } as const;

test.each([
  ["Lcd", <Lcd {...EXTRA}>0</Lcd>],
  ["Led", <Led {...EXTRA} label="Signal" on />],
  [
    "TimelineTimeSelection",
    <TimelineTimeSelection {...EXTRA} range={[1, 2]} />,
  ],
  ["ValueDisplay", <ValueDisplay {...EXTRA} kind="db" value={-6} />],
])("%s passes the props of its element to its root", (_name, element) => {
  const { getByTestId } = render(element);
  const root = getByTestId("root");
  expect(root.id).toBe("mine");
  expect(root.title).toBe("a title");
  expect(root.dataset.slot).toBeTruthy();
});

test("a style given to the time selection joins its position, it does not replace it", () => {
  const { getByTestId } = render(
    <TimelineTimeSelection
      data-testid="root"
      range={[1, 3]}
      style={{ opacity: 0.5 }}
    />
  );
  const root = getByTestId("root");
  expect(root.style.opacity).toBe("0.5");
  expect(root.style.width).toContain("2");
});
