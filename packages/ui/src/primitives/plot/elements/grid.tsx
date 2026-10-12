import { axisTicks, formatTick } from "@audio-ui/core/plot";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { type PlotState, positionOn, usePlotContext } from "../context.ts";

/** What a grid draws along one axis. */
export interface GridAxis {
  /** About how many ticks to draw when they are not given. @default 5 */
  count?: number;
  /** Text for a tick's label. Defaults to a short number such as "1k". */
  format?: (value: number) => string;
  /** Whether the labels are written. @default true */
  labels?: boolean;
  /** Where the lines go. Without it, round values spread evenly over the axis, by powers of ten when it is logarithmic. */
  ticks?: readonly number[];
}

/**
 * Grid lines and their labels, drawn from the axes: round values along each
 * axis you give, so you do not place each line and label by hand. It covers the plot, is hidden from assistive technology and from the
 * pointer, and marks its parts for styling: `data-part="line"` and
 * `data-part="label"`, each with `data-axis`, and `data-zero` on the line at
 * zero. Renders a `<div>` element.
 */
export function Grid(componentProps: Grid.Props) {
  const { className, ref, render, style, x, y, ...elementProps } =
    componentProps;
  const { meta, state } = usePlotContext("Grid");

  const along = (axis: "x" | "y", options: GridAxis | undefined) => {
    if (!options) {
      return [];
    }
    const plotAxis = meta[axis];
    const values = options.ticks ?? axisTicks(plotAxis, options.count);
    return values.map((value) => ({
      label:
        options.labels === false ? null : (options.format ?? formatTick)(value),
      position: positionOn(plotAxis, value),
      value,
    }));
  };
  const columns = along("x", x);
  const rows = along("y", y);

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        children: (
          <>
            <svg
              aria-hidden="true"
              height="100%"
              preserveAspectRatio="none"
              style={{ inset: 0, overflow: "visible", position: "absolute" }}
              viewBox="0 0 1 1"
              width="100%"
            >
              {columns.map((tick) => (
                <line
                  data-axis="x"
                  data-part="line"
                  data-zero={tick.value === 0 || undefined}
                  key={`x-${tick.value}`}
                  vectorEffect="non-scaling-stroke"
                  x1={tick.position}
                  x2={tick.position}
                  y1={0}
                  y2={1}
                />
              ))}
              {rows.map((tick) => (
                <line
                  data-axis="y"
                  data-part="line"
                  data-zero={tick.value === 0 || undefined}
                  key={`y-${tick.value}`}
                  vectorEffect="non-scaling-stroke"
                  x1={0}
                  x2={1}
                  y1={1 - tick.position}
                  y2={1 - tick.position}
                />
              ))}
            </svg>
            {columns.map((tick) =>
              tick.label === null ? null : (
                <div
                  data-axis="x"
                  data-part="label"
                  key={`x-${tick.value}`}
                  style={{
                    left: `${tick.position * 100}%`,
                    position: "absolute",
                  }}
                >
                  {tick.label}
                </div>
              )
            )}
            {rows.map((tick) =>
              tick.label === null ? null : (
                <div
                  data-axis="y"
                  data-part="label"
                  key={`y-${tick.value}`}
                  style={{
                    position: "absolute",
                    top: `${(1 - tick.position) * 100}%`,
                  }}
                >
                  {tick.label}
                </div>
              )
            )}
          </>
        ),
        style: { inset: 0, pointerEvents: "none", position: "absolute" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Grid {
  export type State = PlotState;
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    /** Grid lines across, at values on the x axis. Leave it out for none. */
    x?: GridAxis;
    /** Grid lines along, at values on the y axis. Leave it out for none. */
    y?: GridAxis;
  }
}
