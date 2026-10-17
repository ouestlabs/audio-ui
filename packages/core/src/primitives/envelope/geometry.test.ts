import { describe, expect, test } from "bun:test";
import { CURVE_SAMPLES, polylinePoints, segmentShape } from "./geometry.ts";

type Vertex = [number, number];

function distanceToSegment(point: Vertex, from: Vertex, to: Vertex) {
  const [px, py] = point;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = dx * dx + dy * dy;
  const share =
    length === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - from[0]) * dx + (py - from[1]) * dy) / length)
        );
  return Math.hypot(px - (from[0] + dx * share), py - (from[1] + dy * share));
}

describe("polylinePoints of a tightly bent segment", () => {
  test("stays on the curve where the grid alone would draw a facet", () => {
    const value = [
      { curve: -1, x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const vertices = polylinePoints(value)
      .split(" ")
      .map((pair) => pair.split(",").map((n) => Number(n) / 100) as Vertex);
    expect(vertices.length).toBeGreaterThan(CURVE_SAMPLES * 2);
    let worst = 0;
    for (let step = 0; step <= 400; step += 1) {
      const t = step / 400;
      const truth: Vertex = [t, 1 - segmentShape(t, -1)];
      let nearest = Number.POSITIVE_INFINITY;
      for (let index = 0; index < vertices.length - 1; index += 1) {
        nearest = Math.min(
          nearest,
          distanceToSegment(
            truth,
            vertices[index] as Vertex,
            vertices[index + 1] as Vertex
          )
        );
      }
      worst = Math.max(worst, nearest);
    }
    expect(worst).toBeLessThan(0.001);
  });

  test("a straight segment keeps no more than its two points and the lead-in and lead-out", () => {
    const value = [
      { x: 0.2, y: 0 },
      { x: 0.8, y: 1 },
    ];
    expect(polylinePoints(value).split(" ")).toHaveLength(4);
  });
});
