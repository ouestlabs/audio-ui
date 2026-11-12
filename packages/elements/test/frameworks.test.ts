import { describe, expect, test } from "bun:test";
import "../src/index.ts";
import type { KnobElement } from "../src/knob/index.ts";
import { key } from "./helpers.ts";

/**
 * What a two-way binding does, as Vue's `v-model` on an element: it reads
 * `event.target.value` on `input`, then writes the value it read back.
 */
describe("a two-way binding", () => {
  function renderKnob() {
    document.body.innerHTML = `
      <audio-ui-knob min="0" max="100" value="50">
        <audio-ui-knob-control><audio-ui-knob-thumb aria-label="Cutoff"></audio-ui-knob-thumb></audio-ui-knob-control>
      </audio-ui-knob>`;
    const knob = document.querySelector("audio-ui-knob") as KnobElement;
    return { input: knob.querySelector("input") as HTMLInputElement, knob };
  }

  test("reads the new value on input, as from a native input", () => {
    const { input, knob } = renderKnob();
    const read: number[] = [];
    knob.addEventListener("input", (event) => {
      read.push((event.target as KnobElement).value, event.detail.value);
    });
    key(input, "ArrowUp");
    key(input, "ArrowUp");
    expect(read).toEqual([51, 51, 52, 52]);
    expect(knob.value).toBe(52);
  });

  test("a refused value is read only while its input is dispatched", () => {
    const { input, knob } = renderKnob();
    const read: number[] = [];
    knob.addEventListener("input", (event) => {
      read.push(knob.value);
      event.preventDefault();
    });
    key(input, "ArrowUp");
    expect(read).toEqual([51]);
    expect(knob.value).toBe(50);
  });
});

/**
 * What a framework does to a custom element that the HTML parser does not:
 * React sets a prop as a property whenever the element defines one, with the
 * attribute's text as its value.
 */
describe("properties set by a framework", () => {
  test("a composite value set as text is read as its attribute would be", () => {
    document.body.innerHTML = `
      <audio-ui-xypad></audio-ui-xypad>
      <audio-ui-envelope></audio-ui-envelope>
      <audio-ui-sequencer></audio-ui-sequencer>
      <audio-ui-timeline duration="32">
        <audio-ui-timeline-lane><audio-ui-timeline-range></audio-ui-timeline-range></audio-ui-timeline-lane>
      </audio-ui-timeline>`;
    const set = (selector: string, value: string) => {
      const element = document.querySelector(selector) as HTMLElement & {
        value: unknown;
      };
      element.value = value;
      return element.value;
    };
    expect(set("audio-ui-xypad", "30 70")).toEqual({ x: 30, y: 70 });
    expect(set("audio-ui-envelope", "0 0, 1 1")).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(set("audio-ui-sequencer", "x. .x")).toEqual([
      [true, false],
      [false, true],
    ]);
    expect(set("audio-ui-timeline-range", "8 16")).toEqual([8, 16]);
  });

  test("a generated item's index can be set as a property", () => {
    document.body.innerHTML = `
      <audio-ui-meter value="-12 -6">
        <audio-ui-meter-channel></audio-ui-meter-channel>
      </audio-ui-meter>`;
    const channel = document.querySelector(
      "audio-ui-meter-channel"
    ) as HTMLElement & { index: number };
    channel.index = 1;
    expect(channel.getAttribute("index")).toBe("1");
    expect(channel.getAttribute("aria-valuenow")).toBe("-6");
  });

  test("the structural rules sit in a cascade layer, first in the head, so layered utilities win", () => {
    const style = document.head.querySelector("style[data-audio-ui-elements]");
    expect(style).toBe(document.head.firstElementChild);
    expect(style?.textContent?.startsWith("@layer audio-ui-elements {")).toBe(
      true
    );
  });
});
